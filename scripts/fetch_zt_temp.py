import akshare as ak
import json
import sys

try:
    # 涨停股池
    df = ak.stock_zt_pool_em(date="20260704")
    print("===ZT===")
    for _, row in df.head(50).iterrows():
        print(f"{row.get('代码','')},{row.get('名称','')},{row.get('涨跌幅','')},{row.get('最新价','')}")
except Exception as e:
    print(f"ZT_ERROR:{e}")

try:
    # 指数概览
    df2 = ak.stock_zh_index_spot_em()
    print("===INDEX===")
    for _, row in df2.iterrows():
        name = str(row.get('名称',''))
        if any(k in name for k in ['上证','深证','创业板指','沪深300','科创50']):
            print(f"{name},{row.get('最新价','')},{row.get('涨跌幅','')}")
except Exception as e:
    print(f"INDEX_ERROR:{e}")

try:
    # 概念板块
    df3 = ak.stock_board_concept_name_em()
    print("===BOARD===")
    for _, row in df3.iterrows():
        print(f"{row.get('板块名称','')},{row.get('板块代码','')}")
except Exception as e:
    print(f"BOARD_ERROR:{e}")
