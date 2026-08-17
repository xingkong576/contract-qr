"""
601778 晶科科技 - 网格回测（修正版：正确计算已实现收益）
"""

DATA_STR = """2026-03-02,4.75,4.60,4.79,4.54,2726314,1264726593.00
2026-03-03,4.60,4.53,4.70,4.49,2267789,1037682631.00
2026-03-04,4.45,4.54,4.62,4.41,1421644,644687993.00
2026-03-05,4.60,4.69,4.73,4.56,2499330,1166344592.00
2026-03-06,4.69,4.87,4.99,4.62,3498394,1687531011.00
2026-03-09,4.80,5.10,5.23,4.80,4066823,2049509625.00
2026-03-10,5.06,5.61,5.61,4.96,5269752,2825091750.00
2026-03-11,5.78,5.90,6.17,5.52,7967185,4669783044.00
2026-03-12,5.91,6.14,6.38,5.91,7508808,4582760740.00
2026-03-13,6.10,5.80,6.15,5.75,5701567,3366528604.00
2026-03-16,5.80,5.38,5.85,5.24,4459227,2406475751.00
2026-03-17,5.37,5.36,5.66,5.33,3936304,2155263442.00
2026-03-18,5.31,5.32,5.50,5.18,3156130,1680634195.00
2026-03-19,5.19,5.40,5.55,5.19,3405775,1842121906.00
2026-03-20,5.34,5.34,5.62,5.25,3566886,1937958557.00
2026-03-23,5.20,5.38,5.50,5.10,3520771,1888196566.00
2026-03-24,5.46,5.55,5.55,5.20,3954879,2135350697.00
2026-03-25,5.53,5.92,5.94,5.47,4922670,2829051404.00
2026-03-26,5.80,5.69,5.88,5.63,3505488,2012360479.00
2026-03-27,5.55,5.52,5.69,5.50,2384709,1332031670.00
2026-03-30,5.40,5.14,5.41,4.97,2965095,1530238347.00
2026-03-31,5.06,4.89,5.14,4.88,2493883,1243645150.00
2026-04-01,5.02,4.98,5.08,4.91,1973529,984786817.00
2026-04-02,4.96,4.71,4.96,4.64,2227694,1060254847.00
2026-04-03,4.75,4.87,4.87,4.67,1918647,921249835.00
2026-04-07,4.87,4.90,4.99,4.78,1245318,611654208.00
2026-04-08,4.99,5.09,5.13,4.94,1959553,992674432.00
2026-04-09,5.01,5.08,5.14,4.94,1432888,725683919.00
2026-04-10,5.08,5.05,5.10,4.99,1379195,694964203.00
2026-04-13,5.00,5.48,5.53,4.98,3419121,1804527814.00
2026-04-14,5.56,6.03,6.03,5.55,5584423,3291803939.00
2026-04-15,6.02,6.05,6.14,5.78,6052616,3628347054.00
2026-04-16,6.25,6.66,6.66,6.20,7491227,4899616970.00
2026-04-17,7.00,6.91,7.33,6.86,10910730,7740995281.00
2026-04-20,6.80,6.51,6.86,6.38,8134380,5306072137.00
2026-04-21,6.42,6.35,6.45,5.97,6928355,4291200583.00
2026-04-22,6.45,6.54,6.85,6.43,7334948,4828136825.00
2026-04-23,6.87,7.19,7.19,6.35,8283896,5615563595.00
2026-04-24,7.54,7.17,7.88,7.14,10166424,7597041840.00
2026-04-27,7.14,6.94,7.20,6.90,6124901,4287366148.00
2026-04-28,6.85,7.12,7.48,6.85,7032761,5053169936.00
2026-04-29,6.57,6.96,7.18,6.57,6526741,4540567356.00
2026-04-30,6.80,6.50,6.88,6.34,5873226,3834742968.00
2026-05-06,6.72,7.15,7.15,6.71,5068861,3503440017.00
2026-05-07,7.36,7.42,7.58,7.25,6384360,4700668281.00
2026-05-08,7.41,7.39,7.53,7.17,5073373,3722284663.00
2026-05-11,7.50,7.30,7.70,7.25,5598967,4189606575.00
2026-05-12,7.38,7.10,7.45,6.96,4099202,2919757676.00
2026-05-13,7.09,7.14,7.66,7.01,6945774,5072141762.00
2026-05-14,7.24,7.52,7.85,7.16,9636181,7334013258.00
2026-05-15,7.38,6.96,7.38,6.85,7241210,5128397298.00
2026-05-18,6.93,6.60,7.09,6.51,4304093,2895001026.00
2026-05-19,6.58,6.67,6.71,6.31,3389754,2222139933.00
2026-05-20,6.55,6.43,6.67,6.21,3251445,2091916364.00
2026-05-21,6.44,6.11,6.53,6.09,2924171,1837787509.00
2026-05-22,6.13,6.33,6.36,6.06,2123282,1334675056.00
2026-05-25,6.34,6.60,6.85,6.33,3614885,2402641093.00
2026-05-26,6.54,6.33,6.54,6.21,2377755,1505576834.00
2026-05-27,6.26,6.25,6.39,6.17,2059082,1293351552.00
2026-05-28,6.35,6.26,6.37,6.16,2163459,1355697843.00
2026-05-29,6.21,5.93,6.25,5.89,2729843,1654372012.00
2026-06-01,5.98,5.85,6.03,5.72,1978945,1160735204.00
2026-06-02,5.79,5.84,5.88,5.44,2640351,1501441446.00
2026-06-03,5.76,5.79,5.88,5.66,2068206,1192845508.00
2026-06-04,5.71,5.60,5.87,5.56,2177247,1236300531.00
2026-06-05,5.66,5.33,5.69,5.30,2318918,1253855675.00
2026-06-08,5.18,5.03,5.30,4.97,1996004,1019442780.00
2026-06-09,5.15,5.17,5.19,4.94,1831155,930814968.00
2026-06-10,5.12,4.97,5.13,4.89,1629845,810235820.00
2026-06-11,4.91,4.86,4.95,4.81,1295279,630734534.00"""

