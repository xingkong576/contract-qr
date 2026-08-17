"""
回测模块 - 用历史数据验证网格策略
"""
import sys
import json
from datetime import datetime
from utils import calc_grid_levels, calc_grid_metrics

try:
    import pandas as pd
    import numpy as np
except ImportError:
    print("Warning: pandas/numpy not available")
    pd = None
    np = None


def load_config(path="config.json"):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def run_backtest(symbol, base_price, days=60, price_data=None, config=None):
    """
    网格回测
    
    Args:
        symbol: 股票代码
        base_price: 基准价格
        days: 回测天数
        price_data: 价格列表 [day1_close, day2_close, ...]
        config: 配置字典
    
    回测逻辑（简化网格）：
    - 网格线: base_price +/- N格 * 格宽%
    - 每日检查：
      - 如果收盘价跌入某个网格线以下，在该网格线买入1格
      - 如果收盘价涨到某个买入价+1格以上，在该买入价+1格卖出
      - 每次交易数量 = per_grid_amount / 交易价格
    """
    if config is None:
        config = load_config()
    
    target = None
    for t in config.get("targets", []):
        if t["symbol"] == symbol:
            target = t
            break
    
    if not target:
        target = {
            "grid": {"num_grids": 15, "grid_width_pct": 2.0},
            "capital": {"stock_allocation": 100000, "cash_allocation": 100000},
        }
    
    grid = target["grid"]
    num_grids = grid["num_grids"]
    grid_width_pct = grid["grid_width_pct"]
    stock_alloc = config["capital"]["stock_allocation"]
    cash_alloc = config["capital"]["cash_allocation"]
    per_grid_amount = stock_alloc / num_grids
    
    # 生成模拟数据
    if price_data is None:
        price_data = generate_mock_prices(base_price, days)
    
    # 计算网格线
    levels = calc_grid_levels(base_price, num_grids, grid_width_pct)
    
    # 回测状态
    cash = cash_alloc
    holdings = 0
    
    # 记录每笔买入：(grid_level_idx, price, quantity)
    pending_buys = []
    
    total_bought = 0
    total_sold = 0
    trade_count = 0
    trades = []
    
    for i, price in enumerate(price_data):
        grid_idx = _find_grid_index(price, levels)
        
        # === 买入逻辑 ===
        # 价格下跌到某网格线以下时买入
        # 从当前grid_idx往下找未执行的买入
        for gi in range(grid_idx, -1, -1):
            if cash > 0:
                buy_price = levels[gi]
                # 只买未买过的
                if any(b[0] == gi for b in pending_buys):
                    continue
                buy_qty = max(100, int(per_grid_amount / buy_price / 100) * 100)
                buy_amount = buy_qty * buy_price
                if cash >= buy_amount:
                    cash -= buy_amount
                    holdings += buy_qty
                    total_bought += buy_amount
                    trade_count += 1
                    pending_buys.append((gi, buy_price, buy_qty))
                    trades.append({
                        "day": i, "price": round(buy_price, 4),
                        "action": "BUY", "quantity": buy_qty,
                    })
        
        # === 卖出逻辑 ===
        # 检查所有未卖出的买入单，看有没有到止盈价位
        remaining = []
        for gi, buy_price, buy_qty in pending_buys:
            # 止盈价位：买入价所在网格的上方一格
            sell_price = levels[gi + 1] if gi + 1 < len(levels) else levels[-1]
            
            if price >= sell_price and buy_qty > 0 and holdings >= buy_qty:
                # 可以卖出
                sell_amount = buy_qty * sell_price
                stamp_tax = sell_amount * 0.0005  # 0.05%印花税
                cash += sell_amount - stamp_tax
                holdings -= buy_qty
                total_sold += sell_amount - stamp_tax
                trade_count += 1
                trades.append({
                    "day": i, "price": round(sell_price, 4),
                    "action": "SELL", "quantity": buy_qty,
                })
            else:
                remaining.append((gi, buy_price, buy_qty))
        
        pending_buys = remaining
    
    # 最终净值
    final_price = price_data[-1] if price_data else base_price
    final_stock_value = holdings * final_price
    final_total = cash + final_stock_value
    
    initial_investment = stock_alloc + cash_alloc
    grid_profit = total_sold - total_bought
    buy_hold_return = (final_price - price_data[0]) / price_data[0] * 100 if price_data else 0
    total_return = (final_total - initial_investment) / initial_investment * 100
    
    return {
        "symbol": symbol,
        "base_price": base_price,
        "start_price": price_data[0] if price_data else base_price,
        "end_price": final_price,
        "num_days": len(price_data),
        "num_grids": num_grids,
        "grid_width_pct": grid_width_pct,
        "total_trades": trade_count,
        "total_bought": round(total_bought, 2),
        "total_sold": round(total_sold, 2),
        "grid_profit": round(grid_profit, 2),
        "final_cash": round(cash, 2),
        "final_holdings": holdings,
        "final_stock_value": round(final_stock_value, 2),
        "final_total": round(final_total, 2),
        "total_return": round(total_return, 2),
        "buy_hold_return": round(buy_hold_return, 2),
        "trades": trades,
    }


