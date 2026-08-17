# -*- coding: utf-8 -*-
"""Debug: 检查回测逻辑"""
import numpy as np
from backtest import run_backtest, load_config

np.random.seed(123)
base_price = 3.90
days = 60

prices = [base_price]
for i in range(days):
    mean_reversion = (3.90 - prices[-1]) / 3.90 * 0.1
    noise = np.random.normal(0, 0.012)
    ret = mean_reversion + noise
    new_price = prices[-1] * (1 + ret)
    new_price = max(3.65, min(4.15, new_price))
    prices.append(new_price)

print("价格序列(前20天):")
for i, p in enumerate(prices[:20]):
    print(f"  Day {i}: {p:.4f}")

results = run_backtest("510300", base_price, days, prices)

print(f"\n初始现金: {results['final_cash'] + results['total_bought'] - results['total_sold']:.0f}")
print(f"最终现金: {results['final_cash']:,.0f}")
print(f"持仓: {results['final_holdings']}股 价值 {results['final_stock_value']:,.0f}")
print(f"总资产: {results['final_total']:,.0f}")
print(f"买入总金额: {results['total_bought']:,.0f}")
print(f"卖出总金额: {results['total_sold']:,.0f}")
print(f"交易次数: {results['total_trades']}")
print(f"网格利润(仅交易): {results['grid_profit']:,.0f}")

# 打印每笔交易
print("\n交易明细:")
for t in results["trades"][:30]:
    print(f"  Day {t['day']}: {t['action']} {t['price']:.4f} x {t['quantity']}股")