def parse_data(raw):
    prices = []
    for line in raw.strip().split('\n'):
        parts = line.split(',')
        prices.append({
            'date': parts[0],
            'open': float(parts[1]),
            'close': float(parts[2]),
            'high': float(parts[3]),
            'low': float(parts[4]),
        })
    return prices


def run_backtest(prices, base_price, num_grids, grid_width_pct, cash_alloc=100000):
    """
    网格回测 - 修正版
    
    关键修正：已实现利润 = sum(每笔卖出的盈利)
    而不是 total_sold - total_bought（后者包含了未卖出的持仓）
    """
    grid_step = base_price * grid_width_pct / 100.0
    lower = base_price - (num_grids // 2) * grid_step
    levels = []
    for i in range(num_grids + 1):
        levels.append(round(lower + grid_step * i, 4))
    
    per_grid_amount = cash_alloc / num_grids
    
    cash = cash_alloc
    holdings = 0
    realized_profit = 0  # 已实现利润：每笔卖出的实际盈利
    
    pending = []  # [(grid_idx, buy_price, buy_qty)]
    completed_trades = 0  # 完整成交次数
    
    for day, price in enumerate(prices):
        close = price['close']
        
        # 找到价格所在的网格索引
        grid_idx = -1
        for i in range(num_grids):
            if levels[i] <= close < levels[i + 1]:
                grid_idx = i
                break
        if grid_idx < 0:
            if close >= levels[-1]:
                grid_idx = num_grids
            else:
                grid_idx = 0
        
        # === 买入 ===
        for gi in range(grid_idx, -1, -1):
            if any(p[0] == gi for p in pending):
                continue
            buy_price = levels[gi]
            buy_qty = max(100, int(per_grid_amount / buy_price / 100) * 100)
            buy_amount = buy_qty * buy_price
            if cash >= buy_amount:
                cash -= buy_amount
                holdings += buy_qty
                pending.append((gi, buy_price, buy_qty))
        
        # === 卖出 ===
        remaining = []
        for gi, buy_price, buy_qty in pending:
            sell_level = levels[gi + 1] if gi + 1 <= num_grids else levels[-1]
            if close >= sell_level and buy_qty > 0:
                sell_amount = sell_qty_calc = buy_qty * sell_level
                stamp_tax = sell_amount * 0.0005
                sell_net = sell_amount - stamp_tax
                buy_cost = buy_qty * buy_price
                profit = sell_net - buy_cost
                realized_profit += profit
                cash += sell_net
                holdings -= buy_qty
                completed_trades += 1
                # 记录成交历史
                if not hasattr(run_backtest, '_history'):
                    run_backtest._history = {}
                key = f"{num_grids}_{grid_width_pct}"
                if key not in run_backtest._history:
                    run_backtest._history[key] = []
                run_backtest._history[key].append({
                    'day': day, 'date': price['date'],
                    'action': 'SELL', 'price': sell_level, 'qty': buy_qty,
                    'profit': profit,
                })
            else:
                remaining.append((gi, buy_price, buy_qty))
        pending = remaining
    
    final_price = prices[-1]['close']
    final_stock_value = holdings * final_price
    final_total = cash + final_stock_value
    buy_hold_return = (final_price - prices[0]['close']) / prices[0]['close'] * 100
    grid_total_return = (final_total - cash_alloc) / cash_alloc * 100
    
    return {
        'num_grids': num_grids,
        'grid_width_pct': grid_width_pct,
        'levels': levels,
        'completed_trades': completed_trades,
        'realized_profit': round(realized_profit, 2),  # === 已实现利润（正确！）===
        'final_cash': round(cash, 2),
        'final_holdings': holdings,
        'final_stock_value': round(final_stock_value, 2),
        'final_total': round(final_total, 2),
        'grid_total_return': round(grid_total_return, 2),
        'buy_hold_return': round(buy_hold_return, 2),
        'unrealized_holdings': holdings,  # 期末未平仓持仓
    }


def print_results(label, r):
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    print(f"  网格: {r['num_grids']}格 x {r['grid_width_pct']}%")
    print(f"  完成交易笔数: {r['completed_trades']}笔")
    print(f"  ** 已实现利润: RMB {r['realized_profit']:,.2f} **")
    print(f"  期末未平仓持仓: {r['final_holdings']}股 (价值 RMB {r['final_stock_value']:,.0f})")
    print(f"  期末现金: RMB {r['final_cash']:,.2f}")
    print(f"  总资产: RMB {r['final_total']:,.2f}")
    print(f"  网格策略总收益: {r['grid_total_return']:+.2f}%")
    print(f"  买入持有收益:   {r['buy_hold_return']:+.2f}%")
    if r['realized_profit'] > 0:
        print(f"  [OK] 网格交易赚钱了！")
    else:
        print(f"  [FAIL] 网格交易没赚钱")


def main():
    prices = parse_data(DATA_STR)
    n = len(prices)
    print(f"\n{'=' * 60}")
    print(f"  601778 晶科科技 - 网格回测（修正版）")
    print(f"{'=' * 60}")
    print(f"  回测区间: {prices[0]['date']} 至 {prices[-1]['date']} ({n}个交易日)")
    print(f"  起始价: {prices[0]['close']:.2f} → 结束价: {prices[-1]['close']:.2f}")
    print(f"  最高价: {max(p['close'] for p in prices):.2f}")
    print(f"  最低价: {min(p['close'] for p in prices):.2f}")
    print(f"  振幅: {(max(p['close'] for p in prices) - min(p['close'] for p in prices)) / min(p['close'] for p in prices) * 100:.1f}%")
    
    run_backtest._history = {}
    
    configs = [
        (15, 2.5),
        (20, 2.0),
        (12, 3.0),
        (20, 3.0),
        (10, 2.0),
        (10, 3.0),
    ]
    
    for ng, gw in configs:
        r = run_backtest(prices, prices[0]['close'], ng, gw, 100000)
        print_results(f"{ng}格 x {gw}%", r)
    
    # 打印方案A的详细交易
    print(f"\n{'=' * 60}")
    print(f"  15格 x 2.5% 完整交易明细")
    print(f"{'=' * 60}")
    hist = run_backtest._history.get("15_2.5", [])
    # 买入交易也需要补
    for p in prices:
        pass  # 只打印卖出的
    
    total_profit = sum(t['profit'] for t in hist)
    print(f"\n  共完成 {len(hist)} 笔卖出交易")
    print(f"  总已实现利润: {total_profit:+,.2f}")
    print(f"\n  最后10笔卖出:")
    for t in hist[-10:]:
        print(f"    {t['date']} | 卖出 {t['price']:.2f} x {t['qty']}股 | 盈利 {t['profit']:+,.2f}")


if __name__ == "__main__":
    main()
