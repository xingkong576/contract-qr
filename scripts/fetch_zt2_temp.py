import akshare as ak
import json
import sys

# 获取最近交易日涨停股
dates = ["20260704", "20260703", "20260702"]
for d in dates:
    try:
        df = ak.stock_zt_pool_zdgj_em(date=d)
        if df is not None and len(df) > 0:
            print(f"===ZT-{d}=== (庄股)")
            for _, row in df.head(30).iterrows():
                print(f"{row.get('代码','')},{row.get('名称','')},{row.get('涨跌幅','')},{row.get('最新价','')},{row.get('总市值','') if '总市值' in df.columns else ''}")
            break
    except Exception as e:
        print(f"ZT庄股-{d}: {e}")

# 尝试自然涨停
for d in dates:
    try:
        df = ak.stock_zt_pool_dtfc_em(date=d)
        if df is not None and len(df) > 0:
            print(f"===ZT-NATURAL-{d}===")
            for _, row in df.head(30).iterrows():
                print(f"{row.get('代码','')},{row.get('名称','')},{row.get('涨跌幅','')},{row.get('最新价','')}")
            break
    except Exception as e:
        print(f"ZT自然-{d}: {e}")

# 涨停回顾
for d in dates:
    try:
        df = ak.stock_zt_pool_reversal_em(date=d)
        if df is not None and len(df) > 0:
            print(f"===ZT-REVERSAL-{d}===")
            for _, row in df.head(30).iterrows():
                print(f"{row.get('代码','')},{row.get('名称','')},{row.get('涨跌幅','')},{row.get('最新价','')}")
            break
    except Exception as e:
        print(f"ZT反转-{d}: {e}")

# 连板股
for d in dates:
    try:
        df = ak.stock_zt_pool_order_em(date=d)
        if df is not None and len(df) > 0:
            print(f"===ZT-ORDER-{d}===")
            for _, row in df.head(30).iterrows():
                print(f"{row.get('代码','')},{row.get('名称','')},{row.get('涨跌幅','')},{row.get('最新价','')}")
            break
    except Exception as e:
        print(f"ZT连板-{d}: {e}")
