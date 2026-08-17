# -*- coding: utf-8 -*-
"""
趋势选股脚本 v1 — 腾讯数据源 + 趋势量化分析
用法: python trend-screener.py

趋势分析维度：
1. 均线趋势: 多头排列、均线角度、均线收敛/发散
2. 价格趋势: 高低点抬升、趋势线突破
3. 趋势强度: ADX、趋势斜率
4. 成交量趋势: 量价配合、趋势放量
5. 形态趋势: 上升通道、平台突破、头肩底

数据源：腾讯财经（qt.gtimg.cn）— 稳定免费
"""

import sys
import os
import io
import pandas as pd
import numpy as np
import json
import time
import urllib.request
from datetime import datetime

# CSV输出目录
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "meitiangupiao")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}


# ============================================================
# 数据获取
# ============================================================

def get_tencent_quotes(codes):
    """腾讯批量实时行情"""
    all_data = {}
    for i in range(0, len(codes), 800):
        batch = codes[i:i+800]
        query = ",".join(batch)
        url = f"http://qt.gtimg.cn/q={query}"
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            resp = urllib.request.urlopen(req, timeout=30)
            data = resp.read().decode('gbk')
        except Exception as e:
            print(f"  [错误] 批量 {i//800+1} 获取失败: {e}")
            continue

        for line in data.strip().split("\n"):
            if not line or "=" not in line:
                continue
            parts = line.split("~")
            code = parts[2] if len(parts) > 2 else ""
            if not code:
                continue
            try:
                all_data[code] = {
                    "code": code,
                    "name": parts[1] if len(parts) > 1 else "",
                    "price": float(parts[3]) if len(parts) > 3 and parts[3] else 0,
                    "prev_close": float(parts[4]) if len(parts) > 4 and parts[4] else 0,
                    "open": float(parts[5]) if len(parts) > 5 and parts[5] else 0,
                    "volume": float(parts[6]) if len(parts) > 6 and parts[6] else 0,
                    "high": float(parts[23]) if len(parts) > 23 and parts[23] else 0,
                    "low": float(parts[24]) if len(parts) > 24 and parts[24] else 0,
                    "amount": float(parts[31]) if len(parts) > 31 and parts[31] else 0,
                    "pct_change": float(parts[32]) if len(parts) > 32 and parts[32] else 0,
                    "turnover": float(parts[33]) if len(parts) > 33 and parts[33] else 0,
                }
            except (ValueError, IndexError):
                continue
    return all_data


def get_tencent_hist(code, days=120):
    """
    腾讯历史日K（前复权）
    返回 DataFrame: [日期, 开盘, 收盘, 最高, 最低, 成交量]
    """
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
            return pd.DataFrame(records)
        return None
    except Exception as e:
        return None


# ============================================================
# 技术面分析（复用astock-screener中的技术指标）
# ============================================================

def calc_technicals(hist_df):
    """计算技术指标（MA/MACD/RSI/布林带/KDJ）"""
    if hist_df is None or not isinstance(hist_df, pd.DataFrame) or len(hist_df) < 20:
        return None
    df = hist_df.copy()
    df["MA5"] = df["close"].rolling(5).mean()
    df["MA10"] = df["close"].rolling(10).mean()
    df["MA20"] = df["close"].rolling(20).mean()
    df["MA60"] = df["close"].rolling(60).mean() if len(df) >= 60 else np.nan
    df["MA120"] = df["close"].rolling(120).mean() if len(df) >= 120 else np.nan
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


# ============================================================
# 趋势分析
# ============================================================

