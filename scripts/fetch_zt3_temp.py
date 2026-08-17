import akshare as ak
import json
import sys

# 列出所有 stock_zt 相关函数
zt_funcs = [f for f in dir(ak) if 'zt' in f.lower()]
print("=== Available zt functions ===")
for f in zt_funcs:
    print(f)

# 尝试 stock_zt_pool_em
try:
    df = ak.stock_zt_pool_em(date="20260704")
    print(f"\n=== ZT POOL 20260704: {len(df)} rows ===")
    cols = list(df.columns)
    print(f"Columns: {cols}")
    for _, row in df.head(30).iterrows():
        vals = {c: row.get(c, '') for c in cols[:8]}
        print(vals)
except Exception as e:
    print(f"ZT_POOL error: {e}")

# 尝试 stock_zt_pool_previous_em
try:
    df2 = ak.stock_zt_pool_previous_em()
    print(f"\n=== PREVIOUS ZT: {len(df2)} rows ===")
    cols2 = list(df2.columns)
    print(f"Columns: {cols2}")
    for _, row in df2.head(30).iterrows():
        vals = {c: row.get(c, '') for c in cols2[:8]}
        print(vals)
except Exception as e:
    print(f"PREVIOUS error: {e}")
