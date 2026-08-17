"""
实时监控面板
在终端中实时显示网格交易状态，检测交易信号
"""
import sys
import time
import os
from datetime import datetime
from grid_engine import GridEngine
from utils import get_trading_hours, log_trade
from data_fetcher import get_realtime_quote, print_quote as fmt_quote


def clear_screen():
    """清屏"""
    os.system("cls" if os.name == "nt" else "clear")


def draw_header():
    """绘制头部"""
    now = datetime.now()
    trading = "🟢 交易中" if get_trading_hours(now) else "⚪ 非交易时间"
    
    print("=" * 70)
    print(f"  📊 A股网格交易系统 - {now.strftime('%Y-%m-%d %H:%M:%S')}  {trading}")
    print("=" * 70)


def draw_grid_status(engine, symbol):
    """绘制单个标的的网格状态"""
    state = engine.grid_state.get(symbol)
    if not state:
        print(f"  ⚠️  {symbol} 未初始化")
        return
    
    quote = get_realtime_quote(symbol)
    if not quote:
        return
    
    m = state["metrics"]
    levels = state["levels"]
    
    # 当前价格所在网格位置
    grid_idx = None
    for i in range(len(levels) - 1):
        if levels[i] <= quote["price"] <= levels[i + 1]:
            grid_idx = i
            break
    
    # 网格可视化
    level_width = 3
    grid_bar = ""
    for i in range(len(levels)):
        if i == grid_idx:
            grid_bar += f"{'█' * level_width}"  # 当前网格
        elif levels[i] <= quote["price"]:
            grid_bar += f"{'▓' * level_width}"  # 已穿过
        else:
            grid_bar += f"{' ' * level_width}"  # 未到达
    
    print(f"""
  ┌─────────────────────────────────────────────────────┐
  │ 📈 {state['target']['name']} ({symbol})                    │
  ├─────────────────────────────────────────────────────┤
  │ 当前价: {quote['price']:.4f}  ({quote['change_pct']:+.2f}%)         │
  │ 持仓: {state['holdings']}股 | 现金: ¥{state['cash']:,.0f}        │
  │ 网格: {m['num_grids']}格 × {m['step_pct']}% | 区间: {m['lower_price']:.4f}-{m['upper_price']:.4f} │
  │ 预估月收益: ¥{m['monthly_profit_est']:,.0f} ({m['annual_return_est']:.1f}%年化)          │
  │                                                     │
  │ 网格: {grid_bar} │
  │              ↑ 当前网格位置                        │
  └─────────────────────────────────────────────────────┘
""")


def draw_trades(trades):
    """绘制交易信号"""
    if not trades:
        return
    
    print("  📢 交易信号:")
    for trade in trades:
        emoji = "🟢买入" if trade["action"] == "BUY" else "🔴卖出"
        if trade["action"] == "STOP_LOSS":
            emoji = "🚨止损"
        print(f"     {emoji} {trade['symbol']} @ {trade['price']:.4f} x {trade['quantity']} = ¥{trade['amount']:,.0f}")
        print(f"     原因: {trade.get('reason', '')}")


def main():
    """主循环"""
    engine = GridEngine()
    
    # 初始化所有标的
    for target in engine.config["targets"]:
        engine.init_grid(target)
    
    # 运行模式
    if "--once" in sys.argv:
        # 单次检查模式
        engine.print_summary()
        for target in engine.config["targets"]:
            trades = engine.check_and_trade(target["symbol"])
            if trades:
                draw_trades(trades)
        return
    
    # 实时循环模式
    interval = engine.config["trading"]["check_interval_seconds"]
    last_trade_symbols = set()
    
    print("\n🚀 网格交易系统启动中...")
    print(f"   检查间隔: {interval}秒")
    print("   按 Ctrl+C 退出\n")
    
    try:
        while True:
            now = datetime.now()
            
            # 非交易时间简化显示
            if not get_trading_hours(now):
                clear_screen()
                draw_header()
                print("\n  ⏸️ 当前非交易时间，等待开盘...")
                print(f"  下次检查: {(now + __import__('datetime').timedelta(seconds=interval)).strftime('%H:%M:%S')}\n")
                time.sleep(interval)
                continue
            
            clear_screen()
            draw_header()
            
            # 绘制所有标的状态
            for target in engine.config["targets"]:
                symbol = target["symbol"]
                draw_grid_status(engine, symbol)
            
            # 检查交易信号
            for target in engine.config["targets"]:
                symbol = target["symbol"]
                trades = engine.check_and_trade(symbol)
                if trades:
                    draw_trades(trades)
                    # 记录交易日志
                    for trade in trades:
                        if trade["action"] in ("BUY", "SELL"):
                            cost = log_trade(
                                trade["symbol"],
                                "buy" if trade["action"] == "BUY" else "sell",
                                trade["price"],
                                trade["quantity"],
                                trade["amount"],
                                trade["grid_level"]
                            )
                            print(f"     📝 交易日志已保存 (手续费: ¥{cost:.2f})")
                    last_trade_symbols.update(t["symbol"] for t in trades)
            
            if not last_trade_symbols:
                print("\n  💤 暂无交易信号，等待价格变动...")
            
            print(f"\n  ⏱️ 下次检查: {interval}秒后 | 按 Ctrl+C 退出")
            
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n\n  🛑 系统已停止")
        engine.print_summary()


if __name__ == "__main__":
    main()