def calc_trend(tech_df):
    """
    计算趋势指标
    """
    if tech_df is None or not isinstance(tech_df, pd.DataFrame) or len(tech_df) < 60:
        return None

    df = tech_df.copy()
    latest = df.iloc[-1]
    price = latest["close"]

    # ---- 均线趋势 ----
    # 均线角度（用MA20的斜率，换算成角度）
    ma20_slope = (latest["MA20"] - df.iloc[-21]["MA20"]) / df.iloc[-21]["MA20"] if df.iloc[-21]["MA20"] > 0 else 0
    ma60_slope = (latest["MA60"] - df.iloc[-61]["MA60"]) / df.iloc[-61]["MA60"] if len(df) >= 61 and df.iloc[-61]["MA60"] > 0 else 0
    ma20_angle = np.degrees(np.arctan(ma20_slope))  # 角度
    ma60_angle = np.degrees(np.arctan(ma60_slope))

    # 均线发散度：MA5/MA20价差百分比
    ma_dispersion = (latest["MA5"] - latest["MA20"]) / latest["MA20"] * 100 if latest["MA20"] > 0 else 0

    # 均线收敛：看MA5和MA20是否越来越近
    prev_ma5 = df.iloc[-2]["MA5"]
    prev_ma20 = df.iloc[-2]["MA20"]
    prev_diff = abs(prev_ma5 - prev_ma20)
    curr_diff = abs(latest["MA5"] - latest["MA20"])
    ma_converging = curr_diff < prev_diff
    ma_diverging = curr_diff > prev_diff * 1.1

    # 多头排列强度
    ma_bull_strength = 0
    if latest["MA5"] > latest["MA10"] > latest["MA20"]:
        ma_bull_strength += 1
    if latest["MA10"] > latest["MA20"]:
        ma_bull_strength += 1
    if pd.notna(latest.get("MA60")) and latest["MA20"] > latest["MA60"]:
        ma_bull_strength += 1
    if pd.notna(latest.get("MA60")) and latest["MA10"] > latest["MA60"]:
        ma_bull_strength += 1
    if pd.notna(latest.get("MA60")) and latest["MA5"] > latest["MA60"]:
        ma_bull_strength += 1

    # ---- 价格趋势 ----
    # 30日高低点抬升
    recent_20 = df.tail(20)
    higher_highs = 0
    higher_lows = 0
    for i in range(2, len(recent_20)):
        if recent_20.iloc[i]["high"] > recent_20.iloc[i-2]["high"]:
            higher_highs += 1
        if recent_20.iloc[i]["low"] > recent_20.iloc[i-2]["low"]:
            higher_lows += 1
    hh_ratio = higher_highs / (len(recent_20) - 2)
    hl_ratio = higher_lows / (len(recent_20) - 2)
    trend_up_strengthen = hh_ratio > 0.6 and hl_ratio > 0.6

    # 趋势斜率（线性回归）
    try:
        x = np.arange(len(df))
        slope, _, _, _, _ = np.polyfit(x, df["close"].values, 1, full=False, cov=True)
        trend_slope = slope
        trend_angle = np.degrees(np.arctan(slope / price * 100))  # 年化角度
    except:
        trend_slope = 0
        trend_angle = 0

    # 30日涨幅
    pct_30 = (price - df.iloc[-31]["close"]) / df.iloc[-31]["close"] * 100 if len(df) >= 31 and df.iloc[-31]["close"] > 0 else 0
    pct_60 = (price - df.iloc[-61]["close"]) / df.iloc[-61]["close"] * 100 if len(df) >= 61 and df.iloc[-61]["close"] > 0 else 0

    # ---- ADX趋势强度 ----
    # 简化版ADX
    if len(df) >= 14:
        high_14 = df["high"].rolling(14).max()
        low_14 = df["low"].rolling(14).min()
        tr = df["high"] - df["low"]
        tr_14 = tr.rolling(14).mean()
        dm_plus = np.where((df["high"].diff() > df["low"].diff()) & (df["high"].diff() > 0), df["high"].diff(), 0)
        dm_minus = np.where((df["low"].diff() < 0) & (-df["low"].diff() > df["high"].diff()), -df["low"].diff(), 0)
        dm_plus_smooth = pd.Series(dm_plus).ewm(span=14, adjust=False).mean()
        dm_minus_smooth = pd.Series(dm_minus).ewm(span=14, adjust=False).mean()
        dx = 100 * dm_plus_smooth / (dm_plus_smooth + dm_minus_smooth).replace(0, np.nan)
        adx = dx.ewm(span=14, adjust=False).mean()
        latest_adx = adx.iloc[-1] if not pd.isna(adx.iloc[-1]) else 0
    else:
        latest_adx = 0

    # ---- 成交量趋势 ----
    vol_ma5 = latest["volume"] / latest["Vol_MA5"] if latest["Vol_MA5"] > 0 else 1
    vol_ma20 = latest["volume"] / latest["Vol_MA20"] if latest["Vol_MA20"] > 0 else 1
    vol_trend = vol_ma5 > vol_ma20  # 短期成交量趋势向上

    # 量价配合
    price_up_vol_up = (df["close"].iloc[-1] > df["close"].iloc[-2]) and (df["volume"].iloc[-1] > df["volume"].iloc[-2])
    price_down_vol_down = (df["close"].iloc[-1] < df["close"].iloc[-2]) and (df["volume"].iloc[-1] < df["volume"].iloc[-2])
    price_vol_match = price_up_vol_up or price_down_vol_down

    # 趋势中成交量是否放大
    vol_surge = latest["volume"] > latest["Vol_MA20"] * 1.5

    # ---- 形态趋势 ----
    # 上升通道：近期高低点是否形成通道
    recent_10_high = df.tail(10)["high"].max()
    recent_10_low = df.tail(10)["low"].min()
    channel_width = (recent_10_high - recent_10_low) / df.tail(10)["close"].mean() * 100

    # 平台突破：当前价是否突破20日高点
    break_20high = price > df.tail(20)["high"].max()
    break_60high = price > df.tail(60)["high"].max()

    # 均线支撑回踩
    near_ma5 = abs(price - latest["MA5"]) / latest["MA5"] < 0.02
    near_ma10 = abs(price - latest["MA10"]) / latest["MA10"] < 0.02
    near_ma20 = abs(price - latest["MA20"]) / latest["MA20"] < 0.02
    pullback_support = near_ma5 or near_ma10 or near_ma20

    return {
        # 均线趋势
        "ma20_angle": round(ma20_angle, 2),
        "ma60_angle": round(ma60_angle, 2),
        "ma_dispersion": round(ma_dispersion, 2),
        "ma_converging": ma_converging,
        "ma_diverging": ma_diverging,
        "ma_bull_strength": ma_bull_strength,

        # 价格趋势
        "hh_ratio": round(hh_ratio, 2),
        "hl_ratio": round(hl_ratio, 2),
        "trend_up_strengthen": trend_up_strengthen,
        "trend_slope": round(trend_slope, 4),
        "trend_angle": round(trend_angle, 2),
        "pct_30": round(pct_30, 2),
        "pct_60": round(pct_60, 2),

        # 趋势强度
        "adx": round(latest_adx, 2),

        # 成交量趋势
        "vol_ma5_ratio": round(vol_ma5, 2),
        "vol_ma20_ratio": round(vol_ma20, 2),
        "vol_trend": vol_trend,
        "price_vol_match": price_vol_match,
        "vol_surge": vol_surge,

        # 形态趋势
        "channel_width": round(channel_width, 2),
        "break_20high": break_20high,
        "break_60high": break_60high,
        "pullback_support": pullback_support,

        # 综合评分
        "score": 0,
        "rating": "中性",
        "reasons": [],
    }


