"""
网格交易信号生成器（非交互式）
用法: python signal_gen.py <股票代码> [当前价格] [网格数] [网格%] [资金]
示例: python signal_gen.py 600060 28.00
      python signal_gen.py 601778 4.86
"""
import sys

NAMES = {
    '600060': '海信视像',
    '601778': '晶科科技',
}

def generate_signal(symbol, current_price, num_grids, grid_pct, cash):
    name = NAMES.get(symbol, symbol)
    step = current_price * grid_pct / 100.0
    lower = current_price - (num_grids // 2) * step
    
    print(f"\n{'=' * 60}")
    print(f"  网格交易信号 - {symbol} {name}")
    print(f"  当前价格: {current_price}")
    print(f"{'=' * 60}")
    print(f"\n  参数: {num_grids}格 x {grid_pct}% | 资金: RMB {cash:,.0f}")
    print(f"  网格间距: {step:.2f}元 | 每格资金: RMB {cash/num_grids:,.0f}")
    
    levels = [round(lower + step * i, 2) for i in range(num_grids + 1)]
    
    # 找当前所在格
    current_grid = -1
    for i in range(num_grids):
        if levels[i] <= current_price < levels[i + 1]:
            current_grid = i
            break
    if current_grid < 0:
        if current_price >= levels[-1]:
            current_grid = num_grids
        else:
            current_grid = 0
    
    print(f"\n  当前所在区间: 第 {current_grid + 1}/{num_grids + 1} 格")
    print(f"\n  {'=' * 60}")
    print(f"  网格线")
    print(f"  {'=' * 60}")
    print(f"  {'线':>4s} | {'价格':>8s} | {'距现价':>8s} | {'信号'}")
    print(f"  {'-' * 60}")
    
    for i, level in enumerate(levels):
        diff = round(level - current_price, 2)
        diff_str = f"{diff:+.2f}"
        
        if i == current_grid + 1:
            marker = ">>"
            signal = "当前区间"
        else:
            marker = "  "
        
        if i <= current_grid:
            signal = "买入" if i < current_grid else "当前下方"
        else:
            signal = "卖出" if i > current_grid + 1 else "当前上方"
        
        print(f"  L{marker}{i:>2d} | {level:>8.2f} | {diff_str:>8s} | {signal}")
    
    # 买入信号
    print(f"\n  {'=' * 60}")
    print(f"  买入信号（价格跌至）")
    print(f"  {'=' * 60}")
    for i in range(current_grid + 1):
        level = levels[i]
        qty = max(100, int((cash / num_grids) / level / 100) * 100)
        cost = qty * level
        sell_at = levels[i + 1]
        profit = round(qty * step * 0.999, 0)
        print(f"    跌至 {level:.2f} | 买{qty}股({cost:,.0f}) | 卖{sell_at:.2f} | 盈利{profit:,.0f}")
    
    # 卖出信号
    print(f"\n  {'=' * 60}")
    print(f"  卖出信号（价格涨至）")
    print(f"  {'=' * 60}")
    for i in range(current_grid + 2, num_grids + 1):
        buy_level = levels[i - 1]
        sell_level = levels[i]
        qty = max(100, int((cash / num_grids) / buy_level / 100) * 100)
        profit = round(qty * (sell_level - buy_level) * 0.999, 0)
        print(f"    涨至 {sell_level:.2f} | 卖{qty}股({buy_level:.2f}) | 盈利{profit:,.0f}")
    
    # 最大风险
    max_drop = round((1 - levels[0] / current_price) * 100, 1)
    max_loss = round(cash * max_drop / 100, 0)
    print(f"\n  {'=' * 60}")
    print(f"  风险提示")
    print(f"  {'=' * 60}")
    print(f"  最低网格价: {levels[0]:.2f}")
    print(f"  最大浮亏: {max_drop}% (约 {max_loss:,.0f}元)")
    print(f"  止损建议: 跌破 {levels[0]:.2f} 考虑离场")
    print(f"  每笔盈利: ~{step/current_price*100:.1f}% ({(cash/num_grids)*step/current_price:.0f}元)")


def main():
    if len(sys.argv) >= 5:
        symbol = sys.argv[1]
        current_price = float(sys.argv[2])
        num_grids = int(sys.argv[3])
        grid_pct = float(sys.argv[4])
        cash = int(sys.argv[5]) if len(sys.argv) > 5 else 100000
    elif len(sys.argv) >= 3:
        symbol = sys.argv[1]
        current_price = float(sys.argv[2])
        num_grids = 10
        grid_pct = 3.0
        cash = 100000
    else:
        print("用法: python signal_gen.py <代码> <价格> [格数] [格%] [资金]")
        print("示例: python signal_gen.py 600060 28.00")
        print("      python signal_gen.py 601778 4.86")
        return
    
    generate_signal(symbol, current_price, num_grids, grid_pct, cash)


if __name__ == "__main__":
    main()
