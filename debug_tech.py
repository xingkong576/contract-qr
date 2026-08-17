# -*- coding: utf-8 -*-
import sys, io, json, pandas as pd, numpy as np
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import urllib.request

HEADERS = {'User-Agent': 'Mozilla/5.0'}

def get_tencent_hist(code, days=120):
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
            print(f"  {code}: no qfqday key, data keys: {list(j.get('data', {}).keys())[:5]}")
            return None
        records = []
        for row in d:
            if len(row) >= 6:
                records.append({
                    "date": row[0], "open": float(row[1]), "close": float(row[2]),
                    "high": float(row[3]), "low": float(row[4]), "volume": float(row[5]),
                })
        if records:
            return pd.DataFrame(records)
        print(f"  {code}: no records")
        return None
    except Exception as e:
        print(f"  {code}: exception {e}")
        return None

def calc_technicals(hist_df):
    if hist_df is None or not isinstance(hist_df, pd.DataFrame) or len(hist_df) < 20:
        return None
    df = hist_df.copy()
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
    delta = df["close"].diff()
    gain = delta.where(delta > 0, 0)
    loss = (-delta).where(delta < 0, 0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["RSI14"] = 100 - (100 / (1 + rs))
    df["BOLL_MID"] = df["close"].rolling(20).mean()
    boll_std = df["close"].rolling(20).std()
    df["BOLL_UP"] = df["BOLL_MID"] + 2 * boll_std
    df["BOLL_DN"] = df["BOLL_MID"] - 2 * boll_std
    low_min = df["low"].rolling(9).min()
    high_max = df["high"].rolling(9).max()
    rsv = (df["close"] - low_min) / (high_max - low_min).replace(0, np.nan) * 100
    df["K"] = rsv.ewm(com=2, adjust=False).mean()
    df["D"] = df["K"].ewm(com=2, adjust=False).mean()
    df["J"] = 3 * df["K"] - 2 * df["D"]
    return df

def analyze_signal(tech_df):
    if tech_df is None or not isinstance(tech_df, pd.DataFrame) or len(tech_df) < 20:
        return None
    latest = tech_df.iloc[-1]
    prev = tech_df.iloc[-2]
    price = latest["close"]
    
    above_ma5 = latest["MA5"] > 0 and price > latest["MA5"]
    above_ma10 = latest["MA10"] > 0 and price > latest["MA10"]
    above_ma20 = latest["MA20"] > 0 and price > latest["MA20"]
    above_ma60 = pd.notna(latest.get("MA60")) and latest["MA60"] > 0 and price > latest["MA60"]
    
    bull_arrange = (above_ma5 and above_ma10 and above_ma20 and
                    latest["MA5"] > latest["MA10"] and latest["MA10"] > latest["MA20"])
    
    vol_surge_5 = latest["volume"] > latest["Vol_MA5"] * 1.5
    vol_surge_20 = latest["volume"] > latest["Vol_MA20"] * 1.5
    vol_expand = latest["volume"] > latest["Vol_MA20"] * 2.0
    
    macd_golden = (prev["DIF"] <= prev["DEA"] and latest["DIF"] > latest["DEA"])
    macd_dead = (prev["DIF"] >= prev["DEA"] and latest["DIF"] < latest["DEA"])
    macd_above_zero = latest["DIF"] > 0 and latest["DEA"] > 0
    macd_increasing = latest["MACD"] > 0 and latest["MACD"] > prev["MACD"]
    
    rsi = latest["RSI14"]
    rsi_overbought = rsi > 70
    rsi_oversold = rsi < 30
    
    above_boll_up = latest["BOLL_UP"] > 0 and price > latest["BOLL_UP"]
    below_boll_dn = latest["BOLL_DN"] > 0 and price < latest["BOLL_DN"]
    near_boll_up = latest["BOLL_UP"] > 0 and price / latest["BOLL_UP"] > 0.95
    near_boll_dn = latest["BOLL_DN"] > 0 and price / latest["BOLL_DN"] < 1.05
    
    kdj_golden = (prev["K"] <= prev["D"] and latest["K"] > latest["D"])
    kdj_oversold = latest["J"] < 0
    kdj_overbought = latest["J"] > 100
    
    score = 0
    reasons = []
    
    if above_ma5: score += 1; reasons.append("MA5")
    if above_ma10: score += 1; reasons.append("MA10")
    if above_ma20: score += 1; reasons.append("MA20")
    if above_ma60: score += 1; reasons.append("MA60")
    if bull_arrange: score += 2; reasons.append("多头排列")
    if macd_golden: score += 3; reasons.append("MACD金叉")
    if macd_above_zero: score += 1; reasons.append("MACD零轴上")
    if macd_increasing: score += 1; reasons.append("MACD红柱")
    if vol_surge_5: score += 1; reasons.append("放量")
    if vol_expand: score += 2; reasons.append("倍量")
    if 40 <= rsi <= 60: score += 1; reasons.append("RSI中性")
    if rsi < 30: score += 2; reasons.append("RSI超卖")
    if kdj_golden: score += 2; reasons.append("KDJ金叉")
    if below_boll_dn: score += 2; reasons.append("布林下轨")
    if near_boll_up: score += 1; reasons.append("布林上轨")
    if macd_dead: score -= 2; reasons.append("MACD死叉")
    if rsi_overbought: score -= 1; reasons.append("RSI超买")
    if kdj_overbought: score -= 1; reasons.append("KDJ超买")
    
    return {
        "score": score, "price": round(price, 2),
        "above_ma5": above_ma5, "above_ma10": above_ma10,
        "above_ma20": above_ma20, "above_ma60": above_ma60,
        "bull_arrange": bull_arrange, "macd_golden": macd_golden,
        "kdj_golden": kdj_golden, "vol_surge_5": vol_surge_5,
        "rsi": round(rsi, 1), "reasons": "; ".join(reasons) if reasons else "无"
    }

# 测试
print("测试技术指标...")
for code in ["sh600519", "sz000001", "sh601318", "sz300750", "sh600036"]:
    print(f"\n{code}:")
    hist = get_tencent_hist(code, 120)
    print(f"  hist: {type(hist).__name__} len={len(hist) if hist is not None else 'N/A'}")
    
    if hist is not None:
        tech = calc_technicals(hist)
        print(f"  tech: {type(tech).__name__ if tech is not None else 'None'}")
        
        if tech is not None:
            signal = analyze_signal(tech)
            print(f"  signal: {signal}")
