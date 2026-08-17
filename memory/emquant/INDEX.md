# 东方财富量化终端 - 帮助文档完整索引

> 抓取时间：2026-06-23
> 来源：https://emquant.18.cn/help/?doc=guide

## 8大分类总览

### 1. 快速开始（Guide）
- 终端介绍、安装SDK、策略编写与回测、策略仿真、交易工具、组合交易、智能策略
- 30分钟入门教程

### 2. Python SDK（最完善）
**快速开始**
- 定时任务示例、数据事件驱动示例、时间序列数据事件驱动示例
- 多个标的数据事件驱动示例、选择回测/实时模式运行示例
- 提取数据研究示例、回测模式下高速处理数据示例
- 实时模式下动态参数示例、level2数据驱动事件示例

**策略程序架构**
- 东方财富量化策略程序初始化、行情事件处理函数
- 交易事件处理函数、其他事件处理函数、策略入口

**变量约定**
- symbol（代码标识）、mode（模式选择）、context（上下文对象）
- context.symbols、context.now、context.data、context.account、context.parameters

**数据结构**
- 数据类：Tick、Bar、L2Order、L2Transaction
- 交易类：Account、Order、ExecRpt、Cash、Position、Indicator、algoOrder

**API介绍（核心）**
- 基础函数：init、schedule、run、stop、timer、timer_stop
- 数据订阅：subscribe、unsubscribe
- 数据事件：on_tick、on_bar、on_l2transaction、on_l2order
- 行情数据查询（免费）：current、history、history_n、context.data
- 通用数据函数（免费）：get_symbol_infos、get_symbols、get_history_symbol、get_trading_dates_by_year、get_previous_n_trading_dates、get_next_n_trading_dates、get_trading_session、get_contract_expire_rest_days
- 股票财务数据（免费）：stk_get_index_constituents、stk_get_fundamentals_balance/cashflow/income、stk_get_fundamentals_balance_pt/cashflow_pt/income_pt、stk_get_finance_prime/deriv、stk_get_daily_valuation/mktvalue/basic
- 股票财务数据截面（多标的）：stk_get_finance_prime_pt、stk_get_finance_deriv_pt、stk_get_daily_valuation_pt、stk_get_daily_mktvalue_pt、stk_get_daily_basic_pt
- 股票增值数据（付费）：stk_get_industry_category/constituents/symbol_industry、stk_get_sector_category/constituents/symbol_sector、stk_get_dividend/ration/adj_factor、stk_get_shareholder_num/top_shareholder/share_change、stk_abnor_change_stocks/detail、stk_quota_shszhk_infos、stk_hk_inst_holding_detail_info/info、stk_active_stock_top10_shszhk_info、stk_get_money_flow、stk_get_finance_audit/forecast、get_open_call_auction
- 期货基础数据（免费）：fut_get_continuous_contracts
- 期货增值数据（付费）：fut_get_contract_info、fut_get_transaction_rankings、fut_get_warehouse_receipt
- 基金增值数据（付费）：fnd_get_etf_constituents、fnd_get_portfolio、fnd_get_net_value、fnd_get_adj_factor、fnd_get_dividend、fnd_get_split
- 可转债增值数据（付费）：bnd_get_conversion_price、bnd_get_call_info、bnd_get_put_info、bnd_get_amount_change
- 交易函数：order_volume、order_value、order_percent、order_target_volume/value/percent、order_batch、order_cancel、order_cancel_all、order_close_all、get_unfinished_orders、get_orders、get_execution_reports
- IPO交易：ipo_buy、ipo_get_quota、ipo_get_instruments、ipo_get_match_number、ipo_get_lot_info
- 债券：bond_reverse_repurchase_agreement、bond_convertible_call/put/cancel
- 两融交易：credit_buying_on_margin、credit_short_selling、credit_repay_cash_directly、credit_repay_share_directly、credit_get_collateral/borrowable_instruments/contracts/cash、credit_repay_share_by_buying_share、credit_repay_cash_by_selling_share、credit_buying_on_collateral、credit_selling_on_collateral、credit_collateral_in/out
- 基金交易：fund_etf_buy、fund_etf_redemption
- 算法交易：algo_order、algo_order_cancel、get_algo_orders、algo_order_pause、get_algo_child_orders、on_algo_order_status

**交易事件**
- on_order_status、on_execution_report、on_account_status

**动态参数**
- add_parameter、set_parameter、on_parameter、context.parameters

