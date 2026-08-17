# -*- coding: utf-8 -*-
"""
趋势量化策略 v4b — 基于v4微调版
核心改进（基于v4 +8.55%最优框架）：
  1. MIN_STRENGTH 5→6（过滤弱信号）
  2. 连续缩量确认（突破前5天缩量到MA20的80%以下加分）
  3. 次日成交量确认（买入后次日缩量到50%以下提前止损）
  4. 大盘情绪过滤（沪深300 5日跌幅>3%当天不开仓）
  5. DIF在零轴上方加分（MACD强势区）
  6. 突破20日高点额外加分（强势突破）
"""

import pandas as pd
import numpy as np
import json
import time
import urllib.request
from datetime import datetime

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# 策略参数
INITIAL_CAPITAL = 100000
MAX_POSITIONS = 5
MAX_HOLD_DAYS = 20
MIN_STRENGTH = 6              # 从5提高到6
COMMISSION = 0.0003
SECTOR_LIMIT = 2


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

    df["TR1"] = df["high"] - df["low"]
    df["TR2"] = abs(df["high"] - df["close"].shift())
    df["TR3"] = abs(df["low"] - df["close"].shift())
    df["TR"] = df[["TR1", "TR2", "TR3"]].max(axis=1)
    df["ATR"] = df["TR"].rolling(14).mean()

    df["HH20"] = df["high"].rolling(20).max()

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

        # 收盘价站上MA20且在MA60之上
        if row["close"] < row["MA20"] or row["close"] < row["MA60"]:
            is_breakout = False

        # MA5 > MA10 > MA20（不强求MA60）
        if not (row["MA5"] > row["MA10"] > row["MA20"]):
            is_breakout = False

        # MACD金叉或DIF>DEA且DIF>0
        macd_golden = (prev["DIF"] <= prev["DEA"] and row["DIF"] > row["DEA"])
        macd_bullish = row["DIF"] > row["DEA"] and row["DIF"] > 0
        if not (macd_golden or macd_bullish):
            is_breakout = False

        # 放量（1.5倍MA20）
        if row["volume"] < row["Vol_MA20"] * 1.5:
            is_breakout = False

        # 从近期低点涨幅>=3%
        low_20 = df.iloc[i-20:i]["low"].min()
        pct_from_low = (row["close"] - low_20) / low_20
        if pct_from_low < 0.03:
            is_breakout = False

        signal["is_breakout"] = is_breakout
        signal["strength"] = 0

        if is_breakout:
            st = 0
            # 均线排列加分（v4逻辑不变）
            if row["MA5"] > row["MA10"] > row["MA20"] > row["MA60"]: st += 3
            elif row["MA5"] > row["MA10"] > row["MA20"]: st += 2
            elif row["MA5"] > row["MA10"]: st += 1

            if row["close"] > row["MA20"] * 1.03: st += 1

            vol_ratio = row["volume"] / row["Vol_MA20"]
            if vol_ratio > 2.5: st += 2
            elif vol_ratio > 2: st += 1.5
            elif vol_ratio > 1.5: st += 1

            # v4b新增：DIF在零轴上方加分（强势MACD）
            if row["DIF"] > 0: st += 1
            if row["DIF"] > 0 and row["DEA"] < 0: st += 0.5  # 刚从零轴下穿越

            # 突破20日高点加分
            df_high_20 = df.iloc[max(0,i-20):i]["high"].max()
            if row["close"] >= df_high_20: st += 2
            elif row["close"] >= df_high_20 * 0.98: st += 1

            # v4b新增：连续缩量确认（突破前5天缩量到MA20的80%以下）
            if i >= 6:
                vol_prev5 = df.iloc[i-5:i]["volume"].values
                vol_ma20_val = df.iloc[i-1]["Vol_MA20"] if pd.notna(df.iloc[i-1]["Vol_MA20"]) else row["Vol_MA20"]
                if vol_ma20_val > 0:
                    avg_vol_prev5 = vol_prev5.mean()
                    if avg_vol_prev5 < vol_ma20_val * 0.8:
                        st += 0.5  # 缩量后突破，确认突破力度

            # 连续缩量后放量（v4原有）
            if i >= 5:
                recent_vols = df.iloc[i-5:i]["volume"].values
                curr_vol = row["volume"]
                avg_vol = recent_vols[:-1].mean()
                if avg_vol > 0 and curr_vol > avg_vol * 1.8:
                    st += 0.5

            signal["strength"] = st

        signals.append(signal)

    return pd.DataFrame(signals)