def _find_grid_index(price, levels):
    for i in range(len(levels) - 1):
        if levels[i] <= price < levels[i + 1]:
            return i
    if price >= levels[-1]:
        return len(levels) - 1
    return 0


def generate_mock_prices(base_price, days):
    """生成模拟价格数据（随机游走）"""
    if np is None:
        # 无numpy时生成简单震荡
        import random
        prices = [base_price]
        for i in range(days):
            ret = random.gauss(0, 0.015)
            prices.append(prices[-1] * (1 + ret))
        return prices
    
    np.random.seed(42)
    daily_vol = 0.015
    returns = np.random.normal(0, daily_vol, days)
    prices = [base_price]
    for r in returns:
        prices.append(prices[-1] * (1 + r))
    return prices


def print_results(results):
    """打印回测报告"""
    print("\n" + "=" * 60)
    print(f"  网格策略回测报告 - {results['symbol']}")
    print("=" * 60)
    print(f"  回测区间: {results['num_days']}天")
    print(f"  网格参数: {results['num_grids']}格 x {results['grid_width_pct']}%")
    print(f"  基准价格: {results['base_price']:.4f}")
    print(f"  起始价: {results['start_price']:.4f} -> 结束价: {results['end_price']:.4f}")
    print(f"  价格涨跌: {results['start_price']:.4f} -> {results['end_price']:.4f} ({results['buy_hold_return']:+.2f}%)")
    print()
    print(f"  总交易次数: {results['total_trades']}次")
    print(f"  总买入金额: RMB {results['total_bought']:,.0f}")
    print(f"  总卖出金额: RMB {results['total_sold']:,.0f}")
    print(f"  网格利润:   RMB {results['grid_profit']:,.0f}")
    print()
    print(f"  最终现金: RMB {results['final_cash']:,.0f}")
    print(f"  最终持仓: {results['final_holdings']}股 (价值 RMB {results['final_stock_value']:,.0f})")
    print(f"  总资产: RMB {results['final_total']:,.0f}")
    print(f"  总收益: {results['total_return']:+.2f}%")
    print()
    print(f"  网格策略: {results['total_return']:+.2f}%")
    print(f"  买入持有: {results['buy_hold_return']:+.2f}%")
    alpha = results['total_return'] - results['buy_hold_return']
    print(f"  超额收益: {alpha:+.2f}%")
    print("=" * 60)


if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "510300"
    base_price = float(sys.argv[2]) if len(sys.argv) > 2 else 3.90
    days = int(sys.argv[3]) if len(sys.argv) > 3 else 60
    
    price_data = generate_mock_prices(base_price, days)
    results = run_backtest(symbol, base_price, days, price_data)
    print_results(results)
    
    if results["trades"]:
        print(f"\n  交易明细 (前20笔):")
        for t in results["trades"][:20]:
            print(f"    Day {t['day']}: {t['action']} {t['price']:.4f} x {t['quantity']}股")
        if len(results["trades"]) > 20:
            print(f"    ... 共 {len(results['trades'])} 笔")
