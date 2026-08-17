"""
工具函数 - 通用
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

# 配置文件路径
BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config.json"
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"
TRADE_LOG_DIR = BASE_DIR / "trade_log"


def load_config():
    """加载配置文件"""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_dirs():
    """确保日志和数据目录存在"""
    for d in [LOG_DIR, DATA_DIR, TRADE_LOG_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def log_trade(target_symbol, direction, price, quantity, amount, grid_level):
    """记录交易日志"""
    ensure_dirs()
    now = datetime.now()
    log_file = TRADE_LOG_DIR / f"{target_symbol}_{now.strftime('%Y%m')}_trades.csv"
    
    header = not log_file.exists()
    with open(log_file, "a", encoding="utf-8") as f:
        if header:
            f.write("时间,方向,标的,价格,数量,金额,网格层级,手续费\n")
        
        commission = max(amount * 0.00025, 5)
        stamp_tax = 0
        if direction == "sell":
            stamp_tax = amount * 0.0005  # 卖出收印花税
        
        total_cost = commission + stamp_tax
        f.write(f"{now.strftime('%Y-%m-%d %H:%M:%S')},{direction},{target_symbol},{price},{quantity},{amount:.2f},{grid_level},{total_cost:.2f}\n")
    
    return total_cost


def format_price(price):
    """格式化价格"""
    if price >= 1000:
        return f"{price:,.0f}"
    elif price >= 100:
        return f"{price:,.2f}"
    else:
        return f"{price:.4f}"


def format_amount(amount):
    """格式化金额"""
    return f"{amount:,.2f}"


def get_trading_hours(now=None):
    """判断当前是否在交易时间内"""
    if now is None:
        now = datetime.now()
    
    # 周末不交易
    if now.weekday() >= 5:
        return False
    
    time_str = now.strftime("%H:%M:%S")
    # A股交易时间: 9:30-11:30, 13:00-15:00
    morning_start = "09:30:00"
    morning_end = "11:30:00"
    afternoon_start = "13:00:00"
    afternoon_end = "15:00:00"
    
    if (morning_start <= time_str <= morning_end) or (afternoon_start <= time_str <= afternoon_end):
        return True
    return False


def calc_grid_levels(base_price, num_grids, grid_width_pct):
    """
    计算网格价格区间
    
    Args:
        base_price: 基准价格
        num_grids: 网格数量
        grid_width_pct: 每格宽度(百分比)
    
    Returns:
        grid_levels: [lower, ..., mid, ..., upper]
    """
    half_grids = num_grids // 2
    
    # 以基准价为中心，上下各 half_grids 格
    lower_price = base_price * (1 - half_grids * grid_width_pct / 100)
    upper_price = base_price * (1 + half_grids * grid_width_pct / 100)
    
    step = (upper_price - lower_price) / num_grids
    
    levels = []
    for i in range(num_grids + 1):
        levels.append(round(lower_price + step * i, 4))
    
    return levels


def calc_grid_metrics(base_price, num_grids, grid_width_pct, per_grid_amount, levels=None):
    """
    计算网格策略的关键指标
    
    Returns:
        dict with grid analysis metrics
    """
    half_grids = num_grids // 2
    lower_price = base_price * (1 - half_grids * grid_width_pct / 100)
    upper_price = base_price * (1 + half_grids * grid_width_pct / 100)
    
    step_amount = per_grid_amount
    step_pct = grid_width_pct
    
    # 估算每日利润（保守）
    # A股日均波动约1-3%，格宽2%时，平均每天能走1-2格
    daily_trades = 1  # 保守估计每天1次成交
    profit_per_trade = step_pct / 100 * per_grid_amount  # 单格利润
    daily_profit = daily_trades * profit_per_trade
    monthly_profit = daily_profit * 15  # 月交易日
    annual_profit = monthly_profit * 12
    total_capital = per_grid_amount * num_grids * 2  # 股票+现金总投入
    annual_return = annual_profit / total_capital * 100
    
    return {
        "base_price": base_price,
        "lower_price": round(lower_price, 4),
        "upper_price": round(upper_price, 4),
        "num_grids": num_grids,
        "grid_width_pct": grid_width_pct,
        "step_amount": per_grid_amount,
        "step_pct": step_pct,
        "daily_trades_est": daily_trades,
        "daily_profit_est": round(daily_profit, 2),
        "monthly_profit_est": round(monthly_profit, 2),
        "annual_profit_est": round(annual_profit, 2),
        "annual_return_est": round(annual_return, 2),
        "levels": [round(l, 4) for l in (levels or calc_grid_levels(base_price, num_grids, grid_width_pct))],
    }