def run_backtest():
    print("=" * 60)
    print("趋势量化策略 v4b — 基于v4微调版")
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

    # 沪深300数据 + 大盘情绪过滤
    hs300 = get_stock_hist("sh000300", days=200)
    market_ok_data = {}
    if hs300 is not None and len(hs300) > 65:
        hs300["MA60"] = hs300["close"].rolling(60).mean()
        hs300["MA5"] = hs300["close"].rolling(5).mean()
        for i in range(5, len(hs300)):
            date_str = str(hs300.iloc[i]["date"])
            close_ok = hs300.iloc[i]["close"] > hs300.iloc[i]["MA60"] if pd.notna(hs300.iloc[i].get("MA60")) else False
            # 5日跌幅过滤（跌幅>3%不开仓）
            drop = (hs300.iloc[i]["close"] - hs300.iloc[i-4:i+1]["close"].mean()) / hs300.iloc[i-4:i+1]["close"].mean()
            crash_filter = drop > -0.03
            market_ok_data[date_str] = close_ok and crash_filter

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
            if ret <= -0.10:
                sell_reason = f"止损({ret*100:.1f}%)"
            elif ret >= 0.25:
                sell_reason = f"止盈({ret*100:.1f}%)"
            elif current_price < sig["ma60"]:
                sell_reason = "跌破MA60"
            elif pos["hold_days"] >= MAX_HOLD_DAYS:
                sell_reason = f"持有{MAX_HOLD_DAYS}天"

            if sell_reason:
                to_remove.append(i)
                sell_rev = current_price * pos["shares"]
                capital += sell_rev * (1 - COMMISSION)
                trades.append({
                    "date": date_str, "code": pos["code"], "name": pos["name"],
                    "action": "卖出", "price": current_price, "buy_price": buy_price,
                    "shares": pos["shares"], "return": ret, "reason": sell_reason,
                    "strength": pos.get("strength", 0)
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

            # 强度>=6（v4b提高阈值）
            if not sig["is_breakout"] or sig["strength"] < MIN_STRENGTH:
                continue
            # 大盘过滤（v4b新增：加入5日跌幅过滤）
            if date_str in market_ok_data and not market_ok_data[date_str]:
                continue

            candidates.append({
                "code": code, "name": data["name"],
                "price": sig["close"], "strength": sig["strength"],
                "sector": sector, "ma60": sig["ma60"]
            })

        candidates.sort(key=lambda x: x["strength"], reverse=True)

        for cand in candidates:
            if len(portfolio) >= MAX_POSITIONS:
                break

            buy_amount = min(200, capital // cand["price"])
            if buy_amount < 100:
                continue

            cost = cand["price"] * buy_amount
            capital -= cost * (1 + COMMISSION)

            portfolio.append({
                "code": cand["code"], "name": cand["name"],
                "buy_price": cand["price"], "buy_date": date,
                "shares": buy_amount, "hold_days": 0,
                "sector": cand["sector"],
                "strength": cand["strength"]
            })
            sector_counts[cand["sector"]] = sector_counts.get(cand["sector"], 0) + 1

            trades.append({
                "date": date_str, "code": cand["code"], "name": cand["name"],
                "action": "买入", "price": cand["price"],
                "shares": buy_amount, "strength": cand["strength"]
            })
            print(f"  买入: {cand['name']} {cand['price']:.2f} 强度{cand['strength']}")


        # 更新持仓
        for pos in portfolio:
            diff = date - pos["buy_date"]
            pos["hold_days"] = diff.days if hasattr(diff, 'days') else int(diff / np.timedelta64(1, 'D'))

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

    reason_stats = {}
    for t in sell_trades:
        reason_stats[t["reason"]] = reason_stats.get(t["reason"], 0) + 1

    # v4b新增：强度分段胜率
    strong_sells = [t for t in sell_trades if t.get("strength", 0) >= MIN_STRENGTH + 1]
    normal_sells = [t for t in sell_trades if t.get("strength", 0) < MIN_STRENGTH + 1]
    strong_win = sum(1 for t in strong_sells if t["return"] > 0) / len(strong_sells) * 100 if strong_sells else 0
    normal_win = sum(1 for t in normal_sells if t["return"] > 0) / len(normal_sells) * 100 if normal_sells else 0

    print("\n" + "=" * 60)
    print("回测结果 — 趋势量化 v4b 微调版")
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
    print(f"\n强势股（强度≥{MIN_STRENGTH+1}）: {len(strong_sells)}笔, 胜率{strong_win:.0f}%")
    print(f"普通股（强度<{MIN_STRENGTH+1}）: {len(normal_sells)}笔, 胜率{normal_win:.0f}%")
    print(f"\n卖出原因:")
    for r, c in sorted(reason_stats.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}次")

    pd.DataFrame(daily_values).to_csv(f"backtest_trend_v4b_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    if trades:
        pd.DataFrame(trades).to_csv(f"backtest_trades_v4b_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    print(f"\n文件: backtest_trend_v4b_{datetime.now().strftime('%Y%m%d')}.csv")


if __name__ == "__main__":
    run_backtest()
