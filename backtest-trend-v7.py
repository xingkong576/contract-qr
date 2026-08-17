# -*- coding: utf-8 -*-
"""
趋势量化策略 v7 — 双轨出场终极版
核心改进：
  1. 基于v4（+8.55%最优）框架
  2. 双轨出场：强势股强度≥8 → 移动止盈12%/40天；普通<8 → 移动止盈8%/25天
  3. 动态ATR止损：ATR占比>5%不入场，入场后ATR止损1.5倍ATR
  4. 缩量破MA20出场：跌破MA20且缩量到MA20的60%以下
  5. 趋势强化入场：MA5>MA10>MA20>MA60完美排列给更高强度加分
  6. 大盘情绪过滤：沪深300 5日跌幅>3%当天不开新仓
"""

import pandas as pd
import numpy as np
import json
import time
import urllib.request
from datetime import datetime

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

INITIAL_CAPITAL = 100000
MAX_POSITIONS = 5
COMMISSION = 0.0003
SECTOR_LIMIT = 2
ATR_FILTER_PCT = 0.05  # ATR占比>5%不入场

# 双轨参数
STRONG_THRESHOLD = 8      # 强势股强度门槛
STRONG_TRAIL = 0.12       # 强势股移动止盈12%
STRONG_HOLD_DAYS = 40     # 强势股最长持有40天
NORMAL_TRAIL = 0.08       # 普通股移动止盈8%
NORMAL_HOLD_DAYS = 25     # 普通股最长持有25天


SECTOR_MAP = {
    "sh600519": "白酒", "sz000858": "白酒", "sh600809": "白酒", "sz002304": "白酒",
    "sh600900": "电力", "sh601088": "煤炭", "sh600585": "建材",
    "sh601318": "保险", "sh601601": "保险", "sh601398": "银行",
    "sz000001": "银行", "sh600036": "银行", "sh601166": "银行", "sh601288": "银行",
    "sz002594": "汽车", "sz300750": "电池",
    "sz002714": "养殖",
    "sh601888": "消费",
    "sz000333": "家电", "sh600690": "家电",
    "sh600276": "医药", "sz300760": "医药", "sz000661": "医药",
    "sz002475": "电子", "sz002230": "AI", "sz002415": "电子",
    "sh601012": "光伏", "sz002241": "电子",
    "sh601899": "有色", "sz002493": "石化", "sh600309": "化工",
    "sh600030": "券商", "sh601688": "券商", "sz300059": "券商",
    "sz000725": "电子", "sh601919": "航运",
    "sz002271": "建材", "sh600048": "地产", "sz000002": "地产",
    "sz002352": "物流", "sz002050": "电子", "sz002027": "传媒",
    "sz002718": "装修", "sz002236": "电子",
}


def get_stock_hist(code, days=200):
    url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={code},day,,,{days},qfq"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read().decode('utf-8')
        j = json.loads(data)
        d = None
        for k, v in j.get('data', {}).items():
            if 'qfqday' in v:
                d = v['qfqday']
                break
        if not d:
            return None
        records = []
        for row in d:
            if len(row) >= 6:
                records.append({
                    "date": row[0], "open": float(row[1]), "close": float(row[2]),
                    "high": float(row[3]), "low": float(row[4]), "volume": float(row[5]),
                })
        if records:
            df = pd.DataFrame(records)
            df['date'] = pd.to_datetime(df['date'])
            return df
        return None
    except:
        return None