**枚举常量**
- OrderStatus、OrderSide、OrderType、OrderDuration、OrderQualifier、OrderBusiness、ExecType、PositionEffect、PositionSide、OrderRejectReason等

### 3. C++ SDK
**策略基类**
- 基本成员函数：Strategy构造函数、run、stop、set_strategy_id、set_token、set_mode、schedule、now、set_backtest_config
- 行情成员函数：subscribe、unsubscribe
- 普通交易：get_accounts、order_volume/value/percent/target_volume/value/percent、order_cancel/cancel_all/close_all、place_order、get_orders/unfinished_orders/execution_reports/cash/position
- 两融业务：credit_buying_on_margin、credit_short_selling、credit_repay_share/cash_by_buying/selling_share、credit_repay_share/cash_directly、credit_collateral_in/out、credit_get_collateral/borrowable_instruments/contracts/cash
- 算法交易：order_algo、algo_order_cancel/pause、get_algo_orders/child_orders
- 新股业务：ipo_buy/get_quota/instruments/match_number/lot_info
- 债券业务：bond_reverse_repurchase_agreement
- 动态参数：add/del/set/get_parameters、set/get_symbols
- 事件：on_init、on_tick/bar/l2transaction/l2order、on_order_status/execution_report/parameter/schedule/backtest_finished/indicator/account_status/error/stop
- 连接事件：on_market/trade_data_connected/disconnected

**数据查询函数**
- 行情数据（免费）：current、history_ticks/bars、history_ticks_n/bars_n
- 通用数据（免费）：get_symbol_infos、get_symbols_by_date、get_history_symbol、get_trading_dates_by_year、get_previous/next_n_trading_dates、get_trading_session、get_contract_expire_rest_days
- 股票财务（免费）：stk_get_index_constituents、stk_get_fundamentals_balance/cashflow/income、stk_get_fundamentals_balance/cashflow/income_pt、stk_get_finance_prime/deriv、stk_get_daily_valuation/mktvalue/basic、stk_get_finance_prime/deriv_pt、stk_get_daily_valuation/mktvalue/basic_pt
- 股票增值（付费）：stk_get_industry_category/constituents/symbol_industry、stk_get_sector_category/constituents/symbol_sector、stk_get_dividend/ration/adj_factor、stk_get_shareholder_num/top_shareholder/share_change、stk_abnor_change_stocks/detail、stk_quota_shszhk_infos等
- 期货/基金/可转债增值数据（付费）

**数据结构**
- Tick、Bar、L2Order、L2Transaction、L2OrderQueue、SymbolInfo、SymbolContent、TradingDateContent、TradingSession、StkIndustryCategory/Constituent、StockDividend等

**结果集合类**
- DataSet：status、is_end、next、get_integer/long_integer/real/string、release、debug_string

**结果数组类**
- DataArray：status、data、count、at、release

### 4. C# SDK
**策略基类**
- 基本成员函数：Strategy构造函数、Run、Stop、SetToken、SetMode、SetStrategyId、GetAccountStatus、Schedule、Now、SetBacktestConfig
- 行情成员函数：subscribe、unsubscribe
- 交易成员函数：GetAccounts、orderVolume、OrderValue/Percent、OrderTargetVolume/Value/Percent、OrderCloseAll、OrderCancel/CancelAll、GetOrders/UnfinishedOrders/ExecutionReports/Cash/Position
- 动态参数：AddParameters、DelParameters、SetParameters、GetParameters、SetSymbols、GetSymbols
- 事件：OnInit、OnTick/Bar/OrderStatus/ExecutionReport/Parameter/Schedule/BacktestFinished/AccountStatus/Error/Stop
- 连接事件：OnMarket/TradeDataConnected/Disconnected

**数据查询函数**
- 行情数据（免费）：Current、HistoryTicks/Bars、HistoryTicksN/BarsN
- 通用数据（免费）：SetToken、SetAddr、GetSymbolInfos、GetSymbols、GetHistorySymbol、GetTradingDatesByYear、GetTradingSession、GetContractExpireRestDays
- 股票财务（免费）：StkGetIndexConstituents、StkGetFundamentalsBalance/Cashflow/Income、StkGetFundamentalsBalance/Cashflow/IncomePt、StkGetFinancePrime/Deriv、StkGetDailyValuation/Mktvalue/Basic等
- 期货/基金/可转债增值数据（付费）

**数据结构**
- Tick、Bar、SymbolInfo、Symbol、TradeDate、TradingSession、IndustryCategory/Constituent、FundamentalsBalance/Cashflow/Income、FinancePrime/Deriv、DailyValuation/Mktvalue/Basic等

