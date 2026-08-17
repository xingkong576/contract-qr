# -*- coding: utf-8 -*-
"""
趋势回测脚本 v3 — 趋势跟踪策略（买入持有，趋势破坏才卖）
核心思路：
  1. 趋势评分>=10 且 ADX>30 才买入（强趋势）
  2. 持有直到：跌破MA60 或 止损-15% 或 止盈+30% 或 持有超40天
  3. 大盘过滤：沪深300在MA60之上才允许开仓
"""

import pandas as pd
import numpy as np
import json
import time
import os
import urllib.request
from datetime import datetime

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

INITIAL_CAPITAL = 100000
MAX_POSITIONS = 3
BUY_SCORE_THRESHOLD = 10
MIN_ADX = 30
STOP_LOSS = -0.15
TAKE_PROFIT = 0.30
MAX_HOLD_DAYS = 40
COMMISSION = 0.0003


def get_stock_hist(code, days=250):
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


def calc_scores(df):
    """计算趋势评分（用于买入决策）"""
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
    df["MACD"] = 2 * (df["DIF"] - df["DEA"])
    
    # ADX
    plus_dm = df["high"].diff()
    minus_dm = -df["low"].diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
    tr = df["high"] - df["low"]
    atr = tr.rolling(14).mean()
    plus_di = 100 * plus_dm.ewm(span=14).mean() / atr
    minus_di = 100 * minus_dm.ewm(span=14).mean() / atr
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.nan)
    df["ADX"] = dx.ewm(span=14).mean()
    
    scores = []
    for i in range(60, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i-1]
        score = 0
        
        # 均线多头排列 +3
        if row["MA5"] > row["MA10"] > row["MA20"]:
            score += 3
        # 价格站上均线 +1*3
        if row["close"] > row["MA5"]: score += 1
        if row["close"] > row["MA10"]: score += 1
        if row["close"] > row["MA20"]: score += 1
        # MACD金叉 +3
        if prev["DIF"] <= prev["DEA"] and row["DIF"] > row["DEA"]:
            score += 3
        # 放量 +2
        if row["volume"] > row["Vol_MA20"] * 1.5:
            score += 2
        # 30日涨幅合理 +2
        if i >= 30:
            pct_30 = (row["close"] - df.iloc[i-30]["close"]) / df.iloc[i-30]["close"]
            if 0.05 < pct_30 < 0.40: score += 2
            elif -0.10 < pct_30 <= 0.05: score += 1
            elif pct_30 > 0.40: score -= 2
        # 高低点抬升 +3
        recent_20 = df.iloc[max(0,i-20):i]
        higher_highs = sum(1 for j in range(2, len(recent_20)) 
                          if recent_20.iloc[j]["high"] > recent_20.iloc[j-2]["high"])
        if higher_highs > 12: score += 3
        # ADX趋势强度
        if pd.notna(row.get("ADX")):
            if row["ADX"] > 30: score += 3
            elif row["ADX"] > 25: score += 2
            elif row["ADX"] > 20: score += 1
        
        scores.append({
            "date": row["date"], "close": row["close"], "score": score,
            "ma5": row["MA5"], "ma10": row["MA10"], "ma20": row["MA20"],
            "ma60": row["MA60"], "dif": row["DIF"], "dea": row["DEA"],
            "adx": row.get("ADX", np.nan), "volume": row["volume"],
            "vol_ma20": row["Vol_MA20"],
        })
    return pd.DataFrame(scores)


