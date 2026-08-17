# -*- coding: utf-8 -*-
"""
趋势启动捕捉回测 — 突破策略（Breakout）
核心思路：
  1. 寻找股价站上20日均线 + 放量 + MACD金叉的"启动点"
  2. 买入后持有直到：跌破10日均线 / 止盈+25% / 持有超20天
  3. 排除震荡期：布林带收窄程度 > 5% 才认为是有效突破
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
MAX_POSITIONS = 3
STOP_LOSS = -0.12          # 止损-12%（略放宽）
TAKE_PROFIT = 0.20         # 止盈20%（更容易触发）
MAX_HOLD_DAYS = 15         # 最长持有15天
MIN_STRENGTH = 4           # 最小信号强度
COMMISSION = 0.0003        # 手续费万分之三
MIN_VOL_RATIO = 1.5        # 最小放量倍数


def get_hist(code, days=120):
    url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={code},day,,,{days},qfq"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=15)
        j = json.loads(resp.read().decode('utf-8'))
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
    """计算每日信号，返回包含启动点的DataFrame"""
    if df is None or len(df) < 40:
        return None
    
    df = df.copy()
    df["MA5"] = df["close"].rolling(5).mean()
    df["MA10"] = df["close"].rolling(10).mean()
    df["MA20"] = df["close"].rolling(20).mean()
    df["Vol_MA5"] = df["volume"].rolling(5).mean()
    df["Vol_MA20"] = df["volume"].rolling(20).mean()
    
    # MACD
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["DIF"] = ema12 - ema26
    df["DEA"] = df["DIF"].ewm(span=9, adjust=False).mean()
    
    # 布林带宽度（用于过滤震荡）
    df["BB_MID"] = df["close"].rolling(20).mean()
    df["BB_STD"] = df["close"].rolling(20).std()
    df["BB_WIDTH"] = 2 * df["BB_STD"] / df["BB_MID"] * 100  # 布林带宽度百分比
    
    # 20日最高价（用于突破判断）
    df["HH20"] = df["high"].rolling(20).max()
    
    signals = []
    for i in range(20, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i-1]
        
        signal = {
            "date": row["date"],
            "close": row["close"],
            "ma5": row["MA5"],
            "ma10": row["MA10"],
            "ma20": row["MA20"],
            "volume": row["volume"],
            "vol_ma20": row["Vol_MA20"],
            "dif": row["DIF"],
            "dea": row["DEA"],
            "bb_width": row.get("BB_WIDTH", 0),
            "hh20": row["HH20"],
        }
        
        # ======== 启动点检测 ========
        is_start_point = True
        
        # 条件1: 收盘价站上MA20
        if row["close"] < row["MA20"]:
            is_start_point = False
        
        # 条件2: MA5 > MA10（短期均线拐头向上）
        if not (row["MA5"] > row["MA10"]):
            is_start_point = False
        
        # 条件3: MACD金叉（DIF上穿DEA，或刚金叉不久）
        macd_golden = (prev["DIF"] <= prev["DEA"] and row["DIF"] > row["DEA"])
        macd_recent = row["DIF"] > row["DEA"] and row["DIF"] > 0
        if not (macd_golden or macd_recent):
            is_start_point = False
        
        # 条件4: 放量（成交量 > 20日均量 * MIN_VOL_RATIO）
        if row["volume"] < row["Vol_MA20"] * MIN_VOL_RATIO:
            is_start_point = False
        
        # 条件5: 布林带宽度 > 2%（不是极致震荡）
        if row.get("BB_WIDTH", 0) < 2:
            is_start_point = False
        
        # 条件6: 20日相对低点（涨幅从低点算 >= 3%）
        if i >= 20:
            low_20 = df.iloc[i-20:i]["low"].min()
            pct_from_low = (row["close"] - low_20) / low_20
            if pct_from_low < 0.03:
                is_start_point = False
        
        signal["is_start_point"] = is_start_point
        signal["strength"] = 0  # 信号强度
        
        if is_start_point:
            # 计算信号强度分（满分10）
            st = 0
            if row["MA5"] > row["MA10"] > row["MA20"]: st += 2  # 完美排列
            if row["close"] > row["MA20"] * 1.02: st += 1      # 远离MA20 > 2%
            vol_ratio = row["volume"] / row["Vol_MA20"]
            if vol_ratio > 2.5: st += 2  # 2.5倍量
            elif vol_ratio > 2: st += 1.5
            elif vol_ratio > 1.5: st += 1
            if row["DIF"] > 0: st += 1  # MACD零轴上方
            if row["close"] >= row["HH20"]: st += 1  # 突破20日高点
            elif row["close"] >= row["HH20"] * 0.98: st += 0.5  # 接近突破
            # 连续缩量后放量（蓄势突破）
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
    print("趋势启动捕捉回测 — 突破策略 v1")
    print("=" * 60)
    
    # 股票池（主板+SME）
    stocks = [
        {"code": "sh600519", "name": "贵州茅台"},
        {"code": "sz000858", "name": "五粮液"},
        {"code": "sh601318", "name": "中国平安"},
        {"code": "sz002594", "name": "比亚迪"},
        {"code": "sh600036", "name": "招商银行"},
        {"code": "sh600900", "name": "长江电力"},
        {"code": "sz002714", "name": "牧原股份"},
        {"code": "sh601888", "name": "中国中免"},
        {"code": "sz000333", "name": "美的集团"},
        {"code": "sh600276", "name": "恒瑞医药"},
        {"code": "sz000001", "name": "平安银行"},
        {"code": "sz002475", "name": "立讯精密"},
        {"code": "sz002230", "name": "科大讯飞"},
        {"code": "sh601012", "name": "隆基绿能"},
        {"code": "sz002718", "name": "友邦整装"},
    ]
    
    # 获取数据
    stock_data = {}
    for stock in stocks:
        hist = get_hist(stock["code"])
        if hist is not None and len(hist) > 30:
            signals = calc_signals(hist)
            if signals is not None and len(signals) > 0:
                stock_data[stock["code"]] = {"name": stock["name"], "signals": signals}
                start_points = signals[signals["is_start_point"]].shape[0]
                print(f"[OK] {stock['name']} {len(signals)}天, 启动点{start_points}次")
        time.sleep(0.5)
    
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
            elif current_price < sig["ma20"]:  # 跌破MA20
                sell_reason = "跌破MA20"
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
        
        # ---- 2. 买入 ----
        # 按信号强度排序找最佳候选
        candidates = []
        for code, data in stock_data.items():
            if any(p["code"] == code for p in portfolio):
                continue
            sigs = data["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            sig = day_sig.iloc[0]
            if sig["is_start_point"] and sig["strength"] >= MIN_STRENGTH:
                candidates.append({
                    "code": code, "name": data["name"],
                    "price": sig["close"], "strength": sig["strength"],
                    "ma20": sig["ma20"],
                    "vol_ratio": sig["volume"] / sig["vol_ma20"] if sig["vol_ma20"] > 0 else 0
                })
        
        # 按信号强度排序
        candidates.sort(key=lambda x: x["strength"], reverse=True)
        
        for cand in candidates:
            if len(portfolio) >= MAX_POSITIONS:
                break
            
            buy_amount = min(100, capital // cand["price"])
            if buy_amount < 100:
                continue
            
            cost = cand["price"] * buy_amount
            capital -= cost * (1 + COMMISSION)
            
            portfolio.append({
                "code": cand["code"], "name": cand["name"],
                "buy_price": cand["price"], "buy_date": date,
                "shares": buy_amount, "hold_days": 0
            })
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
    
    # 平均持有天数
    avg_hold = np.mean([t.get("hold_days", 0) for t in sell_trades]) if sell_trades else 0
    
    # 卖出原因
    reason_stats = {}
    for t in sell_trades:
        reason_stats[t["reason"]] = reason_stats.get(t["reason"], 0) + 1
    
    print("\n" + "=" * 60)
    print("回测结果 — 趋势启动捕捉")
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
    pd.DataFrame(daily_values).to_csv(f"backtest_breakout_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    if trades:
        pd.DataFrame(trades).to_csv(f"backtest_trades_breakout_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    print(f"\n文件: backtest_breakout_{datetime.now().strftime('%Y%m%d')}.csv")


if __name__ == "__main__":
    run_backtest()
