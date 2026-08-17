# -*- coding: utf-8 -*-
"""
A股选股脚本 v5 — 腾讯数据源 + 技术面分析
用法: python astock-screener.py

数据源：腾讯财经（qt.gtimg.cn）— 稳定免费
技术面：均线系统、MACD、RSI、布林带、成交量形态、KDJ
评分逻辑：均线+MACD+RSI+KDJ+成交量 综合打分
导出：CSV 全量 / 高分(>=6) / 金叉(MACD/KDJ) / 原行情
"""

import pandas as pd
import numpy as np
import json
import time
import sys
import io
import urllib.request
import os
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


def get_tencent_hist(code, days=60):
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

        # 解析嵌套结构
        d = None
        for k, v in j.get('data', {}).items():
            if 'qfqday' in v:
                d = v['qfqday']
                break

        if not d:
            return None

        # 转换为 DataFrame
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
# 技术面分析
# ============================================================

def calc_technicals(hist_df):
    """
    计算技术指标
    输入: hist_df (date, open, close, high, low, volume)
    输出: 包含所有指标的 DataFrame
    """
    if hist_df is None or not isinstance(hist_df, pd.DataFrame) or len(hist_df) < 20:
        return None

    df = hist_df.copy()

    # ---- 均线系统 ----
    df["MA5"] = df["close"].rolling(5).mean()
    df["MA10"] = df["close"].rolling(10).mean()
    df["MA20"] = df["close"].rolling(20).mean()
    df["MA60"] = df["close"].rolling(60).mean() if len(df) >= 60 else np.nan
    df["MA120"] = df["close"].rolling(120).mean() if len(df) >= 120 else np.nan

    # ---- 成交量均线 ----
    df["Vol_MA5"] = df["volume"].rolling(5).mean()
    df["Vol_MA20"] = df["volume"].rolling(20).mean()

    # ---- MACD ----
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["DIF"] = ema12 - ema26
    df["DEA"] = df["DIF"].ewm(span=9, adjust=False).mean()
    df["MACD"] = 2 * (df["DIF"] - df["DEA"])

    # ---- RSI ----
    delta = df["close"].diff()
    gain = delta.where(delta > 0, 0)
    loss = (-delta).where(delta < 0, 0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["RSI14"] = 100 - (100 / (1 + rs))

    # ---- 布林带 ----
    df["BOLL_MID"] = df["close"].rolling(20).mean()
    boll_std = df["close"].rolling(20).std()
    df["BOLL_UP"] = df["BOLL_MID"] + 2 * boll_std
    df["BOLL_DN"] = df["BOLL_MID"] - 2 * boll_std

    # ---- KDJ ----
    low_min = df["low"].rolling(9).min()
    high_max = df["high"].rolling(9).max()
    rsv = (df["close"] - low_min) / (high_max - low_min).replace(0, np.nan) * 100
    df["K"] = rsv.ewm(com=2, adjust=False).mean()
    df["D"] = df["K"].ewm(com=2, adjust=False).mean()
    df["J"] = 3 * df["K"] - 2 * df["D"]

    return df


def analyze_signal(tech_df):
    """
    综合技术面信号分析
    评分体系：
      均线(0-6): 站上MA5/10/20/60各+1，多头排列+2
      MACD(0-5): 金叉+3，零轴上方+1，红柱放大+1，死叉-2
      成交量(0-3): 放量+1，倍量+2
      RSI(0-3): 中性区+1，超卖+2，超买-1
      KDJ(0-2): 金叉+2，超买-1
      布林带(0-3): 触及下轨+2，接近上轨+1
    """
    if tech_df is None or not isinstance(tech_df, pd.DataFrame) or len(tech_df) < 20:
        return None

    latest = tech_df.iloc[-1]
    prev = tech_df.iloc[-2]
    price = latest["close"]

    # 均线
    above_ma5 = price > latest["MA5"]
    above_ma10 = price > latest["MA10"]
    above_ma20 = price > latest["MA20"]
    above_ma60 = pd.notna(latest.get("MA60")) and price > latest["MA60"]
    bull_arrange = (above_ma5 and above_ma10 and above_ma20 and
                    latest["MA5"] > latest["MA10"] and latest["MA10"] > latest["MA20"])

    # 成交量
    vol_surge_5 = latest["volume"] > latest["Vol_MA5"] * 1.5
    vol_expand = latest["volume"] > latest["Vol_MA20"] * 2.0

    # MACD
    macd_golden = (prev["DIF"] <= prev["DEA"] and latest["DIF"] > latest["DEA"])
    macd_dead = (prev["DIF"] >= prev["DEA"] and latest["DIF"] < latest["DEA"])
    macd_above_zero = latest["DIF"] > 0 and latest["DEA"] > 0
    macd_increasing = latest["MACD"] > 0 and latest["MACD"] > prev["MACD"]

    # RSI
    rsi = latest["RSI14"]
    rsi_overbought = rsi > 70
    rsi_oversold = rsi < 30

    # 布林带
    near_boll_up = latest["BOLL_UP"] > 0 and price / latest["BOLL_UP"] > 0.95
    below_boll_dn = latest["BOLL_DN"] > 0 and price < latest["BOLL_DN"]

    # KDJ
    kdj_golden = (prev["K"] <= prev["D"] and latest["K"] > latest["D"])
    kdj_overbought = latest["J"] > 100

    # 评分
    score = 0
    reasons = []

    if above_ma5: score += 1; reasons.append("站上MA5")
    if above_ma10: score += 1; reasons.append("站上MA10")
    if above_ma20: score += 1; reasons.append("站上MA20")
    if above_ma60: score += 1; reasons.append("站上MA60")
    if bull_arrange: score += 2; reasons.append("多头排列")

    if macd_golden: score += 3; reasons.append("MACD金叉")
    if macd_above_zero: score += 1; reasons.append("零轴上方")
    if macd_increasing: score += 1; reasons.append("红柱放大")
    if macd_dead: score -= 2; reasons.append("MACD死叉")

    if vol_surge_5: score += 1; reasons.append("放量")
    if vol_expand: score += 2; reasons.append("倍量")

    if 40 <= rsi <= 60: score += 1; reasons.append("RSI中性")
    if rsi_oversold: score += 2; reasons.append("RSI超卖")
    if rsi_overbought: score -= 1; reasons.append("RSI超买")

    if kdj_golden: score += 2; reasons.append("KDJ金叉")
    if kdj_overbought: score -= 1; reasons.append("KDJ超买")

    if below_boll_dn: score += 2; reasons.append("布林下轨")
    if near_boll_up: score += 1; reasons.append("接近布林上轨")

    # 评级
    if score >= 8: rating = "A++ 强烈看好"
    elif score >= 6: rating = "A+ 看好"
    elif score >= 4: rating = "B 偏多"
    elif score >= 2: rating = "C 中性"
    elif score >= 0: rating = "D 偏空"
    else: rating = "F 看空"

    return {
        "score": score,
        "rating": rating,
        "price": round(price, 2),
        "above_ma5": above_ma5, "above_ma10": above_ma10,
        "above_ma20": above_ma20, "above_ma60": above_ma60,
        "bull_arrange": bull_arrange,
        "ma5": round(latest["MA5"], 2) if not pd.isna(latest["MA5"]) else None,
        "ma10": round(latest["MA10"], 2) if not pd.isna(latest["MA10"]) else None,
        "ma20": round(latest["MA20"], 2) if not pd.isna(latest["MA20"]) else None,
        "ma60": round(latest["MA60"], 2) if not pd.isna(latest["MA60"]) else None,
        "dif": round(latest["DIF"], 4), "dea": round(latest["DEA"], 4),
        "macd": round(latest["MACD"], 4),
        "macd_golden": macd_golden, "macd_dead": macd_dead,
        "macd_above_zero": macd_above_zero,
        "rsi": round(rsi, 1), "rsi_overbought": rsi_overbought, "rsi_oversold": rsi_oversold,
        "boll_mid": round(latest["BOLL_MID"], 2) if not pd.isna(latest["BOLL_MID"]) else None,
        "boll_up": round(latest["BOLL_UP"], 2) if not pd.isna(latest["BOLL_UP"]) else None,
        "boll_dn": round(latest["BOLL_DN"], 2) if not pd.isna(latest["BOLL_DN"]) else None,
        "kdj_k": round(latest["K"], 2), "kdj_d": round(latest["D"], 2),
        "kdj_j": round(latest["J"], 2), "kdj_golden": kdj_golden,
        "vol_surge_5": vol_surge_5, "vol_expand": vol_expand,
        "reasons": "; ".join(reasons) if reasons else "无明显信号",
    }


# ============================================================
# 选股流程
# ============================================================

def fetch_realtime_data():
    """获取实时行情 — 全A股（沪深主板+科创板+创业板）"""
    # 沪A主板 600000-603999 + 科创板 688000-688999
    all_codes = [f"sh{i}" for i in range(600000, 604000)]
    all_codes += [f"sh{i}" for i in range(688000, 689000)]
    # 深A主板 000001-002999 + 创业板 300000-302000
    all_codes += [f"sz{i:06d}" for i in range(0, 3000)]
    all_codes += [f"sz{i}" for i in range(300000, 302000)]

    # 精简：按成交活跃度筛选前 N 只，避免全量4000+股票耗时过长
    # 先拿全量实时行情，按成交额排序取前 N 只
    print(f"[获取] 共 {len(all_codes)} 只代码，获取实时行情...")

    all_data = {}
    batch_size = 100
    for i in range(0, len(all_codes), batch_size):
        batch = all_codes[i:i+batch_size]
        batch_data = get_tencent_quotes(batch)
        all_data.update(batch_data)
        if (i // batch_size) % 8 == 0 and i > 0:
            print(f"  进度: {min(i+batch_size, len(all_codes))}/{len(all_codes)}，已获取 {len(all_data)} 只")
        time.sleep(0.3)

    return all_data


def build_dataframe(data_dict):
    """构建DataFrame，过滤无效股 + 排除科创板(68)和创业板(30)"""
    df = pd.DataFrame(list(data_dict.values()))
    df = df[df["price"] > 0]
    df = df[df["volume"] > 0]
    df = df[~df["name"].str.contains(r"ST|\*|退|B", na=False)]
    # 排除科创板(68开头)和创业板(30开头) — 只保留沪深主板+中小板
    df = df[~df["code"].astype(str).str.startswith(("68", "30"))]
    return df


def print_results(df, title=""):
    """打印结果（保留供后续使用）"""


def main():
    print("=" * 60)
    print("  A股选股 v5 — 腾讯数据源 + 技术面分析")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ========== 第一步：获取实时行情 ==========
    data = fetch_realtime_data()
    if not data:
        print("\n[❌] 数据获取失败")
        return

    df = build_dataframe(data)
    if df is None or len(df) == 0:
        print("\n[❌] 数据解析失败")
        return

    print(f"\n有效股票 {len(df)} 只")

    # 筛选：非涨跌停 + 有成交量 + 按成交额排序（取前80只分析）
    candidates = df[
        (df["pct_change"] > -9.5) &
        (df["pct_change"] < 9.5) &
        (df["volume"] > 100)
    ].sort_values("amount", ascending=False).head(80)

    print(f"候选股 {len(candidates)} 只，开始技术分析...")

    tech_signals = []
    analyzed = 0
    max_analyze = len(candidates)

    for idx, row in candidates.iterrows():
        raw_code = row["code"]
        # 实时行情code只有数字，历史行情需要sh/sz前缀
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
        if hist is None or not isinstance(hist, pd.DataFrame) or len(hist) < 20:
            continue

        tech_df = calc_technicals(hist)
        if tech_df is None:
            continue

        signal = analyze_signal(tech_df)
        if signal:
            signal["code"] = code
            signal["name"] = name
            tech_signals.append(signal)

        time.sleep(0.3)

    if not tech_signals:
        print("[错误] 技术分析无结果，请检查网络")
        return

    tech_df_all = pd.DataFrame(tech_signals)
    print(f"[OK] 技术分析完成，有效信号 {len(tech_df_all)} 只")

    # ========== 第三步：展示结果 ==========
    print("\n" + "=" * 60)
    print("技术面分析结果 Top 30（按评分排序）")
    print("=" * 60)

    tech_sorted = tech_df_all.sort_values("score", ascending=False)
    display = tech_sorted.head(30)[[
        "code", "name", "price", "score", "rating",
        "above_ma5", "above_ma10", "above_ma20", "above_ma60",
        "macd_golden", "kdj_golden", "vol_surge_5",
        "rsi", "reasons"
    ]].copy()
    display = display.rename(columns={
        "code": "代码", "name": "名称", "price": "价格",
        "score": "评分", "rating": "评级",
        "above_ma5": "MA5", "above_ma10": "MA10",
        "above_ma20": "MA20", "above_ma60": "MA60",
        "macd_golden": "MACD金叉", "kdj_golden": "KDJ金叉",
        "vol_surge_5": "放量", "rsi": "RSI",
        "reasons": "信号",
    })
    # 布尔值转文字（GBK兼容：用Y/N代替符号）
    bool_map = {True: "Y", False: "N"}
    for col in ["MA5", "MA10", "MA20", "MA60", "MACD金叉", "KDJ金叉", "放量"]:
        if col in display.columns:
            display[col] = display[col].map(bool_map)
    print(display.to_string(index=False))

    # ========== 特殊信号筛选 ==========
    print("\n" + "=" * 60)
    print("特殊信号筛选")
    print("=" * 60)

    # 多头排列
    bull = tech_df_all[tech_df_all["bull_arrange"] == True]
    print(f"\n多头排列: {len(bull)} 只")
    if len(bull) > 0:
        bull_disp = bull.sort_values("score", ascending=False).head(10)[["code", "name", "price", "score", "rating"]]
        bull_disp.columns = ["代码", "名称", "价格", "评分", "评级"]
        print(bull_disp.to_string(index=False))

    # MACD金叉
    macd_cross = tech_df_all[tech_df_all["macd_golden"] == True]
    print(f"\nMACD金叉: {len(macd_cross)} 只")
    if len(macd_cross) > 0:
        mc_disp = macd_cross.sort_values("score", ascending=False).head(10)[["code", "name", "price", "score", "rating"]]
        mc_disp.columns = ["代码", "名称", "价格", "评分", "评级"]
        print(mc_disp.to_string(index=False))

    # KDJ金叉
    kdj_cross = tech_df_all[tech_df_all["kdj_golden"] == True]
    print(f"\nKDJ金叉: {len(kdj_cross)} 只")
    if len(kdj_cross) > 0:
        kdj_disp = kdj_cross.sort_values("score", ascending=False).head(10)[["code", "name", "price", "score", "rating"]]
        kdj_disp.columns = ["代码", "名称", "价格", "评分", "评级"]
        print(kdj_disp.to_string(index=False))

    # 超卖
    oversold = tech_df_all[tech_df_all["rsi_oversold"] == True]
    print(f"\nRSI超卖: {len(oversold)} 只")
    if len(oversold) > 0:
        ov_disp = oversold.sort_values("score", ascending=False).head(10)[["code", "name", "price", "score", "rating", "rsi"]]
        ov_disp.columns = ["代码", "名称", "价格", "评分", "评级", "RSI"]
        print(ov_disp.to_string(index=False))

    # 超买
    overbought = tech_df_all[tech_df_all["rsi_overbought"] == True]
    print(f"\nRSI超买: {len(overbought)} 只")
    if len(overbought) > 0:
        ob_disp = overbought.sort_values("score", ascending=False).head(10)[["code", "name", "price", "score", "rating", "rsi"]]
        ob_disp.columns = ["代码", "名称", "价格", "评分", "评级", "RSI"]
        print(ob_disp.to_string(index=False))

    # 倍量
    expand_vol = tech_df_all[tech_df_all["vol_expand"] == True]
    print(f"\n倍量: {len(expand_vol)} 只")
    if len(expand_vol) > 0:
        ev_disp = expand_vol.sort_values("score", ascending=False).head(10)[["code", "name", "price", "score", "rating"]]
        ev_disp.columns = ["代码", "名称", "价格", "评分", "评级"]
        print(ev_disp.to_string(index=False))

    # ========== 共振信号筛选 ==========
    print("\n" + "=" * 60)
    print("共振信号筛选")
    print("=" * 60)

    # 共振1: MACD金叉 + KDJ金叉 + 放量
    r1 = tech_df_all[(tech_df_all["macd_golden"]==True) & (tech_df_all["kdj_golden"]==True) & (tech_df_all["vol_surge_5"]==True)]
    print(f"\nMACD金叉+KDJ金叉+放量: {len(r1)} 只")
    if len(r1) > 0:
        print(r1.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振2: 多头排列 + MACD金叉
    r2 = tech_df_all[(tech_df_all["bull_arrange"]==True) & (tech_df_all["macd_golden"]==True)]
    print(f"\n多头排列+MACD金叉: {len(r2)} 只")
    if len(r2) > 0:
        print(r2.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振3: 多头排列 + MACD金叉 + 放量
    r3 = tech_df_all[(tech_df_all["bull_arrange"]==True) & (tech_df_all["macd_golden"]==True) & (tech_df_all["vol_surge_5"]==True)]
    print(f"\n多头排列+MACD金叉+放量: {len(r3)} 只")
    if len(r3) > 0:
        print(r3.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振4: 站上MA60 + 多头排列 + MACD金叉 + 放量
    r4 = tech_df_all[(tech_df_all["above_ma60"]==True) & (tech_df_all["bull_arrange"]==True) & (tech_df_all["macd_golden"]==True) & (tech_df_all["vol_surge_5"]==True)]
    print(f"\n站上MA60+多头排列+MACD金叉+放量: {len(r4)} 只")
    if len(r4) > 0:
        print(r4.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振5: 高分(>=8) + 站上全部4均线
    r5 = tech_df_all[(tech_df_all["score"]>=8) & (tech_df_all["above_ma5"]==True) & (tech_df_all["above_ma10"]==True) & (tech_df_all["above_ma20"]==True) & (tech_df_all["above_ma60"]==True)]
    print(f"\n高分(>=8)+站上全部4均线: {len(r5)} 只")
    if len(r5) > 0:
        print(r5.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振6: 高分(>=7) + 站上MA60 + MACD金叉
    r6 = tech_df_all[(tech_df_all["score"]>=7) & (tech_df_all["above_ma60"]==True) & (tech_df_all["macd_golden"]==True)]
    print(f"\n高分(>=7)+站上MA60+MACD金叉: {len(r6)} 只")
    if len(r6) > 0:
        print(r6.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振7: 最强 = 多头排列 + MACD金叉 + KDJ金叉 + 放量 + 高分(>=8)
    r7 = tech_df_all[(tech_df_all["bull_arrange"]==True) & (tech_df_all["macd_golden"]==True) & (tech_df_all["kdj_golden"]==True) & (tech_df_all["vol_surge_5"]==True) & (tech_df_all["score"]>=8)]
    print(f"\n最强共振(多头+MACD金叉+KDJ金叉+放量+高分>=8): {len(r7)} 只")
    if len(r7) > 0:
        print(r7.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # 共振8: MACD金叉 + KDJ金叉 + 站上MA60 + 高分(>=7)
    r8 = tech_df_all[(tech_df_all["macd_golden"]==True) & (tech_df_all["kdj_golden"]==True) & (tech_df_all["above_ma60"]==True) & (tech_df_all["score"]>=7)]
    print(f"\n双金叉+站上MA60+高分(>=7): {len(r8)} 只")
    if len(r8) > 0:
        print(r8.sort_values("score", ascending=False)[["code", "name", "price", "score", "rating", "reasons"]].to_string(index=False))

    # ========== 导出 ==========
    print("\n" + "=" * 60)
    print("导出文件")
    print("=" * 60)

    ts = datetime.now().strftime("%Y%m%d")

    # 导出CSV
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tech_df_all.to_csv(os.path.join(OUTPUT_DIR, f"stock_tech_{ts}.csv"), index=False, encoding="utf-8-sig")
    print(f"技术分析全量: {os.path.join(OUTPUT_DIR, 'stock_tech_'+ts+'.csv')} ({len(tech_df_all)} 只)")

    high_score = tech_df_all[tech_df_all["score"] >= 6].sort_values("score", ascending=False)
    if len(high_score) > 0:
        high_score.to_csv(os.path.join(OUTPUT_DIR, f"stock_tech_high_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"高分(>=6): {os.path.join(OUTPUT_DIR, 'stock_tech_high_'+ts+'.csv')} ({len(high_score)} 只)")

    if len(macd_cross) > 0:
        macd_cross.to_csv(os.path.join(OUTPUT_DIR, f"stock_macd_cross_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"MACD金叉: {os.path.join(OUTPUT_DIR, 'stock_macd_cross_'+ts+'.csv')} ({len(macd_cross)} 只)")

    if len(kdj_cross) > 0:
        kdj_cross.to_csv(os.path.join(OUTPUT_DIR, f"stock_kdj_cross_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"KDJ金叉: {os.path.join(OUTPUT_DIR, 'stock_kdj_cross_'+ts+'.csv')} ({len(kdj_cross)} 只)")

    df.to_csv(os.path.join(OUTPUT_DIR, f"stock_all_{ts}.csv"), index=False, encoding="utf-8-sig")
    print(f"全量行情: {os.path.join(OUTPUT_DIR, 'stock_all_'+ts+'.csv')} ({len(df)} 只)")

    # 共振CSV
    # 共振1: MACD金叉+KDJ金叉+放量
    if len(r1) > 0:
        r1.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_macd_kdj_vol_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-MACD金叉+KDJ金叉+放量: {os.path.join(OUTPUT_DIR, 'stock_resonance_macd_kdj_vol_'+ts+'.csv')} ({len(r1)} 只)")

    # 共振2: 多头排列+MACD金叉
    if len(r2) > 0:
        r2.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_bull_macd_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-多头排列+MACD金叉: {os.path.join(OUTPUT_DIR, 'stock_resonance_bull_macd_'+ts+'.csv')} ({len(r2)} 只)")

    # 共振3: 多头排列+MACD金叉+放量
    if len(r3) > 0:
        r3.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_bull_macd_vol_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-多头排列+MACD金叉+放量: {os.path.join(OUTPUT_DIR, 'stock_resonance_bull_macd_vol_'+ts+'.csv')} ({len(r3)} 只)")

    # 共振4: 站上MA60+多头排列+MACD金叉+放量
    if len(r4) > 0:
        r4.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_all4_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-站上MA60+多头排列+MACD金叉+放量: {os.path.join(OUTPUT_DIR, 'stock_resonance_all4_'+ts+'.csv')} ({len(r4)} 只)")

    # 共振5: 高分+站上全部4均线
    if len(r5) > 0:
        r5.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_full_ma_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-高分+站上全部4均线: {os.path.join(OUTPUT_DIR, 'stock_resonance_full_ma_'+ts+'.csv')} ({len(r5)} 只)")

    # 共振6: 高分+站上MA60+MACD金叉
    if len(r6) > 0:
        r6.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_macd_ma60_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-高分+站上MA60+MACD金叉: {os.path.join(OUTPUT_DIR, 'stock_resonance_macd_ma60_'+ts+'.csv')} ({len(r6)} 只)")

    # 共振7: 最强共振
    if len(r7) > 0:
        r7.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_strong_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-最强共振: {os.path.join(OUTPUT_DIR, 'stock_resonance_strong_'+ts+'.csv')} ({len(r7)} 只)")

    # 共振8: 双金叉+MA60+高分
    if len(r8) > 0:
        r8.to_csv(os.path.join(OUTPUT_DIR, f"stock_resonance_dual_cross_{ts}.csv"), index=False, encoding="utf-8-sig")
        print(f"共振-双金叉+站上MA60+高分: {os.path.join(OUTPUT_DIR, 'stock_resonance_dual_cross_'+ts+'.csv')} ({len(r8)} 只)")

    print("\n" + "=" * 60)
    print("完成！")
    print("=" * 60)
    print("\n技术指标说明:")
    print("  - 评分越高越好，>=6 算强信号")
    print("  - 均线: Y = 股价站上该均线")
    print("  - 金叉: DIF上穿DEA 或 K上穿D")
    print("  - 放量: 当日成交量 > 5日均量的1.5倍")
    print("  - RSI: <30超卖(反弹机会), >70超买(风险)")
    print("  - 多头排列: MA5 > MA10 > MA20")


if __name__ == "__main__":
    main()
