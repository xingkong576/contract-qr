"""
网格交易信号生成器 (实时版)
用法: python signal_generator.py [股票代码] [网格数] [网格百分比] [总资金]
示例: python signal_generator.py 601778
      python signal_generator.py 601778 10 3.0 100000
      python signal_generator.py 600060 8 2.5
"""
import json
import sys
import urllib.request
import ssl
from datetime import datetime

# Currency symbol workaround for Windows GBK console
CUR = '元'

# 股票名称
NAMES = {
    '600060': '海信视像',
    '601778': '晶科科技',
}

# 内置最近30日行情（用于判断当前趋势）
RECENT_DATA = {
    '600060': [26.01, 25.06, 25.02, 25.45, 25.80, 25.38, 25.82, 27.98],
    '601778': [5.79, 5.76, 5.71, 5.66, 5.33, 5.03, 5.17, 4.86],
}


def fetch_realtime_price(symbol):
    """
    通过腾讯行情接口获取实时价格
    返回: dict with price, yclose, open, high, low, change_pct, vol, amount, vol_ratio, turnover, pe, time
    """
    market = 'sh' if symbol.startswith('6') else 'sz'
    url = 'https://qt.gtimg.cn/q=' + market + symbol
    
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            raw = resp.read().decode('gbk')
        
        # 解析: v_sh601778="字段1~字段2~..."
        eq_idx = raw.find('=')
        if eq_idx < 0:
            return None
        rest = raw[eq_idx+1:].strip()
        # 去掉首尾引号
        if rest.startswith('"'):
            rest = rest[1:]
        if rest.endswith('"'):
            rest = rest[:-1]
        if rest.endswith(';'):
            rest = rest[:-1]
        
        p = rest.split('~')
        
        if len(p) < 50:
            return None
        
        price = float(p[3])
        yclose = float(p[5])
        open_price = float(p[4])
        high = float(p[33])
        low = float(p[34])
        change_pct = float(p[32])
        
        # p[35] = "现价/成交量/成交额(元)"
        parts35 = p[35].split('/')
        vol = int(parts35[1])
        amount = float(parts35[2])
        
        vol_ratio = float(p[38])
        turnover = float(p[56])
        pe = float(p[39])
        time_str = p[30]
        
        return {
            'price': price, 'yclose': yclose, 'open': open_price,
            'high': high, 'low': low,
            'change_pct': change_pct, 'vol': vol, 'amount': amount,
            'vol_ratio': vol_ratio, 'turnover': turnover,
            'pe': pe, 'time': time_str,
        }
    except Exception as e:
        print('  WARNING: 获取实时行情失败: ' + str(e))
        return None


