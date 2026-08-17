import akshare as ak
import pandas as pd
import json

print('=== 大盘指数 ===')
try:
    df = ak.stock_zh_index_spot_em()
    for idx in ['sh000001', 'sz399001', 'sz399006']:
        row = df[df['代码'] == idx]
        if not row.empty:
            r = row.iloc[0]
            print(f"  {r['名称']} {idx}: {r['最新价']} 涨跌幅: {r['涨跌幅']}%")
except Exception as e:
    print(f'指数失败: {e}')

print()
print('=== 涨幅榜 TOP15 ===')
try:
    df = ak.stock_zh_a_spot_em()
    df = df[df['代码'].str.startswith(('60','00'))]
    df = df.sort_values('涨跌幅', ascending=False).head(15)
    for i, row in df.iterrows():
        print(f"  {row['代码']} {row['名称']:8s} 现价:{row['最新价']} 涨幅:{row['涨跌幅']}% 成交额:{row.get('成交额','')}")
except Exception as e:
    print(f'涨幅榜失败: {e}')

print()
print('=== 成交额 TOP10 ===')
try:
    df2 = ak.stock_zh_a_spot_em()
    df2 = df2[df2['代码'].str.startswith(('60','00'))]
    df2 = df2.sort_values('成交额', ascending=False).head(10)
    for i, row in df2.iterrows():
        amt = row['成交额']
        if amt > 1e8:
            print(f"  {row['代码']} {row['名称']:8s} 成交额:{amt/1e8:.2f}亿 涨幅:{row['涨跌幅']}%")
        else:
            print(f"  {row['代码']} {row['名称']:8s} 成交额:{amt/1e4:.0f}万 涨幅:{row['涨跌幅']}%")
except Exception as e:
    print(f'成交额失败: {e}')

print()
print('=== 板块热度 ===')
try:
    # 行业板块
    df_ind = ak.stock_board_industry_name_em()
    df_ind = df_ind.sort_values('涨跌幅', ascending=False)
    print('行业板块 TOP10:')
    for i, row in df_ind.head(10).iterrows():
        print(f"  {row['板块名称']:12s} 涨幅:{row['涨跌幅']}%")
    print()
    # 概念板块
    df_con = ak.stock_board_concept_name_em()
    df_con = df_con.sort_values('涨跌幅', ascending=False)
    print('概念板块 TOP10:')
    for i, row in df_con.head(10).iterrows():
        print(f"  {row['板块名称']:12s} 涨幅:{row['涨跌幅']}%")
except Exception as e:
    print(f'板块失败: {e}')
