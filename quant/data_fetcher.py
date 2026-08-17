# -*- coding: utf-8 -*-
"""
数据采集模块 - A股行情数据获取

数据源优先级：
1. akshare.fund_etf_spot_em() — 本地运行时用（东方财富）
2. akshare.fund_etf_hist_sina() — 历史K线
3. 手动输入价格 — fallback
"""
import json
import os
from datetime import datetime, timedelta

# ========== 手动输入缓存（实时价格）==========
# 路径: quant/data/prices_cache.json
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CACHE_FILE = os.path.join(CACHE_DIR, "prices_cache.json")

os.makedirs(CACHE_DIR, exist_ok=True)


def load_cache():
    """加载价格缓存"""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(data):
    """保存价格缓存"""
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_realtime_quote(symbol):
    """
    获取实时行情
    
    优先级：
    1. 东方财富API (push2.eastmoney.com) - 通用
    2. akshare ETF 数据
    3. akshare A股数据
    4. 缓存
    
    Returns:
        dict 或 None
    """
    import json as _json
    
    # 1. web_fetch 东方财富API（通用，支持ETF和股票）
    try:
        # 注意：这里调用 web_fetch 需要 OpenClaw 环境
        # 如果不在 OpenClaw 中，跳过此步骤
        if 'web_fetch' in globals():
            is_sh = symbol.startswith("6")
            secid = f"1.{symbol}" if is_sh else f"0.{symbol}"
            url = f"https://push2.eastmoney.com/api/qt/stock/get?secid={secid}&fields=f43,f44,f45,f46,f47,f48,f170"
            # 这个需要 OpenClaw 的 web_fetch 工具调用
            # 暂时跳过
            pass
    except Exception:
        pass  # 继续fallback
    
    # 2. 用 akshare ETF
    try:
        import akshare as ak
        df = ak.fund_etf_spot_em()
        row = df[df["代码"] == symbol]
        if not row.empty:
            r = row.iloc[0]
            price = float(r["最新价"])
            prev_close = float(r["昨收"])
            cache = load_cache()
            cache[symbol] = {
                "price": price,
                "prev_close": prev_close,
                "change_pct": float(r["涨跌幅"]),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            save_cache(cache)
            return {
                "symbol": symbol,
                "name": r["名称"],
                "price": price,
                "open": float(r["开盘价"]),
                "high": float(r["最高价"]),
                "low": float(r["最低价"]),
                "prev_close": prev_close,
                "volume": float(r["成交量"]),
                "amount": float(r["成交额"]),
                "change_pct": float(r["涨跌幅"]),
                "change": price - prev_close,
                "timestamp": r["更新时间"].strftime("%Y-%m-%d %H:%M:%S") if hasattr(r["更新时间"], "strftime") else str(r["更新时间"]),
                "iopv": float(r["IOPV实时估值"]) if "IOPV实时估值" in r else None,
            }
    except Exception:
        pass  # 继续fallback
    
    # 3. 用 akshare A股
    try:
        import akshare as ak
        df_a = ak.stock_zh_a_spot_em()
        row_a = df_a[df_a["代码"] == symbol]
        if not row_a.empty:
            r = row_a.iloc[0]
            price = float(r["最新价"])
            prev_close = float(r["昨收"])
            cache = load_cache()
            cache[symbol] = {
                "price": price,
                "prev_close": prev_close,
                "change_pct": float(r["涨跌幅"]),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            save_cache(cache)
            return {
                "symbol": symbol,
                "name": r["名称"],
                "price": price,
                "open": float(r["今开"]) if "今开" in r else price * 0.999,
                "high": float(r["最高"]),
                "low": float(r["最低"]),
                "prev_close": prev_close,
                "volume": 0,
                "amount": 0,
                "change_pct": float(r["涨跌幅"]),
                "change": price - prev_close,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "iopv": None,
            }
    except Exception:
        pass  # 继续缓存
    
    # 4. 缓存
    return _get_cached_price(symbol)


def _get_cached_price(symbol):
    """从缓存获取价格"""
    cache = load_cache()
    if symbol in cache:
        c = cache[symbol]
        return {
            "symbol": symbol,
            "name": symbol,
            "price": c["price"],
            "open": c["price"] * 0.999,
            "high": c["price"] * 1.001,
            "low": c["price"] * 0.998,
            "prev_close": c["prev_close"],
            "change_pct": c["change_pct"],
            "timestamp": c["timestamp"],
        }
    return None


def get_kline_data(symbol, days=60, freq="daily"):
    """
    获取历史K线数据
    
    Args:
        symbol: 股票代码
        days: 天数
        freq: "daily"=日线, "min5"=5分钟
    
    Returns:
        list of dicts
    """
    try:
        import akshare as ak
        
        if freq == "daily":
            # 新浪历史K线
            df = ak.fund_etf_hist_sina(symbol=f"sh{symbol}")
            # 只取最近days条
            df = df.tail(days)
            result = []
            for _, row in df.iterrows():
                result.append({
                    "date": str(row["date"]),
                    "open": float(row["open"]),
                    "close": float(row["close"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "volume": float(row["volume"]),
                    "amount": float(row["amount"]),
                })
            return result
        elif freq == "min5":
            df = ak.fund_etf_hist_min_em(symbol=symbol)
            df = df.tail(days * 240)  # 假设每天240个5分钟K线
            result = []
            for _, row in df.iterrows():
                result.append({
                    "date": str(row["datetime"]),
                    "open": float(row["open"]),
                    "close": float(row["close"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "volume": float(row["volume"]),
                })
            return result
    
    except Exception as e:
        print(f"⚠ 获取K线数据失败: {e}")
        return []
    
    return []


def get_volatility(symbol, days=30):
    """
    计算波动率
    """
    klines = get_kline_data(symbol, days * 2)
    if not klines or len(klines) < 10:
        return 2.0
    
    closes = [k["close"] for k in klines]
    returns = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(1, len(closes))]
    
    import numpy as np
    daily_vol = float(np.std(returns))
    annual_vol = daily_vol * (240 ** 0.5)
    
    return round(annual_vol, 2)


def manual_price_input(symbol):
    """手动输入价格（fallback）"""
    try:
        price = float(input(f"请输入 {symbol} 当前价格: ").strip())
    except:
        cached = load_cache().get(symbol, {})
        price = cached.get("price", 3.9)
        print(f"  使用缓存价格: {price:.4f}")
    return price


def clear_cache(symbol=None):
    """清除缓存"""
    cache = load_cache()
    if symbol:
        cache.pop(symbol, None)
    else:
        cache.clear()
    save_cache(cache)
    print(f"缓存已清除")


def print_quote(quote):
    """格式化打印行情"""
    if not quote:
        print("  [WARN] 无法获取行情数据")
        return
    
    sign = "+" if quote['change_pct'] >= 0 else ""
    iopv_info = f"  IOPV: {quote['iopv']:.4f}" if quote.get('iopv') else ""
    
    print(f"""
  ╔══════════════════════════════════════╗
  ║  {quote['name']}({quote['symbol']})
  ╠══════════════════════════════════════╣
  ║  最新价: {quote['price']:>10.4f}
  ║  涨跌幅: {sign}{quote['change_pct']:>9.2f}%
  ║  今开:   {quote['open']:>10.4f}
  ║  最高:   {quote['high']:>10.4f}
  ║  最低:   {quote['low']:>10.4f}
  ║  昨收:   {quote['prev_close']:>10.4f}
  ║  成交额: {quote['amount']/1e8:>10.2f}亿
  ║  时间:   {quote['timestamp']:>10s}
  {iopv_info:>38s}
  ╚══════════════════════════════════════╝""")


if __name__ == "__main__":
    import sys
    
    symbol = sys.argv[1] if len(sys.argv) > 1 else "510300"
    
    print(f"=== {symbol} 行情数据 ===")
    
    # 实时行情
    print("\n[1] 实时行情:")
    quote = get_realtime_quote(symbol)
    print_quote(quote)
    
    if quote:
        # 波动率
        vol = get_volatility(symbol)
        print(f"\n[2] 波动率(30日): {vol}%")
        print(f"    建议网格宽度: {vol*0.5:.2f}% - {vol:.2f}%")
        
        # K线统计
        klines = get_kline_data(symbol, 30)
        if klines:
            closes = [k["close"] for k in klines]
            print(f"\n[3] 近30日K线统计:")
            print(f"    最低价: {min(closes):.4f}")
            print(f"    最高价: {max(closes):.4f}")
            print(f"    均价: {sum(closes)/len(closes):.4f}")
            print(f"    波动区间: {max(closes)-min(closes):.4f}")