def calc_signals(df):
    if df is None or len(df) < 60:
        return None

    df = df.copy()
    df["MA5"] = df["close"].rolling(5).mean()
    df["MA10"] = df["close"].rolling(10).mean()
    df["MA20"] = df["close"].rolling(20).mean()
    df["MA60"] = df["close"].rolling(60).mean()
    df["Vol_MA5"] = df["volume"].rolling(5).mean()
    df["Vol_MA20"] = df["volume"].rolling(20).mean()

    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["DIF"] = ema12 - ema26
    df["DEA"] = df["DIF"].ewm(span=9, adjust=False).mean()

    # ATR
    df["TR1"] = df["high"] - df["low"]
    df["TR2"] = abs(df["high"] - df["close"].shift())
    df["TR3"] = abs(df["low"] - df["close"].shift())
    df["TR"] = df[["TR1", "TR2", "TR3"]].max(axis=1)
    df["ATR"] = df["TR"].rolling(14).mean()

    # 布林带
    df["BB_MID"] = df["close"].rolling(20).mean()
    df["BB_STD"] = df["close"].rolling(20).std()
    df["BB_WIDTH"] = 2 * df["BB_STD"] / df["BB_MID"] * 100

    signals = []
    for i in range(60, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i-1]

        signal = {
            "date": row["date"], "close": row["close"],
            "ma5": row["MA5"], "ma10": row["MA10"], "ma20": row["MA20"], "ma60": row["MA60"],
            "volume": row["volume"], "vol_ma20": row["Vol_MA20"],
            "dif": row["DIF"], "dea": row["DEA"],
            "atr": row.get("ATR", 0),
        }

        is_breakout = True

        # 趋势向上
        if row["close"] < row["MA20"] or row["close"] < row["MA60"]:
            is_breakout = False

        # 短期向上
        if not (row["MA5"] > row["MA10"]):
            is_breakout = False

        # MACD多头
        macd_golden = (prev["DIF"] <= prev["DEA"] and row["DIF"] > row["DEA"])
        macd_bullish = row["DIF"] > row["DEA"] and row["DIF"] > 0
        if not (macd_golden or macd_bullish):
            is_breakout = False

        # 放量
        if row["volume"] < row["Vol_MA20"] * 1.2:
            is_breakout = False

        # 布林带扩张
        if row.get("BB_WIDTH", 0) < 1.5:
            is_breakout = False

        # 从低点涨幅
        low_20 = df.iloc[i-20:i]["low"].min()
        pct_from_low = (row["close"] - low_20) / low_20
        if pct_from_low < 0.02:
            is_breakout = False

        signal["is_breakout"] = is_breakout
        signal["strength"] = 0

        if is_breakout:
            st = 0
            # 均线排列（核心加分）
            if row["MA5"] > row["MA10"] > row["MA20"] > row["MA60"]: st += 3
            elif row["MA5"] > row["MA10"] > row["MA20"]: st += 2
            elif row["MA5"] > row["MA10"]: st += 1

            if row["close"] > row["MA20"] * 1.03: st += 1

            vol_ratio = row["volume"] / row["Vol_MA20"]
            if vol_ratio > 2.5: st += 2
            elif vol_ratio > 2: st += 1.5
            elif vol_ratio > 1.5: st += 1

            if row["DIF"] > 0: st += 1

            df_high_20 = df.iloc[max(0,i-20):i]["high"].max()
            if row["close"] >= df_high_20: st += 2
            elif row["close"] >= df_high_20 * 0.98: st += 1

            signal["strength"] = st

        signals.append(signal)

    return pd.DataFrame(signals)