def calc_trend_score(trend):
    """
    趋势综合评分
    """
    if trend is None:
        return None

    score = 0
    reasons = []

    # 均线角度加分
    if trend["ma20_angle"] > 10: score += 3; reasons.append("MA20角度>10度(强趋势)")
    elif trend["ma20_angle"] > 5: score += 2; reasons.append("MA20角度>5度(趋势向上)")
    elif trend["ma20_angle"] > 0: score += 1; reasons.append("MA20微向上")

    if trend["ma60_angle"] > 5: score += 2; reasons.append("MA60角度>5度")
    elif trend["ma60_angle"] > 0: score += 1; reasons.append("MA60微向上")

    # 均线发散
    if trend["ma_diverging"]: score += 2; reasons.append("均线发散(趋势加速)")
    if trend["ma_bull_strength"] == 5: score += 2; reasons.append("均线完美多头")
    elif trend["ma_bull_strength"] == 4: score += 1

    # 价格趋势
    if trend["trend_up_strengthen"]: score += 3; reasons.append("高低点持续抬升")
    if trend["hh_ratio"] > 0.7: score += 1

    # 趋势强度(ADX)
    if trend["adx"] > 50: score += 3; reasons.append("ADX>50(极强趋势)")
    elif trend["adx"] > 40: score += 2; reasons.append("ADX>40(强趋势)")
    elif trend["adx"] > 30: score += 1; reasons.append("ADX>30(有趋势)")

    # 量价配合
    if trend["price_vol_match"]: score += 1

    # 趋势放量
    if trend["vol_surge"] and trend["pct_30"] > 0: score += 2; reasons.append("趋势中放量")

    # 突破形态
    if trend["break_60high"]: score += 3; reasons.append("突破60日新高")
    elif trend["break_20high"]: score += 2; reasons.append("突破20日新高")

    # 回踩均线支撑
    if trend["pullback_support"]: score += 1; reasons.append("回踩均线支撑")

    # 30日涨幅合理
    if 10 < trend["pct_30"] < 50: score += 2; reasons.append("30日涨幅10-50%(健康)")
    elif 0 < trend["pct_30"] < 10: score += 1; reasons.append("30日温和上涨")

    # 减分：涨幅过大
    if trend["pct_30"] > 50: score -= 2; reasons.append("30日涨幅>50%(过热)")
    if trend["pct_30"] < -10: score -= 2; reasons.append("30日下跌>10%")

    # 均线收敛（即将变盘）— 中性
    if trend["ma_converging"]: score += 1; reasons.append("均线收敛(关注变盘)")

    # 评级
    if score >= 15: rating = "A++ 趋势极强"
    elif score >= 12: rating = "A+ 趋势强"
    elif score >= 10: rating = "A 趋势良好"
    elif score >= 8: rating = "B+ 趋势偏多"
    elif score >= 6: rating = "B 趋势中性"
    elif score >= 4: rating = "C 趋势偏弱"
    else: rating = "D 趋势向下"

    trend["score"] = score
    trend["rating"] = rating
    trend["reasons"] = reasons

    return trend


