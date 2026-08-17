"""
网格交易核心引擎
"""
import json
import os
from datetime import datetime
from utils import calc_grid_levels, calc_grid_metrics

class GridEngine:
    """网格交易引擎"""
    
    def __init__(self, config_path=None):
        self.config = self._load_config(config_path)
        self.grid_state = {}
        self._import_data_fetcher()
    
    def _import_data_fetcher(self):
        """导入数据获取模块"""
        import data_fetcher
        self.data_fetcher = data_fetcher
        self.last_quote_time = None
        self.QUOTE_CACHE_SEC = 30  # 缓存30秒
    
    def _load_config(self, path=None):
        p = path or os.path.join(os.path.dirname(__file__), "config.json")
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def init_grid(self, symbol=None, config=None, current_price=None):
        """
        初始化网格
        
        Args:
            symbol: 股票代码
            config: 配置字典
            current_price: 当前价格（可选）
        """
        if config is None:
            config = self.config
        
        target = None
        if symbol:
            for t in config.get("targets", []):
                if t["symbol"] == symbol:
                    target = t
                    break
        else:
            targets = config.get("targets", [])
            target = targets[0] if targets else {
                "symbol": "510300",
                "grid": {"num_grids": 15, "grid_width_pct": 2.5},
                "capital": {"stock_allocation": 100000, "cash_allocation": 100000},
            }
        
        sym = target["symbol"]
        price_range = target.get("price_range", {})
        grid = target["grid"]
        
        # 如果没有提供价格，尝试获取实时行情
        if current_price is None:
            quote = self._get_latest_quote(sym)
            if quote:
                current_price = quote["price"]
            elif price_range:
                current_price = (price_range["lower"] + price_range["upper"]) / 2
            else:
                current_price = 4.75  # 510300 默认
        
        num_grids = grid["num_grids"]
        grid_width_pct = grid["grid_width_pct"]
        
        # 计算网格线
        levels = calc_grid_levels(current_price, num_grids, grid_width_pct)
        
        # 每格金额
        stock_alloc = config.get("capital", {}).get("stock_allocation", 100000)
        per_grid_amount = target.get("per_grid_amount", stock_alloc / num_grids)
        
        # 计算策略指标
        metrics = calc_grid_metrics(current_price, num_grids, grid_width_pct, per_grid_amount, levels)
        
        self.grid_state[sym] = {
            "levels": levels,
            "base_price": current_price,
            "current_price": current_price,
            "holdings": 0,
            "cash": config.get("capital", {}).get("cash_allocation", 100000),
            "stock_alloc": stock_alloc,
            "metrics": metrics,
            "target": target,
            "per_grid_amount": per_grid_amount,
            "last_trade_time": None,
            "initialized_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        
        return self.grid_state[sym]
    
    def _get_latest_quote(self, symbol):
        """获取最新实时行情（带缓存）"""
        now = datetime.now()
        if (self.last_quote_time and 
            (now - self.last_quote_time).total_seconds() < self.QUOTE_CACHE_SEC):
            return None
        
        try:
            quote = self.data_fetcher.get_realtime_quote(symbol)
            if quote:
                self.last_quote_time = now
            return quote
        except:
            return None
    
    def update_price(self, symbol, price):
        """手动更新价格"""
        if symbol in self.grid_state:
            self.grid_state[symbol]["current_price"] = price
    
    def check_and_trade(self, symbol):
        """
        检查当前价格，判断是否需要触发交易
        
        Returns:
            list of trade action dicts
        """
        if symbol not in self.grid_state:
            return []
        
        state = self.grid_state[symbol]
        levels = state["levels"]
        current_price = state["current_price"]
        
        # 尝试刷新价格
        quote = self._get_latest_quote(symbol)
        if quote:
            current_price = quote["price"]
            state["current_price"] = current_price
        
        grid_idx = self._find_grid_index(current_price, levels)
        
        trades = []
        
        # === 买入逻辑 ===
        # 从当前网格往下找需要买入的网格
        for gi in range(grid_idx, -1, -1):
            if gi < len(levels):
                buy_price = levels[gi]
                # 检查是否已经在这个网格有持仓
                if self._has_position_at_grid(symbol, gi):
                    continue
                
                buy_qty = max(100, int(state["per_grid_amount"] / buy_price / 100) * 100)
                buy_amount = buy_qty * buy_price
                
                if state["cash"] >= buy_amount:
                    trades.append({
                        "action": "BUY",
                        "symbol": symbol,
                        "price": round(buy_price, 4),
                        "quantity": buy_qty,
                        "amount": round(buy_amount, 2),
                        "grid_level": gi,
                        "reason": f"价格 ({current_price:.4f}) 跌至网格{gi} ({buy_price:.4f})，买入信号",
                    })
        
        # === 卖出逻辑 ===
        # 检查已有持仓的网格，看是否可以止盈卖出
        for gi in range(grid_idx + 1, len(levels)):
            sell_price = levels[gi]
            buy_grid = gi - 1
            
            # 检查是否有在这个网格买入了
            if not self._has_position_at_grid(symbol, buy_grid):
                continue
            
            sell_qty = self._get_position_at_grid(symbol, buy_grid)
            sell_qty = (sell_qty // 100) * 100
            if sell_qty == 0:
                continue
            
            sell_amount = sell_qty * sell_price
            
            trades.append({
                "action": "SELL",
                "symbol": symbol,
                "price": round(sell_price, 4),
                "quantity": sell_qty,
                "amount": round(sell_amount, 2),
                "grid_level": gi,
                "reason": f"价格 ({current_price:.4f}) 涨至网格{gi} ({sell_price:.4f})，止盈信号",
            })
        
        # 如果触发了交易，更新持仓状态
        if trades:
            for t in trades:
                if t["action"] == "BUY":
                    state["holdings"] += t["quantity"]
                    state["cash"] -= t["amount"]
                else:
                    state["holdings"] -= t["quantity"]
                    state["cash"] += t["amount"]
                state["last_trade_time"] = datetime.now()
        
        return trades
    
    def _has_position_at_grid(self, symbol, grid_idx):
        """检查在该网格是否有持仓"""
        # 简化：检查当前价格是否高于该网格线，且该网格线以下有可用持仓
        state = self.grid_state[symbol]
        levels = state["levels"]
        
        if grid_idx < 0 or grid_idx >= len(levels):
            return False
        
        buy_price = levels[grid_idx]
        current = state["current_price"]
        
        # 如果当前价 > 买入价，说明有止盈空间
        if current <= buy_price:
            return False
        
        # 检查是否有足够的持仓
        return state["holdings"] > 0
    
    def _get_position_at_grid(self, symbol, grid_idx):
        """获取某网格的持仓量"""
        state = self.grid_state[symbol]
        return min(state["holdings"], max(100, int(state["per_grid_amount"] / state["levels"][grid_idx] / 100) * 100))
    
    def _find_grid_index(self, price, levels):
        """找到价格所在的网格索引"""
        for i in range(len(levels) - 1):
            if levels[i] <= price < levels[i + 1]:
                return i
        if price >= levels[-1]:
            return len(levels) - 1
        return 0
    
    def get_status(self, symbol):
        """获取网格状态"""
        if symbol not in self.grid_state:
            return None
        s = self.grid_state[symbol]
        m = s["metrics"]
        stock_value = s["holdings"] * s["current_price"]
        return {
            "symbol": symbol,
            "name": m.get("name", symbol),
            "base_price": m["base_price"],
            "current_price": s["current_price"],
            "holdings": s["holdings"],
            "cash": round(s["cash"], 2),
            "stock_value": round(stock_value, 2),
            "total_value": round(s["cash"] + stock_value, 2),
            "num_grids": m["num_grids"],
            "grid_width_pct": m["step_pct"],
            "price_range": [m["lower_price"], m["upper_price"]],
            "levels": [round(l, 4) for l in m["levels"]],
        }
    
    def print_summary(self):
        """打印网格策略摘要"""
        print("\n" + "=" * 60)
        print("  网格交易策略摘要")
        print("=" * 60)
        
        for symbol, state in self.grid_state.items():
            m = state["metrics"]
            print(f"\n  标的: {symbol}")
            print(f"  基准价: {m['base_price']:.4f}")
            print(f"  网格: {m['num_grids']}格 x {m['step_pct']}%")
            print(f"  区间: {m['lower_price']:.4f} - {m['upper_price']:.4f}")
            print(f"  单格金额: RMB {m['step_amount']:,.0f}")
        
        print("\n" + "=" * 60)


if __name__ == "__main__":
    import sys
    
    engine = GridEngine()
    symbol = sys.argv[1] if len(sys.argv) > 1 else "510300"
    
    # 初始化
    state = engine.init_grid(symbol)
    engine.print_summary()
    
    # 打印实时行情
    from data_fetcher import get_realtime_quote, print_quote
    print("\n当前行情:")
    quote = get_realtime_quote(symbol)
    if quote:
        print_quote(quote)
        engine.update_price(symbol, quote["price"])
    
    # 检查交易信号
    print("\n交易信号:")
    trades = engine.check_and_trade(symbol)
    if trades:
        for t in trades:
            tag = "[BUY]" if t["action"] == "BUY" else "[SELL]"
            print(f"  {tag:>6s} {t['quantity']:>6d}股 @ {t['price']:.4f}")
    else:
        print("  [NONE] 暂无交易信号")
    
    # 打印状态
    status = engine.get_status(symbol)
    print(f"\n账户状态:")
    print(f"  持仓: {status['holdings']}股 (价值 RMB {status['stock_value']:,.0f})")
    print(f"  现金: RMB {status['cash']:,.0f}")
    print(f"  总资产: RMB {status['total_value']:,.0f}")