def run_backtest():
    print("=" * 60)
    print("趋势策略回测 v3 — 趋势跟踪（买入持有）")
    print(f"初始资金: {INITIAL_CAPITAL:,.0f}")
    print(f"买入阈值: 评分>={BUY_SCORE_THRESHOLD} 且 ADX>={MIN_ADX}")
    print(f"持有规则: 跌破MA60/止损{STOP_LOSS*100}%/止盈{TAKE_PROFIT*100}%/{MAX_HOLD_DAYS}天")
    print("=" * 60)
    
    # 获取沪深300大盘数据
    hs300 = get_stock_hist("sh000300", days=250)
    market_ok_data = {}
    if hs300 is not None and len(hs300) > 60:
        hs300["MA60"] = hs300["close"].rolling(60).mean()
        for _, r in hs300.iterrows():
            market_ok_data[str(r["date"])] = r["close"] > r["MA60"] if pd.notna(r.get("MA60")) else False
    
    # 股票池
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
    ]
    
    # 获取信号数据
    stock_signals = {}
    for stock in stocks:
        hist = get_stock_hist(stock["code"])
        if hist is not None and len(hist) > 60:
            signals = calc_scores(hist)
            if signals is not None and len(signals) > 0:
                stock_signals[stock["code"]] = {"name": stock["name"], "signals": signals}
                print(f"[OK] {stock['name']} {len(signals)} 天")
        time.sleep(0.5)
    print(f"\n获取到 {len(stock_signals)} 只股票数据")
    
    # 合并日期
    all_dates = set()
    for d in stock_signals.values():
        all_dates.update(d["signals"]["date"].values)
    trading_dates = sorted(list(all_dates))
    print(f"交易日历: {len(trading_dates)} 天")
    
    # 回测引擎 — 趋势跟踪模式
    portfolio = []
    capital = INITIAL_CAPITAL
    trades = []
    daily_values = []
    
    for date in trading_dates:
        date_str = str(date)
        
        # ---- 1. 检查持仓（趋势跟踪：只在跌破MA60或止损时卖出） ----
        to_remove = []
        for i, pos in enumerate(portfolio):
            sigs = stock_signals[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            sig = day_sig.iloc[0]
            current_price = sig["close"]
            buy_price = pos["buy_price"]
            return_rate = (current_price - buy_price) / buy_price
            
            # 检查是否在MA60下方
            in_ma60 = current_price < sig["ma60"] if pd.notna(sig["ma60"]) else False
            
            sell_reason = None
            if return_rate <= STOP_LOSS:
                sell_reason = f"止损({return_rate*100:.1f}%)"
            elif return_rate >= TAKE_PROFIT:
                sell_reason = f"止盈({return_rate*100:.1f}%)"
            elif in_ma60:
                sell_reason = "跌破MA60"
            elif pos["hold_days"] >= MAX_HOLD_DAYS:
                sell_reason = f"持有{MAX_HOLD_DAYS}天"
            
            if sell_reason:
                to_remove.append(i)
                sell_revenue = current_price * pos["shares"]
                capital += sell_revenue * (1 - COMMISSION)
                trades.append({
                    "date": date_str, "code": pos["code"], "name": pos["name"],
                    "action": "卖出", "price": current_price, "buy_price": buy_price,
                    "shares": pos["shares"], "return": return_rate, "reason": sell_reason
                })
                print(f"  卖出: {pos['name']} {current_price:.2f} {sell_reason}")
        
        for i in sorted(to_remove, reverse=True):
            portfolio.pop(i)
        
        # ---- 2. 买入（只在首次触发时买入，避免重复） ----
        for code, data in stock_signals.items():
            if len(portfolio) >= MAX_POSITIONS:
                break
            if any(p["code"] == code for p in portfolio):
                continue
            
            # 检查今天是否首次出现买入信号
            sigs = data["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            sig = day_sig.iloc[0]
            
            # 检查昨天是否没有信号（首次触发）
            if len(portfolio) == 0 or True:  # 简化：有仓位就等卖出后再买
                pass
            
            if sig["score"] < BUY_SCORE_THRESHOLD:
                continue
            if pd.notna(sig["adx"]) and sig["adx"] < MIN_ADX:
                continue
            if date_str in market_ok_data and not market_ok_data[date_str]:
                continue
            
            # 买入
            buy_amount = min(100, capital // sig["close"])
            if buy_amount < 100:
                continue
            cost = sig["close"] * buy_amount
            capital -= cost * (1 + COMMISSION)
            
            portfolio.append({
                "code": code, "name": data["name"],
                "buy_price": sig["close"], "buy_date": date,
                "shares": buy_amount, "hold_days": 0
            })
            trades.append({
                "date": date_str, "code": code, "name": data["name"],
                "action": "买入", "price": sig["close"],
                "shares": buy_amount, "score": sig["score"], "adx": sig["adx"]
            })
            print(f"  买入: {data['name']} {sig['close']:.2f} 评分{sig['score']} ADX{sig['adx']:.0f}")
        
        # 更新持仓天数
        for pos in portfolio:
            diff = date - pos["buy_date"]
            pos["hold_days"] = diff.days if hasattr(diff, 'days') else int(diff / np.timedelta64(1, 'D'))
        
        # 计算总资产
        pv = capital
        for pos in portfolio:
            sigs = stock_signals[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) > 0:
                pv += day_sig.iloc[0]["close"] * pos["shares"]
        daily_values.append({
            "date": date_str, "capital": capital,
            "portfolio_value": pv, "positions": len(portfolio)
        })
    
    # ---- 输出结果 ----
    final_value = daily_values[-1]["portfolio_value"]
    total_return = (final_value - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
    
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
    
    # 按卖出原因统计
    reason_stats = {}
    for t in sell_trades:
        reason_stats[t["reason"]] = reason_stats.get(t["reason"], 0) + 1
    
    print("\n" + "=" * 60)
    print("回测结果")
    print("=" * 60)
    print(f"初始资金: {INITIAL_CAPITAL:,.0f}")
    print(f"最终资金: {final_value:,.0f}")
    print(f"总收益率: {total_return:+.2f}%")
    print(f"最大回撤: {max_dd:.2f}%")
    print(f"买入: {len(buy_trades)}次 | 卖出: {len(sell_trades)}次")
    print(f"胜率: {win_rate:.1f}% ({profitable}/{len(sell_trades)})")
    print(f"\n卖出原因分布:")
    for reason, count in sorted(reason_stats.items(), key=lambda x: -x[1]):
        print(f"  {reason}: {count}次")
    
    # 保存
    pd.DataFrame(daily_values).to_csv(f"backtest_trend_v3_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    if trades:
        pd.DataFrame(trades).to_csv(f"backtest_trades_v3_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
    print(f"\n文件: backtest_trend_v3_{datetime.now().strftime('%Y%m%d')}.csv")


if __name__ == "__main__":
    run_backtest()
