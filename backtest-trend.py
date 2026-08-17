# -*- coding: utf-8 -*-
"""
趋势回测脚本 v2 — 基于真实数据回测
用法: python backtest-trend.py
"""

import pandas as pd
import numpy as np
import json
import time
import os
import urllib.request
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

# 回测配置
COMMISSION = 0.0003  # 手续费万分之三（买卖双向）
INITIAL_CAPITAL = 100000
MAX_POSITIONS = 3
BUY_SCORE_THRESHOLD = 10       # 提高买入阈值，只做高质量信号
SELL_SCORE_THRESHOLD = 2       # 降低卖出阈值，减少频繁止损
MIN_HOLD_DAYS = 10              # 延长最少持有10天
MAX_HOLD_DAYS = 30             # 最长持有30天
STOP_LOSS = -0.15              # 止损-15%
TAKE_PROFIT = 0.25             # 止盈+25%
MIN_ADX = 25                   # 最小ADX趋势强度，只做有趋势的票


def get_stock_hist(code, days=250):
    """获取股票历史数据"""
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
                    "date": row[0],
                    "open": float(row[1]),
                    "close": float(row[2]),
                    "high": float(row[3]),
                    "low": float(row[4]),
                    "volume": float(row[5]),
                })
        
        if records:
            df = pd.DataFrame(records)
            df['date'] = pd.to_datetime(df['date'])
            return df
        return None
    except:
        return None


def calc_scores(df):
    """计算每日趋势评分"""
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
    df["MACD"] = 2 * (df["DIF"] - df["DEA"])
    
    # ADX趋势强度
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
    
    # 趋势强度评分（单独计算，用于ADX过滤）
    df["trend_strength"] = 0
    for i in range(60, len(df)):
        r = df.iloc[i]
        ts = 0
        if pd.notna(r.get("ADX")):
            if r["ADX"] > 30: ts += 3
            elif r["ADX"] > 25: ts += 2
            elif r["ADX"] > 20: ts += 1
        df.iloc[i, df.columns.get_loc("trend_strength")] = ts
    
    scores = []
    for i in range(60, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i-1]
        score = 0
        
        # 均线多头
        if row["MA5"] > row["MA10"] > row["MA20"]:
            score += 3
        
        # 价格站上均线
        if row["close"] > row["MA5"]: score += 1
        if row["close"] > row["MA10"]: score += 1
        if row["close"] > row["MA20"]: score += 1
        
        # MACD金叉
        if prev["DIF"] <= prev["DEA"] and row["DIF"] > row["DEA"]:
            score += 3
        
        # 放量
        if row["volume"] > row["Vol_MA20"] * 1.5:
            score += 2
        
        # 30日涨幅过滤（避免追高）
        if i >= 30:
            pct_30 = (row["close"] - df.iloc[i-30]["close"]) / df.iloc[i-30]["close"]
            if 0.05 < pct_30 < 0.40:  # 5%-40%涨幅最佳
                score += 2
            elif -0.10 < pct_30 <= 0.05:  # 下跌或持平，可低吸
                score += 1
            elif pct_30 > 0.40:  # 涨幅过大，减分
                score -= 2
        
        # 趋势强化（高低点抬升）
        recent_20 = df.iloc[max(0,i-20):i]
        higher_highs = sum(1 for j in range(2, len(recent_20)) 
                          if recent_20.iloc[j]["high"] > recent_20.iloc[j-2]["high"])
        if higher_highs > 12:  # >60%
            score += 3
        
        # ADX趋势强度
        if pd.notna(row.get("ADX")) and row["ADX"] > 25:
            score += 2
        elif pd.notna(row.get("ADX")) and row["ADX"] > 20:
            score += 1
        
        scores.append({
            "date": row["date"],
            "close": row["close"],
            "score": score,
            "ma5": row["MA5"],
            "ma10": row["MA10"],
            "ma20": row["MA20"],
            "ma60": row["MA60"],
            "dif": row["DIF"],
            "dea": row["DEA"],
            "volume": row["volume"],
            "vol_ma20": row["Vol_MA20"],
            "adx": row.get("ADX", np.nan),
            "trend_strength": row.get("trend_strength", 0),
        })
    
    return pd.DataFrame(scores)