**枚举常量**
- OrderStatus、OrderSide、OrderType、ExecType、PositionEffect、PositionSide、OrderRejectReason、AccountState等

### 5. Matlab SDK
**matlab策略SDK概述**
- 矩阵化数据格式、面向过程策略结构
- 支持行情滑窗和行情数据驱动
- 支持回测、实盘无缝切换
- 支持基本面和业务数据查询

**典型策略场景**
- 定时事件驱动、订阅数据驱动、成交回报事件驱动
- 指定账户交易、获取资金持仓信息交易策略
- 设定策略运行参数、仅提取数据

**策略组成文件**
- main.m（策略编写m文件）、run.m（策略运行文件）

**策略结构要素**
- 全局变量、初始化事件、滑窗标的序列
- 定时运行函数和定时事件、订阅数据滑窗和数据事件
- 交易事件驱动、其他事件驱动、存储自定义全局变量
- 策略停止函数stop_strategy

**获取数据**
- bar/tick数据结构、财务数据结构
- subscribe、current、history、history_n
- get_instruments、get_history_instruments、get_instrumentinfos
- get_constituents、get_trading_dates、get_previous/next_trading_date
- get_dividend、get_continuous_contracts

**策略交易**
- 订单/回报/持仓/资金数据结构
- order_volume/value/percent/target_volume/value/percent、order_batch
- order_cancel/cancel_all/close_all
- get_unfinished_orders、get_orders、get_execution_reports
- get_position、get_cash

### 6. 智能策略
**功能简介**
- 条件单、网格交易、涨停开板、自动打新、自动逆回购
- 算法交易（ATS-SMART、ZC-POV）

**条件单**
- 支持品种：股票、场内基金、可转债
- 类型：预设时间、触发价格、当日涨幅、反弹买入、回落卖出、止盈、止损、涨速
- 单标的和多标的策略

**网格交易**
- 支持品种：股票、场内基金、可转债
- 网格设置：价格中枢、网格大小、区间范围、拐点交易
- 委托设置：委托数量、委托倍数（平均/金字塔/马丁格尔/递增）、委托方式
- 任务设置：有效期、任务启动、信号执行

**涨停开板**
- 跟踪涨停标的，买一封盘数量小于设定值时卖出

**自动打新**
- 每天指定时间申购新股，仅支持实盘账户

**自动逆回购**
- 每天定时国债逆回购，仅支持实盘账户

**算法交易**
- ATS-SMART：动态选择最优算法执行
- ZC-POV：比例成交算法
- 云服务算法模式，专线行情+内网极速柜台

### 7. 数据文档
**股票**
- 基础数据：get_symbol_infos、get_symbols、get_history_symbol、get_trading_dates_by_year
- 行情数据：Tick（实时+历史）、Bar（60s~3600s+1d）
- 财务数据：资产负债表（1989年至今）、现金流量表、利润表
- 行业数据、板块数据、分红派息、股本股东、龙虎榜、北向资金

**基金**
- 基础数据、行情数据、成分持仓、场内净值、分红折算

**可转债**
- 基础数据、行情数据、转股数据、回售和赎回、剩余规模

**指数**
- 基础数据、行情数据、指数成分股、指数列表（股票/基金/债券）

**期货**
- 基础数据、行情数据、连续合约数据、排名数据、仓单数据

**板块**
- 基础数据、行情数据

### 8. 常见问题
**技术支持**
- QQ群：971584613

**终端问题**
- 安装SDK报错、盘中数据响应慢、token和策略ID说明

**Python策略编程问题**
- 解析器找不到、gm模块找不到、ModuleNotFoundError
- error code=1001无法连接到终端服务
- protobuf不兼容、numpy冲突、ssl模块不可用
- 第三方IDE策略启动、策略中途停止、talib安装、多线程支持

**数据问题**
- 支持市场、历史数据频度和范围
- 订阅限制（免费版50个标的）、实时行情频率
- tick/bar推送机制、数据查询流控规则
- 数据更新时间、复权因子计算

**仿真&实盘问题**
- 市价单价格、订单状态、交易品种支持
- 实盘各种市价单和限价单的下单参数组合

**回测问题**
- 市价单成交价格、复权价格计算
- 今昨仓限制、涨跌停价格限制

**旧数据接口下线通知**
- 2024.9.30正式下线老版数据函数
- 13个老版数据函数切换到新版