# ============================================================
# 主流程
# ============================================================

def main():
    print("=" * 60)
    print("  趋势选股 v1 — 趋势量化分析")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 获取实时行情
    all_codes = [f"sh{i}" for i in range(600000, 604000)]
    all_codes += [f"sh{i}" for i in range(688000, 689000)]
    all_codes += [f"sz{i:06d}" for i in range(0, 3000)]
    all_codes += [f"sz{i}" for i in range(300000, 302000)]

    print(f"共 {len(all_codes)} 只代码，获取实时行情...")

    all_data = {}
    batch_size = 100
    for i in range(0, len(all_codes), batch_size):
        batch = all_codes[i:i+batch_size]
        batch_data = get_tencent_quotes(batch)
        all_data.update(batch_data)
        if (i // batch_size) % 8 == 0 and i > 0:
            print(f"  进度: {min(i+batch_size, len(all_codes))}/{len(all_codes)}，已获取 {len(all_data)} 只")
        time.sleep(0.3)

    # 构建DataFrame
    df = pd.DataFrame(list(all_data.values()))
    df = df[df["price"] > 0]
    df = df[df["volume"] > 0]
    df = df[~df["name"].str.contains(r"ST|\*|退|B", na=False)]
    df = df[~df["code"].astype(str).str.startswith(("68", "30"))]

    print(f"\n有效股票 {len(df)} 只")

    # 筛选候选股（按成交额排序，取前80只）
    candidates = df[
        (df["pct_change"] > -9.5) &
        (df["pct_change"] < 9.5) &
        (df["volume"] > 100)
    ].sort_values("amount", ascending=False).head(80)

    print(f"候选股 {len(candidates)} 只，开始趋势分析...")

    # 技术分析（已内联calc_technicals）

    trend_results = []
    analyzed = 0
    max_analyze = len(candidates)

    for idx, row in candidates.iterrows():
        raw_code = row["code"]
        if len(str(raw_code)) == 6:
            prefix = "sh" if str(raw_code).startswith(("6", "9")) else "sz"
            code = prefix + str(raw_code)
        else:
            code = str(raw_code)
        name = row["name"]
        analyzed += 1

        if analyzed % 20 == 0:
            print(f"  分析进度: {analyzed}/{max_analyze}")

        hist = get_tencent_hist(code, days=120)
        if hist is None or not isinstance(hist, pd.DataFrame) or len(hist) < 60:
            continue

        tech_df = calc_technicals(hist)
        if tech_df is None:
            continue

        trend = calc_trend(tech_df)
        if trend:
            trend["code"] = code
            trend["name"] = name
            trend["price"] = round(row["price"], 2)
            trend["pct_change"] = round(row["pct_change"], 2)
            trend["vol"] = int(row["volume"])
            trend["amount"] = round(row["amount"], 0)

            trend = calc_trend_score(trend)
            if trend:
                trend_results.append(trend)

        time.sleep(0.3)

    if not trend_results:
        print("[错误] 趋势分析无结果")
        return

    trend_df_all = pd.DataFrame(trend_results)

    # ========== 输出结果 ==========
    print("\n" + "=" * 60)
    print("趋势分析结果 Top 30（按评分排序）")
    print("=" * 60)

    trend_sorted = trend_df_all.sort_values("score", ascending=False)
    display = trend_sorted.head(30)[[
        "code", "name", "price", "score", "rating",
        "ma20_angle", "ma60_angle", "adx",
        "pct_30", "pct_60", "vol_ma5_ratio",
        "break_20high", "break_60high", "trend_up_strengthen",
        "reasons"
    ]].copy()
    display = display.rename(columns={
        "code": "代码", "name": "名称", "price": "价格",
        "score": "评分", "rating": "评级",
        "ma20_angle": "MA20角度", "ma60_angle": "MA60角度",
        "adx": "ADX", "pct_30": "30日涨幅%", "pct_60": "60日涨幅%",
        "vol_ma5_ratio": "量比",
        "break_20high": "突破20日高", "break_60high": "突破60日高",
        "trend_up_strengthen": "趋势强化",
        "reasons": "信号",
    })

    # 布尔转Y/N
    bool_map = {True: "Y", False: "N"}
    for col in ["突破20日高", "突破60日高", "趋势强化"]:
        if col in display.columns:
            display[col] = display[col].map(bool_map)

    print(display.to_string(index=False))

    # ========== 趋势信号筛选 ==========
    print("\n" + "=" * 60)
    print("趋势信号筛选")
    print("=" * 60)

    # 趋势极强（>=15分）
    strong = trend_df_all[trend_df_all["score"] >= 15]
    print(f"\n趋势极强(>=15分): {len(strong)} 只")
    if len(strong) > 0:
        print(strong.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 趋势强（>=12分）
    strong_trend = trend_df_all[(trend_df_all["score"] >= 12) & (trend_df_all["score"] < 15)]
    print(f"\n趋势强(12-14分): {len(strong_trend)} 只")
    if len(strong_trend) > 0:
        print(strong_trend.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 趋势良好（>=10分）
    good = trend_df_all[(trend_df_all["score"] >= 10) & (trend_df_all["score"] < 12)]
    print(f"\n趋势良好(10-11分): {len(good)} 只")
    if len(good) > 0:
        print(good.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # ADX > 40（强趋势）
    adx_strong = trend_df_all[trend_df_all["adx"] > 40]
    print(f"\nADX>40(强趋势): {len(adx_strong)} 只")
    if len(adx_strong) > 0:
        print(adx_strong.sort_values("adx", ascending=False)[["code", "name", "price", "score", "adx", "rating"]].to_string(index=False))

    # 突破60日新高
    break_60 = trend_df_all[trend_df_all["break_60high"] == True]
    print(f"\n突破60日新高: {len(break_60)} 只")
    if len(break_60) > 0:
        print(break_60.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "pct_30", "reasons"]].to_string(index=False))

    # 趋势强化（高低点持续抬升）
    trend_str = trend_df_all[trend_df_all["trend_up_strengthen"] == True]
    print(f"\n趋势强化(高低点持续抬升): {len(trend_str)} 只")
    if len(trend_str) > 0:
        print(trend_str.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating"]].to_string(index=False))

    # 趋势放量 + 上涨
    vol_up = trend_df_all[(trend_df_all["vol_surge"] == True) & (trend_df_all["pct_30"] > 0)]
    print(f"\n趋势放量+30日上涨: {len(vol_up)} 只")
    if len(vol_up) > 0:
        print(vol_up.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "pct_30", "vol_ma5_ratio"]].to_string(index=False))

    # MA20角度 > 10度（强趋势）
    steep = trend_df_all[trend_df_all["ma20_angle"] > 10]
    print(f"\nMA20角度>10度(陡峭趋势): {len(steep)} 只")
    if len(steep) > 0:
        print(steep.sort_values("ma20_angle", ascending=False)[["code", "name", "price", "score", "ma20_angle", "rating"]].to_string(index=False))

    # 均线完美多头
    perfect_ma = trend_df_all[trend_df_all["ma_bull_strength"] == 5]
    print(f"\n均线完美多头(5/5): {len(perfect_ma)} 只")
    if len(perfect_ma) > 0:
        print(perfect_ma.sort_values("score", ascending=False)[["code", "name", "price", "score", "ma_bull_strength", "rating"]].to_string(index=False))

    # 回踩均线支撑
    pullback = trend_df_all[trend_df_all["pullback_support"] == True]
    print(f"\n回踩均线支撑: {len(pullback)} 只")
    if len(pullback) > 0:
        print(pullback.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating"]].to_string(index=False))

    # 均线发散（趋势加速）
    diverge = trend_df_all[trend_df_all["ma_diverging"] == True]
    print(f"\n均线发散(趋势加速): {len(diverge)} 只")
    if len(diverge) > 0:
        print(diverge.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating"]].to_string(index=False))

    # ========== 共振筛选 ==========
    print("\n" + "=" * 60)
    print("趋势共振筛选")
    print("=" * 60)

    # 共振1: 高分(>=12) + 趋势强化 + 量价配合
    r1 = trend_df_all[
        (trend_df_all["score"] >= 12) &
        (trend_df_all["trend_up_strengthen"] == True) &
        (trend_df_all["price_vol_match"] == True)
    ]
    print(f"\n高分(>=12)+趋势强化+量价配合: {len(r1)} 只")
    if len(r1) > 0:
        print(r1.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振2: 高分(>=12) + ADX>40 + 突破60日高
    r2 = trend_df_all[
        (trend_df_all["score"] >= 12) &
        (trend_df_all["adx"] > 40) &
        (trend_df_all["break_60high"] == True)
    ]
    print(f"\n高分(>=12)+ADX>40+突破60日高: {len(r2)} 只")
    if len(r2) > 0:
        print(r2.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振3: 高分(>=12) + 趋势强化 + 趋势放量
    r3 = trend_df_all[
        (trend_df_all["score"] >= 12) &
        (trend_df_all["trend_up_strengthen"] == True) &
        (trend_df_all["vol_surge"] == True)
    ]
    print(f"\n高分(>=12)+趋势强化+趋势放量: {len(r3)} 只")
    if len(r3) > 0:
        print(r3.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振4: 最强 = 高分(>=14) + 趋势强化 + ADX>40 + 突破60日高 + 量价配合
    r4 = trend_df_all[
        (trend_df_all["score"] >= 14) &
        (trend_df_all["trend_up_strengthen"] == True) &
        (trend_df_all["adx"] > 40) &
        (trend_df_all["break_60high"] == True) &
        (trend_df_all["price_vol_match"] == True)
    ]
    print(f"\n最强(>=14+趋势强化+ADX>40+突破60日高+量价配合): {len(r4)} 只")
    if len(r4) > 0:
        print(r4.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振5: 均线发散 + 高分(>=10) + ADX>30
    r5 = trend_df_all[
        (trend_df_all["ma_diverging"] == True) &
        (trend_df_all["score"] >= 10) &
        (trend_df_all["adx"] > 30)
    ]
    print(f"\n均线发散+高分(>=10)+ADX>30: {len(r5)} 只")
    if len(r5) > 0:
        print(r5.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振6: 趋势良好(>=10) + 回踩均线支撑 + 趋势强化
    r6 = trend_df_all[
        (trend_df_all["score"] >= 10) &
        (trend_df_all["pullback_support"] == True) &
        (trend_df_all["trend_up_strengthen"] == True)
    ]
    print(f"\n趋势良好(>=10)+回踩支撑+趋势强化: {len(r6)} 只")
    if len(r6) > 0:
        print(r6.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # ========== 导出 ==========
    print("\n" + "=" * 60)
    print("导出文件")
    print("=" * 60)

    ts = datetime.now().strftime("%Y%m%d")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    trend_df_all.to_csv(os.path.join(OUTPUT_DIR, f"trend_{ts}.csv"), index=False, encoding="utf-8-sig")
    print(f"趋势分析全量: {os.path.join(OUTPUT_DIR, 'trend_'+ts+'.csv')} ({len(trend_df_all)} 只)")

    high_trend = trend_df_all[trend_df_all["score"] >= 10].sort_values("score", ascending=False)
    if len(high_trend) > 0:
        high_trend.to_csv(os.path.join(OUTPUT_DIR, f"trend_high_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"高分(>=10): {os.path.join(OUTPUT_DIR, 'trend_high_'+ts+'.csv')} ({len(high_trend)} 只)")

    if len(break_60) > 0:
        break_60.to_csv(os.path.join(OUTPUT_DIR, f"trend_break_60_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"突破60日高: {os.path.join(OUTPUT_DIR, 'trend_break_60_'+ts+'.csv')} ({len(break_60)} 只)")

    if len(strong) > 0:
        strong.to_csv(os.path.join(OUTPUT_DIR, f"trend_strong_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"趋势极强(>=15): {os.path.join(OUTPUT_DIR, 'trend_strong_'+ts+'.csv')} ({len(strong)} 只)")

    if len(r1) > 0:
        r1.to_csv(os.path.join(OUTPUT_DIR, f"trend_resonance_1_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振1-高分+趋势强化+量价配合: {os.path.join(OUTPUT_DIR, 'trend_resonance_1_'+ts+'.csv')} ({len(r1)} 只)")

    if len(r2) > 0:
        r2.to_csv(os.path.join(OUTPUT_DIR, f"trend_resonance_2_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振2-高分+ADX>40+突破60日高: {os.path.join(OUTPUT_DIR, 'trend_resonance_2_'+ts+'.csv')} ({len(r2)} 只)")

    if len(r3) > 0:
        r3.to_csv(os.path.join(OUTPUT_DIR, f"trend_resonance_3_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振3-高分+趋势强化+趋势放量: {os.path.join(OUTPUT_DIR, 'trend_resonance_3_'+ts+'.csv')} ({len(r3)} 只)")

    if len(r4) > 0:
        r4.to_csv(os.path.join(OUTPUT_DIR, f"trend_resonance_4_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振4-最强: {os.path.join(OUTPUT_DIR, 'trend_resonance_4_'+ts+'.csv')} ({len(r4)} 只)")

    if len(r5) > 0:
        r5.to_csv(os.path.join(OUTPUT_DIR, f"trend_resonance_5_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振5-均线发散+高分+ADX>30: {os.path.join(OUTPUT_DIR, 'trend_resonance_5_'+ts+'.csv')} ({len(r5)} 只)")

    if len(r6) > 0:
        r6.to_csv(os.path.join(OUTPUT_DIR, f"trend_resonance_6_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振6-趋势良好+回踩支撑+趋势强化: {os.path.join(OUTPUT_DIR, 'trend_resonance_6_'+ts+'.csv')} ({len(r6)} 只)")

    print("\n" + "=" * 60)
    print("完成！")
    print("=" * 60)
    print("\n趋势分析说明:")
    print("  - 评分越高趋势越强，>=15 极强，>=12 强，>=10 良好")
    print("  - MA20角度: >10度=陡峭趋势，>5度=明显趋势，>0=微向上")
    print("  - ADX: >50极强趋势，>40强趋势，>30有趋势，<20无趋势")
    print("  - 趋势强化: 高低点持续抬升（>60%的K线创新高/低）")
    print("  - 突破: 当前价是否突破20日/60日最高价")
    print("  - 量价配合: 价涨量增 或 价跌量缩")
    print("  - 均线发散: MA5和MA20间距在扩大（趋势加速）")
    print("  - 均线收敛: MA5和MA20间距在缩小（即将变盘）")
    print("  - 回踩支撑: 股价回踩到MA5/MA10/MA20附近（<2%）")


if __name__ == "__main__":
    main()