def run_backtest():
    """运行回测"""
    print("=" * 60)
    print("趋势策略回测 v2")
    print(f"初始资金: {INITIAL_CAPITAL:,.0f}")
    print("=" * 60)
    
    # 先获取沪深300作为大盘基准
    hs300_hist = get_stock_hist("sh000300", days=250)
    market_ok = True  # 大盘状态
    if hs300_hist is not None and len(hs300_hist) > 60:
        hs300_hist["MA60"] = hs300_hist["close"].rolling(60).mean()
        # 标记每天大盘是否在MA60之上
        market_ok_data = {}
        for _, row in hs300_hist.iterrows():
            market_ok_data[str(row["date"])] = row["close"] > row["MA60"] if pd.notna(row.get("MA60")) else False
    else:
        market_ok_data = {}  # 无法获取大盘数据，默认放行
    
    # 测试股票池
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
    
    # 获取数据
    stock_signals = {}
    for stock in stocks:
        hist = get_stock_hist(stock["code"])
        if hist is not None and len(hist) > 60:
            signals = calc_scores(hist)
            if signals is not None and len(signals) > 0:
                stock_signals[stock["code"]] = {
                    "name": stock["name"],
                    "signals": signals
                }
                print(f"[OK] {stock['name']} {len(signals)} 天数据")
            else:
                print(f"[X] {stock['name']} 无评分数据")
        else:
            print(f"✗ {stock['name']} 无历史数据")
        time.sleep(0.5)
    
    print(f"\n获取到 {len(stock_signals)} 只股票信号数据")
    
    if not stock_signals:
        print("\n没有获取到数据，回测终止")
        return
    
    # 合并所有信号
    all_dates = set()
    for code, data in stock_signals.items():
        all_dates.update(data["signals"]["date"].values)
    
    trading_dates = sorted(list(all_dates))
    print(f"回测日历: {len(trading_dates)} 天")
    
    # 回测引擎
    portfolio = []  # 持仓
    capital = INITIAL_CAPITAL
    trades = []     # 交易记录
    daily_values = []  # 每日资产
    
    for date in trading_dates:
        # 1. 检查卖出信号
        to_remove = []
        for i, pos in enumerate(portfolio):
            # 获取该股票当日信号
            sigs = stock_signals[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            
            if len(day_sig) == 0:
                continue
                
            sig = day_sig.iloc[0]
            current_price = sig["close"]
            buy_price = pos["buy_price"]
            return_rate = (current_price - buy_price) / buy_price
            
            # 卖出条件
            sell_reason = None
            if return_rate <= STOP_LOSS:
                sell_reason = f"止损({return_rate*100:.1f}%)"
            elif return_rate >= TAKE_PROFIT:
                sell_reason = f"止盈({return_rate*100:.1f}%)"
            elif pos["hold_days"] >= MAX_HOLD_DAYS:
                sell_reason = f"持有{MAX_HOLD_DAYS}天"
            elif pos["hold_days"] >= MIN_HOLD_DAYS and sig["score"] <= SELL_SCORE_THRESHOLD:
                sell_reason = f"评分<={SELL_SCORE_THRESHOLD}+持{pos['hold_days']}天"
            
            if sell_reason:
                to_remove.append(i)
                sell_revenue = current_price * pos["shares"]
                sell_commission = sell_revenue * COMMISSION
                capital += (sell_revenue - sell_commission)
                if return_rate < 0:
                    return_rate_net = (sell_revenue - sell_commission - buy_price * pos["shares"]) / (buy_price * pos["shares"])
                else:
                    return_rate_net = return_rate - COMMISSION * 2 / (1 + return_rate)  # 简化计算
                trades.append({
                    "date": str(date),
                    "code": pos["code"],
                    "name": pos["name"],
                    "action": "卖出",
                    "price": current_price,
                    "buy_price": buy_price,
                    "shares": pos["shares"],
                    "return": return_rate_net,
                    "reason": sell_reason
                })
                print(f"  卖出: {pos['name']} {current_price:.2f} {sell_reason}")
        
        # 移除已卖出
        for i in sorted(to_remove, reverse=True):
            portfolio.pop(i)
        
        # 2. 检查买入信号
        buy_candidates = []
        for code, data in stock_signals.items():
            if any(p["code"] == code for p in portfolio):
                continue
            
            sigs = data["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) == 0:
                continue
            
            sig = day_sig.iloc[0]
            if sig["score"] < BUY_SCORE_THRESHOLD:
                continue
            
            # ADX硬性过滤：只做有趋势的票
            if pd.notna(sig.get("adx")) and sig["adx"] < MIN_ADX:
                continue
            
            # 大盘过滤：上证/沪深300在MA60之上才买
            date_str = str(date)
            if date_str in market_ok_data:
                if not market_ok_data[date_str]:
                    continue  # 大盘弱势，不买入
            
            buy_candidates.append({
                "code": code,
                "name": data["name"],
                "price": sig["close"],
                "score": sig["score"],
                "adx": sig.get("adx", 0),
                "market_ok": date_str in market_ok_data and market_ok_data[date_str]
            })
        
        # 按评分排序买入
        buy_candidates.sort(key=lambda x: x["score"], reverse=True)
        
        for cand in buy_candidates:
            if len(portfolio) >= MAX_POSITIONS:
                break
            
            if capital >= cand["price"] * 100:
                buy_amount = min(100, capital // cand["price"])
                cost = cand["price"] * buy_amount
                commission = cost * COMMISSION
                capital -= (cost + commission)
                
                portfolio.append({
                    "code": cand["code"],
                    "name": cand["name"],
                    "buy_price": cand["price"],
                    "buy_date": date,
                    "shares": buy_amount,
                    "hold_days": 0
                })
                
                trades.append({
                    "date": str(date),
                    "code": cand["code"],
                    "name": cand["name"],
                    "action": "买入",
                    "price": cand["price"],
                    "shares": buy_amount,
                    "score": cand["score"]
                })
                
                print(f"  买入: {cand['name']} {cand['price']:.2f} 评分{cand['score']}")
        
        # 更新持仓天数
        for pos in portfolio:
            diff = date - pos["buy_date"]
            if hasattr(diff, 'days'):
                pos["hold_days"] = diff.days
            else:
                pos["hold_days"] = int(diff / np.timedelta64(1, 'D'))
        
        # 计算总资产
        portfolio_value = capital
        for pos in portfolio:
            sigs = stock_signals[pos["code"]]["signals"]
            day_sig = sigs[sigs["date"] == date]
            if len(day_sig) > 0:
                price = day_sig.iloc[0]["close"]
                portfolio_value += price * pos["shares"]
        
        daily_values.append({
            "date": str(date),
            "capital": capital,
            "portfolio_value": portfolio_value,
            "positions": len(portfolio)
        })
    
    # 输出结果
    if daily_values:
        final_value = daily_values[-1]["portfolio_value"]
        total_return = (final_value - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
        
        # 计算最大回撤
        peak = 0
        max_drawdown = 0
        for dv in daily_values:
            if dv["portfolio_value"] > peak:
                peak = dv["portfolio_value"]
            dd = (peak - dv["portfolio_value"]) / peak * 100
            if dd > max_drawdown:
                max_drawdown = dd
        
        # 统计交易
        buy_trades = [t for t in trades if t["action"] == "买入"]
        sell_trades = [t for t in trades if t["action"] == "卖出"]
        
        print("\n" + "=" * 60)
        print("回测结果")
        print("=" * 60)
        print(f"初始资金: {INITIAL_CAPITAL:,.0f}")
        print(f"最终资金: {final_value:,.0f}")
        print(f"总收益率: {total_return:+.2f}%")
        print(f"最大回撤: {max_drawdown:.2f}%")
        print(f"买入次数: {len(buy_trades)}")
        print(f"卖出次数: {len(sell_trades)}")
        print(f"交易天数: {len(daily_values)}")
        
        # 保存结果
        df_daily = pd.DataFrame(daily_values)
        df_daily.to_csv(f"backtest_trend_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
        print(f"\n每日记录: backtest_trend_{datetime.now().strftime('%Y%m%d')}.csv")
        
        if sell_trades:
            # 计算胜率
            profitable = sum(1 for t in sell_trades if t["return"] > 0)
            win_rate = profitable / len(sell_trades) * 100
            print(f"胜率: {win_rate:.1f}% ({profitable}/{len(sell_trades)})")
        
        # 保存交易记录
        if trades:
            df_trades = pd.DataFrame(trades)
            df_trades.to_csv(f"backtest_trades_{datetime.now().strftime('%Y%m%d')}.csv", index=False)
            print(f"交易记录: backtest_trades_{datetime.now().strftime('%Y%m%d')}.csv")


if __name__ == "__main__":
    run_backtest()
