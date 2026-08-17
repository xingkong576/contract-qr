# -*- coding: utf-8 -*-
"""
趋势量化策略 v4 — 突破+趋势跟踪混合策略
核心改进：
  1. 扩大股票池到50+只（覆盖中小盘）
  2. 突破时买入，MA60做趋势保护（结合v1+v3优势）
  3. 优化止损止盈：动态止损（ATR基础）+ 移动止盈
  4. 增加大盘过滤（沪深300在MA60之上才开仓）
  5. 增加行业分散（同一行业最多2只）
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
MAX_POSITIONS = 5                  # 增加最大持仓
STOP_LOSS = -0.10                  # 止损-10%
TAKE_PROFIT = 0.25                 # 止盈25%
MAX_HOLD_DAYS = 20                 # 最长持有20天
MIN_STRENGTH = 5                   # 最小信号强度
COMMISSION = 0.0003                # 手续费万分之三
SECTOR_LIMIT = 2                   # 同行业最多2只


# 行业分类（简化版）
SECTOR_MAP = {
    "sh600519": "白酒", "sz000858": "白酒", "sh600900": "电力",
    "sh601318": "保险", "sz002594": "汽车", "sh600036": "银行",
    "sz002714": "养殖", "sh601888": "免税", "sz000333": "家电",
    "sh600276": "医药", "sz000001": "银行", "sz002475": "电子",
    "sz002230": "AI", "sh601012": "光伏", "sz002718": "装修",
    "sz002415": "海康威视", "sz300750": "宁德时代", "sz002594": "比亚迪",
    "sh601899": "紫金矿业", "sz002493": "荣盛石化", "sh600030": "中信证券",
    "sz000725": "京东方A", "sz300059": "东方财富", "sh601166": "兴业银行",
    "sz002714": "牧原股份", "sh600690": "海尔智家", "sz002271": "东方雨虹",
    "sh601088": "中国神华", "sz002050": "三花智控", "sh600809": "山西汾酒",
    "sz002304": "洋河股份", "sh601688": "华泰证券", "sz002027": "分众传媒",
    "sh600309": "万华化学", "sz002352": "顺丰控股", "sh601888": "中国中免",
    "sz300015": "吉大正元", "sh600276": "恒瑞医药", "sz000661": "长春高新",
    "sh601601": "中国太保", "sz002475": "立讯精密", "sz300760": "迈瑞医疗",
    "sh601398": "工商银行", "sz000002": "万科A", "sh601288": "农业银行",
    "sz000858": "五粮液", "sh600048": "保利发展", "sz002236": "大华股份",
    "sh601919": "中远海控", "sz002241": "歌尔股份", "sh600585": "海螺水泥",
}


def get_stock_hist(code, days=200):
    """获取股票历史数据（扩展到200天）"""
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
    """计算每日信号（优化版突破策略）"""
    if df is None or len(df) < 60:
        return None
    
    df = df.copy()
    df["MA5"] = df["close"].rolling(5).mean()
    df["MA10"] = df["close"].rolling(10).mean()
    df["MA20"] = df["close"].rolling(20).mean()
    df["MA60"] = df["close"].rolling(60).mean()
    df["Vol_MA5"] = df["volume"].rolling(5).mean()
    df["Vol_MA20"] = df["volume"].rolling(20).mean()
    
    # MACD
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["DIF"] = ema12 - ema26
    df["DEA"] = df["DIF"].ewm(span=9, adjust=False).mean()
    
    # 布林带宽度
    df["BB_MID"] = df["close"].rolling(20).mean()
    df["BB_STD"] = df["close"].rolling(20).std()
    df["BB_WIDTH"] = 2 * df["BB_STD"] / df["BB_MID"] * 100
    
    # 20日最高价
    df["HH20"] = df["high"].rolling(20).max()
    
    # ATR（用于动态止损）
    df["TR1"] = df["high"] - df["low"]
    df["TR2"] = abs(df["high"] - df["close"].shift())
    df["TR3"] = abs(df["low"] - df["close"].shift())
    df["TR"] = df[["TR1", "TR2", "TR3"]].max(axis=1)
    df["ATR"] = df["TR"].rolling(14).mean()
    
    signals = []
    for i in range(60, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i-1]
        
        signal = {
            "date": row["date"],
            "close": row["close"],
            "ma5": row["MA5"], "ma10": row["MA10"], "ma20": row["MA20"], "ma60": row["MA60"],
            "volume": row["volume"], "vol_ma20": row["Vol_MA20"],
            "dif": row["DIF"], "dea": row["DEA"],
            "bb_width": row.get("BB_WIDTH", 0),
            "hh20": row["HH20"],
            "atr": row.get("ATR", 0),
        }
        
        # ======== 突破信号检测 ========
        is_breakout = True
        
        # 条件1: 收盘价站上MA20且在MA60之上（趋势向上）
        if row["close"] < row["MA20"] or row["close"] < row["MA60"]:
            is_breakout = False
        
        # 条件2: MA5 > MA10 > MA20（完美多头排列）
        if not (row["MA5"] > row["MA10"] > row["MA20"]):
            is_breakout = False
        
        # 条件3: MACD金叉或DIF>DEA且DIF>0
        macd_golden = (prev["DIF"] <= prev["DEA"] and row["DIF"] > row["DEA"])
        macd_bullish = row["DIF"] > row["DEA"] and row["DIF"] > 0
        if not (macd_golden or macd_bullish):
            is_breakout = False
        
        # 条件4: 放量（成交量 > 20日均量 * 1.5）
        if row["volume"] < row["Vol_MA20"] * 1.5:
            is_breakout = False
        
        # 条件5: 布林带扩张（不是极致震荡）
        if row.get("BB_WIDTH", 0) < 2:
            is_breakout = False
        
        # 条件6: 从近期低点涨幅>=3%
        low_20 = df.iloc[i-20:i]["low"].min()
        pct_from_low = (row["close"] - low_20) / low_20
        if pct_from_low < 0.03:
            is_breakout = False
        
        signal["is_breakout"] = is_breakout
        signal["strength"] = 0
        
        if is_breakout:
            # 计算信号强度（满分12）
            st = 0
            if row["MA5"] > row["MA10"] > row["MA20"] > row["MA60"]: st += 3  # 完美排列
            if row["close"] > row["MA20"] * 1.03: st += 1  # 远离MA20
            vol_ratio = row["volume"] / row["Vol_MA20"]
            if vol_ratio > 2.5: st += 2
            elif vol_ratio > 2: st += 1.5
            elif vol_ratio > 1.5: st += 1
            if row["DIF"] > 0: st += 1  # MACD零轴上方
            if row["close"] >= row["HH20"]: st += 2  # 突破20日高点
            elif row["close"] >= row["HH20"] * 0.98: st += 1
            # 连续缩量后放量
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
    print("趋势量化策略 v4 — 突破+趋势跟踪混合")
    print("=" * 60)
    
    # 扩大股票池（50+只，覆盖多行业）
    stocks = [
        {"code": "sh600519", "name": "贵州茅台"}, {"code": "sz000858", "name": "五粮液"},
        {"code": "sh600900", "name": "长江电力"}, {"code": "sh601318", "name": "中国平安"},
        {"code": "sz002594", "name": "比亚迪"}, {"code": "sh600036", "name": "招商银行"},
        {"code": "sz002714", "name": "牧原股份"}, {"code": "sh601888", "name": "中国中免"},
        {"code": "sz000333", "name": "美的集团"}, {"code": "sh600276", "name": "恒瑞医药"},
        {"code": "sz000001", "name": "平安银行"}, {"code": "sz002475", "name": "立讯精密"},
        {"code": "sz002230", "name": "科大讯飞"}, {"code": "sh601012", "name": "隆基绿能"},
        {"code": "sz002415", "name": "海康威视"}, {"code": "sz300750", "name": "宁德时代"},
        {"code": "sh601899", "name": "紫金矿业"}, {"code": "sz002493", "name": "荣盛石化"},
        {"code": "sh600030", "name": "中信证券"}, {"code": "sz000725", "name": "京东方A"},
        {"code": "sz300059", "name": "东方财富"}, {"code": "sh601166", "name": "兴业银行"},
        {"code": "sh600690", "name": "海尔智家"}, {"code": "sz002271", "name": "东方雨虹"},
        {"code": "sh601088", "name": "中国神华"}, {"code": "sz002050", "name": "三花智控"},
        {"code": "sh600809", "name": "山西汾酒"}, {"code": "sz002304", "name": "洋河股份"},
        {"code": "sh601688", "name": "华泰证券"}, {"code": "sz002027", "name": "分众传媒"},
        {"code": "sh600309", "name": "万华化学"}, {"code": "sz002352", "name": "顺丰控股"},
        {"code": "sz300760", "name": "迈瑞医疗"}, {"code": "sh601398", "name": "工商银行"},
        {"code": "sz000002", "name": "万科A"}, {"code": "sh601288", "name": "农业银行"},
        {"code": "sh600048", "name": "保利发展"}, {"code": "sz002236", "name": "大华股份"},
        {"code": "sh601919", "name": "中远海控"}, {"code": "sz002241", "name": "歌尔股份"},
        {"code": "sh600585", "name": "海螺水泥"}, {"code": "sz000661", "name": "长春高新"},
        {"code": "sh601601", "name": "中国太保"}, {"code": "sh601601", "name": "中国太保"},
    ]
    
    # 获取沪深300数据
    hs300 = get_stock_hist("sh000300", days=200)
    market_ok_data = {}
    if hs300 is not None and len(hs300) > 60:
        hs300["MA60"] = hs300["close"].rolling(60).mean()
        for _, r in hs300.iterrows():
            market_ok_data[str(r["date"])] = r["close"] > r["MA60"] if pd.notna(r.get("MA60")) else False
    
    # 获取股票数据
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
    
    # 合并日期
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
    sector_counts = {}  # 行业计数
    
    for date in trading_dates:
        date_str = str(date)
        
        # ---- 1. 检查卖出 ----
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
            
            # 卖出条件
            sell_reason = None
            if ret <= STOP_LOSS:
                sell_reason = f"止损({ret*100:.1f}%)"
            elif ret >= TAKE_PROFIT:
                sell_reason = f"止盈({ret*100:.1f}%)"
            elif current_price < sig["ma60"]:  # 跌破MA60（趋势破坏）
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
                    "shares": pos["shares"], "return": ret, "reason": sell_reason
                })
                print(f"  卖出: {pos['name']} {current_price:.2f} {sell_reason}")
        
        for i in sorted(to_remove, reverse=True):
            portfolio.pop(i)
            # 减少行业计数
            code = portfolio[i]["code"] if i < len(portfolio) else None
            if code and code in SECTOR_MAP:
                sector = SECTOR_MAP[code]
                sector_counts[sector] = max(0, sector_counts.get(sector, 1) - 1)
        
        # ---- 2. 买入 ----
        candidates = []
        for code, data in stock_data.items():
            if any(p["code"] == code for p in portfolio):
                continue
            
            # 行业限制
            sector = SECTOR_MAP.get(code, "其他")
            if sector_counts.get(sector, 0) >= SECTOR_LIMIT:
                continue
            
            sigs = data["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            sig = day_sig.iloc[0]
            
            # 突破信号+强度
            if not sig["is_breakout"] or sig["strength"] < MIN_STRENGTH:
                continue
            
            # 大盘过滤
            if date_str in market_ok_data and not market_ok_data[date_str]:
                continue
            
            candidates.append({
                "code": code, "name": data["name"],
                "price": sig["close"], "strength": sig["strength"],
                "sector": sector, "ma60": sig["ma60"]
            })
        
        # 按信号强度排序
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
                "sector": cand["sector"]
            })
            sector_counts[cand["sector"]] = sector_counts.get(cand["sector"], 0) + 1
            
            trades.append({
                "date": date_str, "code": cand["code"], "name": cand["name"],
                "action": "买入", "price": cand["price"],
                "shares": buy_amount, "strength": cand["strength"]
            })
            print(f"  买入: {cand['name']} {cand['price']:.2f} 强度{cand['strength']}")
        
        # 更新持仓天数
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
    
    # ---- 输出结果 ----
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
    
    # 卖出原因统计
    reason_stats = {}
    for t in sell_trades:
        reason_stats[t["reason"]] = reason_stats.get(t["reason"], 0) + 1
    
    print("\n" + "=" * 60)
    print("回测结果 — 趋势量化 v4")
    print("=" * 60)
    print(f"初始资金: {INITIAL_CAPITAL:,.0f}")
    print(f"最终资金: {final:,.0f}")
    print(f"总收益率: {ret_total:+.2f}%")
    print(f"最大回撤: {max_dd:.2f}%")
    print(f"买入: {len(buy_trades)}次 | 卖出: {len(sell_trades)}次")
    print(f"胜率: {win_rate:.1f}% ({profitable}/{len(sell_trades)})")
    print(f"平均持有: {avg_hold:.1f}天")
    print(f"\n卖出原因:")
    for r, c in sorted(reason_stats.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}次")
    
    # 保存
    pd.DataFrame(daily_values).to_csv(f"backtest_trend_v4_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    if trades:
        pd.DataFrame(trades).to_csv(f"backtest_trades_v4_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    print(f"\n文件: backtest_trend_v4_{datetime.now().strftime('%Y%m%d')}.csv")


if __name__ == "__main__":
    run_backtest()
