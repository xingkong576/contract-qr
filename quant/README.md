# A股网格交易系统

## 功能

- **实时行情获取** — 通过 akshare 从东方财富拉取实时ETF数据
- **网格交易引擎** — 自动计算网格线、检测交易信号
- **回测模块** — 验证策略在历史数据上的表现
- **波动率计算** — 自动推荐最优网格宽度

## 快速开始

### 1. 安装依赖（本地 Windows）

```powershell
pip install akshare pandas numpy
```

### 2. 初始化策略

```powershell
cd quant
python grid_engine.py 510300
```

输出示例：
```
============================================================
  网格交易策略摘要
============================================================

  标的: 510300
  基准价: 4.7510
  网格: 15格 x 2.5%
  区间: 3.9196 - 5.5824
  单格金额: RMB 6,667

当前行情:
  沪深300ETF华泰柏瑞(510300)
  最新价: 4.7510  涨跌幅: -0.69%

交易信号:
   [BUY]   1400股 @ 4.6956
   [BUY]   1400股 @ 4.5847
   ...

账户状态:
  持仓: 12100股 (价值 RMB 57,487)
  现金: RMB 48,083
  总资产: RMB 105,571
```

### 3. 运行回测

```powershell
python backtest.py 510300 4.7510 60
```

### 4. 查看行情详情

```powershell
python data_fetcher.py 510300
```

### 5. 监控其他ETF

```powershell
python grid_engine.py 159915   # 创业板ETF
python grid_engine.py 510050   # 上证50ETF
python grid_engine.py 510500   # 中证500ETF
```

## 架构

```
quant/
├── config.json          # 策略配置
├── data_fetcher.py      # 数据采集（akshare + 缓存）
├── grid_engine.py       # 网格核心引擎
├── backtest.py          # 回测模块
├── utils.py             # 工具函数
├── monitor.py           # 实时监控
├── data/                # 缓存数据
│   └── prices_cache.json
├── logs/                # 日志
└── trade_log/           # 交易日志
```

## 配置说明 (config.json)

```json
{
  "capital": {
    "stock_allocation": 100000,  // 股票资金
    "cash_allocation": 100000    // 现金
  },
  "targets": [
    {
      "symbol": "510300",        // 沪深300ETF
      "price_range": {
        "lower": 3.9,            // 价格下限
        "upper": 5.5              // 价格上限
      },
      "grid": {
        "num_grids": 15,         // 网格数量
        "grid_width_pct": 2.5    // 每格宽度(%)
      },
      "per_grid_amount": 6667,   // 每格金额
      "risk": {
        "stop_loss_pct": -15     // 止损线
      }
    }
  ]
}
```

## 注意事项

1. **实盘需要对接券商API** — 当前系统只做信号生成和回测，不包含实际下单
2. **akshare 需要本地运行** — 服务器端网络限制，无法直连东方财富API
3. **价格缓存** — 实时价格会缓存在 `data/prices_cache.json`，30秒过期
4. **东方财富API限制** — `fund_etf_spot_em()` 需要分页获取约15批次数据

## 网格参数建议

| 标的 | 30日波动率 | 推荐网格数 | 推荐格宽 |
|------|-----------|-----------|---------|
| 510300 沪深300ETF | 17.57% | 15-20 | 2.0-2.5% |
| 159915 创业板ETF | 通常更高 | 20-25 | 1.5-2.0% |
| 510050 上证50ETF | 通常较低 | 10-15 | 3.0-4.0% |

## 使用方法

在本地 Windows 机器上：
```powershell
cd C:\Users\Administrator\.openclaw\workspace\quant
python grid_engine.py [ETF代码]
```
