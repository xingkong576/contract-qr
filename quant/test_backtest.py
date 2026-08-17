# -*- coding: utf-8 -*-
"""震荡行情回测测试"""
import numpy as np
from backtest import run_backtest, print_results

np.random.seed(123)

# 模拟震荡行情：价格围绕3.90在3.70-4.10之间波动
base_price = 3.90
days = 60

prices = [base_price]
for i in range(days):
    # 均值回归：拉向中间
    mean_reversion = (3.90 - prices[-1]) / 3.90 * 0.1
    noise = np.random.normal(0, 0.012)
    ret = mean_reversion + noise
    new_price = prices[-1] * (1 + ret)
    # 限制范围
    new_price = max(3.65, min(4.15, new_price))
    prices.append(new_price)

print(f"价格范围: {min(prices):.4f} - {max(prices):.4f}")
print(f"起始: {prices[0]:.4f} -> 结束: {prices[-1]:.4f}")
print(f"涨跌幅: {(prices[-1]-prices[0])/prices[0]*100:+.2f}%\n")

results = run_backtest("510300", base_price, days, prices)
print_results(results)

# 多轮随机种子测试
print("\n=== 多轮随机测试（50次不同随机种子） ===")
seeds = range(50)
win_count = 0
avg_alpha = 0

for seed in seeds:
    np.random.seed(seed)
    mock_prices = [base_price]
    for i in range(days):
        mean_reversion = (3.90 - mock_prices[-1]) / 3.90 * 0.1
        noise = np.random.normal(0, 0.012)
        mock_prices.append(max(3.65, min(4.15, mock_prices[-1] * (1 + mean_reversion + noise))))
    
    r = run_backtest("510300", base_price, days, mock_prices)
    alpha = r["total_return"] - r["buy_hold_return"]
    avg_alpha += alpha
    if alpha > 0:
        win_count += 1

print(f"震荡行情胜率: {win_count}/50 ({win_count*2}% 回合跑赢买入持有)")
print(f"平均超额收益: {avg_alpha/50:+.2f}%")
