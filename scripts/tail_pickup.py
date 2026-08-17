#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""尾盘选股脚本 - 14:30 收盘前半小时"""
import akshare as ak
import pandas as pd
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("=" * 70)
    print("  尾盘选股报告 - 14:30 收盘前半小时")
    print("=" * 70)
    
    # 获取实时行情
    print("\n[+] 获取全市场行情数据...")
    df = ak.stock_zh_a_spot_em()
    
    # 过滤：主板 + 非ST
    mask = (
        (df['代码'].str.startswith('60')) | 
        (df['代码'].str.startswith('00'))
    ) & (~df['名称'].str.contains('ST|退', na=False))
    df_main = df[mask].copy()
    
    # 确保数值列
    for col in ['最新价', '涨跌幅', '成交额', '换手率']:
        df_main[col] = pd.to_numeric(df_main[col], errors='coerce')
    
    # 1. 大盘指数
    print("\n" + "=" * 70)
    print("  [1] 大盘指数")
    print("=" * 70)
    try:
        sz_component = ak.stock_zh_index_spot_em()
        for _, r in sz_component.head(5).iterrows():
            print(f"  {r['名称']}({r['代码']})  点位:{r['最新价']}  涨跌幅:{r['涨跌幅']:.2f}%")
    except Exception as e:
        print(f"  [!] 指数获取失败: {e}")
    
    # 2. 涨幅榜 TOP15
    print("\n" + "=" * 70)
    print("  [2] 涨幅榜 TOP15（尾盘强势股候选）")
    print("=" * 70)
    top_up = df_main.nlargest(15, '涨跌幅')
    for i, (_, r) in enumerate(top_up.iterrows()):
        flag = "T" if r['涨跌幅'] >= 9.9 else "S" if r['涨跌幅'] >= 7 else "*" if r['涨跌幅'] >= 5 else "+"
        print(f"  [{flag}] {r['名称']:<8}({r['代码']})  现价:{r['最新价']:>8.2f}  涨幅:{r['涨跌幅']:>6.2f}%  成交额:{r['成交额']/1e8:>7.2f}亿  换手:{r['换手率']:>5.1f}%")
    
    # 3. 成交额 TOP15（资金流向）
    print("\n" + "=" * 70)
    print("  [3] 成交额 TOP15（主力资金流向）")
    print("=" * 70)
    top_amt = df_main.nlargest(15, '成交额')
    for i, (_, r) in enumerate(top_amt.iterrows()):
        flag = "$" if r['涨跌幅'] > 0 else "-"
        print(f"  [{flag}] {r['名称']:<8}({r['代码']})  现价:{r['最新价']:>8.2f}  涨幅:{r['涨跌幅']:>6.2f}%  成交额:{r['成交额']/1e8:>7.2f}亿")
    
    # 4. 尾盘强势股筛选（涨幅3-7%，成交额>5亿，换手率3-15%）
    print("\n" + "=" * 70)
    print("  [4] 尾盘强势股精选（涨幅3-7%，成交额>5亿，换手3-15%）")
    print("=" * 70)
    strong = df_main[
        (df_main['涨跌幅'] >= 3) & 
        (df_main['涨跌幅'] <= 7) & 
        (df_main['成交额'] > 5e8) &
        (df_main['换手率'] >= 3) &
        (df_main['换手率'] <= 20)
    ].nlargest(10, '成交额')
    if len(strong) > 0:
        for _, r in strong.iterrows():
            print(f"  [*] {r['名称']:<8}({r['代码']})  现价:{r['最新价']:>8.2f}  涨幅:{r['涨跌幅']:>6.2f}%  成交额:{r['成交额']/1e8:>7.2f}亿  换手:{r['换手率']:>5.1f}%")
    else:
        print("  无符合条件的个股")
    
    # 5. 板块热度
    print("\n" + "=" * 70)
    print("  [5] 板块热度（概念板块涨幅TOP10）")
    print("=" * 70)
    try:
        sector = ak.stock_board_concept_name_em()
        sector_sorted = sector.nlargest(10, '涨跌幅')
        for _, r in sector_sorted.iterrows():
            print(f"  > {r['板块名称']:<15}  涨幅:{r['涨跌幅']:>6.2f}%  领涨:{r['领涨股票'] if '领涨股票' in r.columns else '--'}")
    except Exception as e:
        print(f"  [!] 板块数据获取失败: {e}")
    
    # 6. 资金流向
    print("\n" + "=" * 70)
    print("  [6] 个股资金流向 TOP15（今日主力净流入）")
    print("=" * 70)
    try:
        fund = ak.stock_individual_fund_flow_rank(indicator='今日')
        fund_filtered = fund[(fund['代码'].str.startswith('60')) | (fund['代码'].str.startswith('00'))]
        fund_filtered = fund_filtered[~fund_filtered['名称'].str.contains('ST|退', na=False)]
        fund_top = fund_filtered.nlargest(15, '主力净流入-净额')
        for _, r in fund_top.iterrows():
            net = r['主力净流入-净额']
            if hasattr(net, '__float__'):
                net_val = float(net)
            else:
                net_val = net
            flag = "+" if net_val > 0 else ""
            print(f"  [{flag}] {r['名称']:<8}({r['代码']})  主力净流入:{net_val/1e8:>8.2f}亿  涨幅:{r['涨跌幅'] if '涨跌幅' in r.columns else '--'}%")
    except Exception as e:
        print(f"  [!] 资金流向获取失败: {e}")

if __name__ == '__main__':
    main()