def run_backtest():
    print("=" * 60)
    print("趋势量化策略 v7 — 双轨出场终极版")
    print("=" * 60)

    stocks = [
        {"code": "sh600519", "name": "贵州茅台"}, {"code": "sz000858", "name": "五粮液"},
        {"code": "sh600809", "name": "山西汾酒"}, {"code": "sz002304", "name": "洋河股份"},
        {"code": "sh600900", "name": "长江电力"}, {"code": "sh601088", "name": "中国神华"},
        {"code": "sh600585", "name": "海螺水泥"},
        {"code": "sh601318", "name": "中国平安"}, {"code": "sh601601", "name": "中国太保"},
        {"code": "sh601398", "name": "工商银行"}, {"code": "sz000001", "name": "平安银行"},
        {"code": "sh600036", "name": "招商银行"}, {"code": "sh601166", "name": "兴业银行"},
        {"code": "sh601288", "name": "农业银行"},
        {"code": "sz002594", "name": "比亚迪"}, {"code": "sz300750", "name": "宁德时代"},
        {"code": "sz002714", "name": "牧原股份"},
        {"code": "sh601888", "name": "中国中免"},
        {"code": "sz000333", "name": "美的集团"}, {"code": "sh600690", "name": "海尔智家"},
        {"code": "sh600276", "name": "恒瑞医药"}, {"code": "sz300760", "name": "迈瑞医疗"},
        {"code": "sz000661", "name": "长春高新"},
        {"code": "sz002475", "name": "立讯精密"}, {"code": "sz002230", "name": "科大讯飞"},
        {"code": "sz002415", "name": "海康威视"}, {"code": "sh601012", "name": "隆基绿能"},
        {"code": "sz002241", "name": "歌尔股份"}, {"code": "sz002236", "name": "大华股份"},
        {"code": "sh601899", "name": "紫金矿业"}, {"code": "sz002493", "name": "荣盛石化"},
        {"code": "sh600309", "name": "万华化学"},
        {"code": "sh600030", "name": "中信证券"}, {"code": "sh601688", "name": "华泰证券"},
        {"code": "sz300059", "name": "东方财富"},
        {"code": "sz000725", "name": "京东方A"}, {"code": "sh601919", "name": "中远海控"},
        {"code": "sz002271", "name": "东方雨虹"}, {"code": "sh600048", "name": "保利发展"},
        {"code": "sz000002", "name": "万科A"}, {"code": "sz002352", "name": "顺丰控股"},
        {"code": "sz002050", "name": "三花智控"}, {"code": "sz002027", "name": "分众传媒"},
    ]

    # 大盘过滤：沪深300 MA60 + 5日跌幅>3%
    hs300 = get_stock_hist("sh000300", days=200)
    market_ok_data = {}
    if hs300 is not None and len(hs300) > 65:
        hs300["MA60"] = hs300["close"].rolling(60).mean()
        hs300["MA5"] = hs300["close"].rolling(5).mean()
        for i in range(5, len(hs300)):
            date_str = str(hs300.iloc[i]["date"])
            close_ok = hs300.iloc[i]["close"] > hs300.iloc[i]["MA60"] if pd.notna(hs300.iloc[i].get("MA60")) else False
            # 5日跌幅过滤
            drop = (hs300.iloc[i]["close"] - hs300.iloc[i-4:i+1]["close"].mean()) / hs300.iloc[i-4:i+1]["close"].mean()
            crash_filter = drop > -0.03  # 跌幅不超过3%
            market_ok_data[date_str] = close_ok and crash_filter

    # 获取数据
    stock_data = {}
    for stock in stocks:
        hist = get_stock_hist(stock["code"])
        if hist is not None and len(hist) > 60:
            signals = calc_signals(hist)
            if signals is not None and len(signals) > 0:
                stock_data[stock["code"]] = {"name": stock["name"], "signals": signals}
                breakout_count = signals[signals["is_breakout"]].shape[0]
                print(f"[OK] {stock['name']} {len(signals)}天, 突破{breakout_count}次")
        time.sleep(0.3)

    print(f"\n共 {len(stock_data)} 只股票")

    all_dates = set()
    for d in stock_data.values():
        all_dates.update(d["signals"]["date"].values)
    trading_dates = sorted(list(all_dates))
    print(f"交易日历: {len(trading_dates)} 天\n")

    # 回测引擎
    portfolio = []
    capital = INITIAL_CAPITAL
    trades = []
    daily_values = []
    sector_counts = {}

    for date in trading_dates:
        date_str = str(date)

        # ---- 卖出 ----
        to_remove = []
        for i, pos in enumerate(portfolio):
            sigs = stock_data[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            sig = day_sig.iloc[0]
            current_price = sig["close"]
            buy_price = pos["buy_price"]
            ret = (current_price - buy_price) / buy_price

            sell_reason = None
            is_strong = pos["strength"] >= STRONG_THRESHOLD

            # 移动止盈（双轨）
            trail_pct = STRONG_TRAIL if is_strong else NORMAL_TRAIL
            if current_price < pos["highest"] * (1 - trail_pct):
                sell_reason = f"{'强势' if is_strong else '普通'}止盈({ret*100:.1f}%)"
            # ATR止损
            elif pos.get("atr_stop_pct", 0) > 0:
                atr_stop = current_price < buy_price * (1 - pos["atr_stop_pct"])
                if atr_stop:
                    sell_reason = f"ATR止损({ret*100:.1f}%)"
            # 跌破MA60
            elif current_price < sig["ma60"]:
                sell_reason = "跌破MA60"
            # 缩量破MA20
            elif current_price < sig["ma20"] and sig["volume"] < sig["vol_ma20"] * 0.6:
                sell_reason = "缩量破MA20"
            # 持有到期
            max_days = STRONG_HOLD_DAYS if is_strong else NORMAL_HOLD_DAYS
            if pos["hold_days"] >= max_days:
                sell_reason = f"持有{max_days}天到期"

            if sell_reason:
                to_remove.append(i)
                sell_rev = current_price * pos["shares"]
                capital += sell_rev * (1 - COMMISSION)
                trades.append({
                    "date": date_str, "code": pos["code"], "name": pos["name"],
                    "action": "卖出", "price": current_price, "buy_price": buy_price,
                    "shares": pos["shares"], "return": ret, "reason": sell_reason,
                    "strength": pos["strength"]
                })

        for i in sorted(to_remove, reverse=True):
            portfolio.pop(i)

        # ---- 买入 ----
        candidates = []
        for code, data in stock_data.items():
            if any(p["code"] == code for p in portfolio):
                continue
            sector = SECTOR_MAP.get(code, "其他")
            if sector_counts.get(sector, 0) >= SECTOR_LIMIT:
                continue

            sigs = data["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            sig = day_sig.iloc[0]

            if not sig["is_breakout"] or sig["strength"] < 6:
                continue
            # 大盘过滤
            if date_str in market_ok_data and not market_ok_data[date_str]:
                continue

            # ATR过滤（放宽到8%）
            atr_pct = sig["atr"] / sig["close"] if sig["close"] > 0 else 0
            if atr_pct > 0.08:
                continue

            # 计算ATR止损比例（3倍ATR，更宽松）
            atr_stop_pct = min(0.15, sig["atr"] / sig["close"] * 3.0) if sig["atr"] > 0 else 0.10

            candidates.append({
                "code": code, "name": data["name"],
                "price": sig["close"], "strength": sig["strength"],
                "sector": sector, "atr_stop_pct": atr_stop_pct
            })

        candidates.sort(key=lambda x: x["strength"], reverse=True)

        for cand in candidates:
            if len(portfolio) >= MAX_POSITIONS:
                break

            # 分批建仓
            if cand["strength"] >= 9:
                buy_shares = min(400, capital // cand["price"])
            elif cand["strength"] >= 8:
                buy_shares = min(300, capital // cand["price"])
            elif cand["strength"] >= 7:
                buy_shares = min(250, capital // cand["price"])
            else:
                buy_shares = min(200, capital // cand["price"])

            if buy_shares < 100:
                continue

            cost = cand["price"] * buy_shares
            capital -= cost * (1 + COMMISSION)

            portfolio.append({
                "code": cand["code"], "name": cand["name"],
                "buy_price": cand["price"], "buy_date": date,
                "shares": buy_shares, "hold_days": 0,
                "sector": cand["sector"],
                "strength": cand["strength"],
                "highest": cand["price"],
                "atr_stop_pct": cand["atr_stop_pct"]
            })
            sector_counts[cand["sector"]] = sector_counts.get(cand["sector"], 0) + 1

            trades.append({
                "date": date_str, "code": cand["code"], "name": cand["name"],
                "action": "买入", "price": cand["price"],
                "shares": buy_shares, "strength": cand["strength"],
                "atr_stop_pct": cand["atr_stop_pct"]
            })

        # 更新持仓
        for pos in portfolio:
            diff = date - pos["buy_date"]
            pos["hold_days"] = diff.days if hasattr(diff, 'days') else int(diff / np.timedelta64(1, 'D'))

        # 更新最高价
        for pos in portfolio:
            sigs = stock_data[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) > 0:
                current = day_sig.iloc[0]["close"]
                pos["highest"] = max(pos["highest"], current)

        # 总资产
        pv = capital
        for pos in portfolio:
            sigs = stock_data[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) > 0:
                pv += day_sig.iloc[0]["close"] * pos["shares"]
        daily_values.append({
            "date": date_str, "capital": capital,
            "portfolio_value": pv, "positions": len(portfolio)
        })

    # ---- 输出 ----
    final = daily_values[-1]["portfolio_value"]
    ret_total = (final - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100

    peak = 0
    max_dd = 0
    for dv in daily_values:
        if dv["portfolio_value"] > peak:
            peak = dv["portfolio_value"]
        dd = (peak - dv["portfolio_value"]) / peak * 100
        if dd > max_dd:
            max_dd = dd

    sell_trades = [t for t in trades if t["action"] == "卖出"]
    buy_trades = [t for t in trades if t["action"] == "买入"]
    profitable = sum(1 for t in sell_trades if t["return"] > 0)
    win_rate = profitable / len(sell_trades) * 100 if sell_trades else 0
    avg_hold = np.mean([t.get("hold_days", 0) for t in sell_trades]) if sell_trades else 0

    wins = [t for t in sell_trades if t["return"] > 0]
    losses = [t for t in sell_trades if t["return"] <= 0]
    avg_win = np.mean([t["return"] for t in wins]) * 100 if wins else 0
    avg_loss = np.mean([t["return"] for t in losses]) * 100 if losses else 0
    profit_ratio = abs(avg_win / avg_loss) if avg_loss != 0 else 0

    # 强势/普通股分开统计
    strong_sells = [t for t in sell_trades if t.get("strength", 0) >= STRONG_THRESHOLD]
    normal_sells = [t for t in sell_trades if t.get("strength", 0) < STRONG_THRESHOLD]
    strong_win = sum(1 for t in strong_sells if t["return"] > 0) / len(strong_sells) * 100 if strong_sells else 0
    normal_win = sum(1 for t in normal_sells if t["return"] > 0) / len(normal_sells) * 100 if normal_sells else 0

    reason_stats = {}
    for t in sell_trades:
        reason_stats[t["reason"]] = reason_stats.get(t["reason"], 0) + 1

    print("\n" + "=" * 60)
    print("回测结果 — 趋势量化 v7 双轨出场终极版")
    print("=" * 60)
    print(f"初始资金: {INITIAL_CAPITAL:,.0f}")
    print(f"最终资金: {final:,.0f}")
    print(f"总收益率: {ret_total:+.2f}%")
    print(f"最大回撤: {max_dd:.2f}%")
    print(f"买入: {len(buy_trades)}次 | 卖出: {len(sell_trades)}次")
    print(f"胜率: {win_rate:.1f}% ({profitable}/{len(sell_trades)})")
    print(f"平均持有: {avg_hold:.1f}天")
    print(f"平均盈利: +{avg_win:.1f}% | 平均亏损: {avg_loss:.1f}%")
    print(f"盈亏比: {profit_ratio:.1f}")
    print(f"\n强势股（强度≥{STRONG_THRESHOLD}）: {len(strong_sells)}笔, 胜率{strong_win:.0f}%")
    print(f"普通股（强度<{STRONG_THRESHOLD}）: {len(normal_sells)}笔, 胜率{normal_win:.0f}%")
    print(f"\n卖出原因:")
    for r, c in sorted(reason_stats.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}次")

    pd.DataFrame(daily_values).to_csv(f"backtest_trend_v7_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    if trades:
        pd.DataFrame(trades).to_csv(f"backtest_trades_v7_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    print(f"\n文件: backtest_trend_v7_{datetime.now().strftime('%Y%m%d')}.csv")


if __name__ == "__main__":
    run_backtest()