def calc_grid_levels(base_price, num_grids, grid_pct):
    """计算网格线"""
    step = base_price * grid_pct / 100.0
    lower = base_price - (num_grids // 2) * step
    levels = [round(lower + step * i, 2) for i in range(num_grids + 1)]
    return levels, step


def calc_per_grid_cash(cash, num_grids):
    """每格应分配资金"""
    return cash / num_grids


def get_recommendation(symbol):
    """根据历史回测给出推荐参数"""
    if symbol == '600060':
        return {'grids': 10, 'width_pct': 3.0, 'reason': '振幅32%，10格x3%最优，已实现利润12.6万'}
    elif symbol == '601778':
        return {'grids': 10, 'width_pct': 3.0, 'reason': '振幅66%，10格x3%最优，已实现利润18.9万'}
    return {'grids': 10, 'width_pct': 2.5, 'reason': '通用参数'}


def generate_signal(cash, symbol, num_grids, grid_pct, realtime=None):
    """生成信号配置"""
    name = NAMES.get(symbol, symbol)
    rec = get_recommendation(symbol)
    
    # 获取当前价格
    current_price = None
    info = None
    
    if realtime is not None:
        current_price = realtime['price']
        info = realtime
        print('  OK 实时行情已获取')
    else:
        try:
            current_price = float(input('请输入 ' + symbol + ' 当前价格: ').strip())
        except:
            print('无法获取当前价格，请手动查看行情软件')
            return
    
    if info is None:
        info = {
            'price': current_price, 'yclose': current_price * 0.99,
            'open': current_price, 'high': current_price * 1.01,
            'low': current_price * 0.99, 'change_pct': 0,
            'vol': 0, 'amount': 0, 'vol_ratio': 1, 'turnover': 0,
            'pe': 0, 'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }
    
    levels, step = calc_grid_levels(current_price, num_grids, grid_pct)
    per_grid_cash = calc_per_grid_cash(cash, num_grids)
    
    # 时间格式化
    time_raw = info.get('time', '')
    if isinstance(time_raw, str) and len(time_raw) >= 14:
        dt = time_raw[0:4] + '-' + time_raw[4:6] + '-' + time_raw[6:8] + ' ' + time_raw[8:10] + ':' + time_raw[10:12] + ':' + time_raw[12:14]
    else:
        dt = str(time_raw)
    
    # 涨跌幅方向
    arrow = '+' if info['change_pct'] > 0 else '-'
    CUR = 'Y'  # currency symbol workaround for GBK console
    
    # 找到当前网格位置
    current_grid = -1
    for i in range(num_grids):
        if levels[i] <= current_price < levels[i + 1]:
            current_grid = i
            break
    if current_grid < 0:
        current_grid = 0 if current_price < levels[0] else num_grids
    
    # ==================== 输出 ====================
    print('')
    print('=' * 60)
    print('  网格交易信号 - ' + symbol + ' ' + name)
    print('=' * 60)
    print('')
    print('  推荐参数: ' + str(num_grids) + '格 x ' + str(grid_pct) + '%')
    print('  推荐理由: ' + rec['reason'])
    print('')
    print('  当前价格: ' + str(current_price) + ' ' + CUR + '  |  ' + arrow + ' ' + str(info['change_pct']) + '%')
    print('  时间: ' + dt)
    print('  总资金: ' + '{:,}'.format(cash) + ' ' + CUR)
    print('  每格资金: ' + '{:,}'.format(int(per_grid_cash)) + ' ' + CUR)
    print('  网格间距: ' + '{:.2f}'.format(step) + ' ' + CUR + ' (' + str(grid_pct) + '%)')
    print('  所在网格: 第' + str(current_grid + 1) + '格 (共' + str(num_grids) + '格)')
    
    # 实时行情详情
    if info['vol'] > 0:
        print('')
        print('-' * 55)
        print('  实时行情')
        print('-' * 55)
        print('  今开: ' + '{:.2f}'.format(info['open']) + ' ' + CUR + '  |  昨收: ' + '{:.2f}'.format(info['yclose']) + ' ' + CUR)
        print('  最高: ' + '{:.2f}'.format(info['high']) + ' ' + CUR + '  |  最低: ' + '{:.2f}'.format(info['low']) + ' ' + CUR)
        vol_wan = info['vol'] / 10000
        amount_yi = info['amount'] / 100000000
        print('  量: {:,.0f}手 ({:.1f}万)  |  额: {:.2f}亿'.format(info['vol'], vol_wan, amount_yi))
        # skip currency symbols for GBK compatibility
        print('  量比: {:.2f}  |  换手: {:.2f}%'.format(info['vol_ratio'], info['turnover']))
        if info['pe'] > 0:
            print('  PE: {:.1f}'.format(info['pe']))
    
    # 网格线
    print('')
    print('=' * 55)
    print('  网格线 (共' + str(num_grids + 1) + '条)')
    print('=' * 55)
    header = '  {:>5s} | {:>8s} | {:>8s} | {}'.format('网格', '价格', '距当前', '信号')
    print(header)
    print('-' * 55)
    
    for i in range(num_grids + 1):
        level = levels[i]
        diff = round(level - current_price, 2)
        diff_str = '{:+.2f}'.format(diff)
        
        if abs(diff) < 0.01:
            signal = '<== 当前价格'
        elif diff < 0:
            signal = 'GREEN 买入'
        else:
            signal = 'RED 卖出'
        
        if i == current_grid + 1:
            marker = '>'
        else:
            marker = ' '
        
        print('  L' + marker + ' {:>2d}   | {:>8.2f} | {:>8s} | {}'.format(i+1, level, diff_str, signal))
    
    # 买入信号详情
    print('')
    print('  买入信号（价格跌到这些线）')
    print('-' * 55)
    for i in range(current_grid + 1):
        level = levels[i]
        qty = max(100, int(per_grid_cash / level / 100) * 100)
        buy_cost = round(qty * level)
        profit = round(qty * step * (1 - 0.001))
        next_level = levels[min(i + 1, num_grids)]
        print('    跌至 {:.2f} | 买入 {:,.0f}股 | 成本 {:,.0f} | 目标 {:.2f} | 盈利 {:,}'.format(
            level, qty, buy_cost, next_level, profit))
    
    # 卖出信号详情
    print('')
    print('  卖出信号（持仓涨到这些线）')
    print('-' * 55)
    for i in range(current_grid + 1, num_grids + 1):
        level = levels[i]
        buy_level = levels[i - 1]
        qty = max(100, int(per_grid_cash / buy_level / 100) * 100)
        profit = round(qty * (level - buy_level) * (1 - 0.001))
        print('    涨到 {:.2f} | 卖出 {:,.0f}股 | 买入价 {:.2f} | 盈利 {:,}'.format(
            level, qty, buy_level, profit))
    
    # 操作建议
    print('')
    print('=' * 55)
    print('  操作建议')
    print('-' * 55)
    
    if current_grid >= num_grids:
        print('  当前价格已在最高网格，建议：')
        print('  1. 逢高卖出，不要追买')
        print('  2. 等回调到下方网格再接')
    elif current_grid <= 0:
        print('  当前价格已在最低网格，建议：')
        print('  1. 等价格反弹到上方网格再卖')
        print('  2. 如价格继续下跌，每跌一格补一批')
    else:
        buy_below = current_grid + 1
        sell_above = num_grids - current_grid
        print('  当前价格在第' + str(current_grid + 1) + '格，属于中间位置')
        print('  1. 上方' + str(sell_above) + '条卖出线待触发 (' + '{:.2f}'.format(levels[current_grid + 1]) + ' ~ ' + '{:.2f}'.format(levels[num_grids]) + ')')
        print('  2. 下方' + str(buy_below) + '条买入线待触发 (' + '{:.2f}'.format(levels[0]) + ' ~ ' + '{:.2f}'.format(levels[current_grid]) + ')')
        print('  3. 如已持仓，等反弹时卖出；如空仓，等回调时买入')
    
    # 风险提示
    print('')
    print('=' * 55)
    print('  风险提示')
    print('-' * 55)
    max_loss = (1 - levels[0] / current_price) * 100
    grid_profit_pct = step / current_price * 100
    print('  1. 最大浮亏: {:.1f}% (跌破 {:.2f})'.format(max_loss, levels[0]))
    print('  2. 每格预估盈利: {:.1f}%'.format(grid_profit_pct))
    print('  3. 建议总仓位不超过可投资金的50%')
    print('  4. 单日止损: 价格跌破最低网格线 {:.2f} 建议止损'.format(levels[0]))
    print('  5. 本信号仅供参考，投资有风险，操作需谨慎')
    
    print('')
    print('=' * 60)


def main():
    if len(sys.argv) >= 2:
        symbol = sys.argv[1]
        num_grids = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        grid_pct = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
        cash = int(sys.argv[4]) if len(sys.argv) > 4 else 100000
    else:
        symbol = input('请输入股票代码 (600060/601778): ').strip()
        num_grids = int(input('网格数 [默认10]: ').strip() or '10')
        grid_pct = float(input('网格百分比 [默认3.0]: ').strip() or '3.0')
        cash = int(input('投入总资金 [默认100000]: ') or '100000')
    
    # 自动获取实时行情
    realtime = fetch_realtime_price(symbol)
    
    generate_signal(cash, symbol, num_grids, grid_pct, realtime)


if __name__ == '__main__':
    main()
