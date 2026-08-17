import https from 'https';

// 候选股票列表（近期热门低价股）
const codes = [
  'sz002436', 'sz002851', 'sz002428', 'sz300750', 'sz300123',
  'sz002129', 'sh600570', 'sh601225', 'sh600886', 'sh601992',
  'sh600372', 'sz000977', 'sz300394', 'sz002230', 'sh603019',
  'sh603659', 'sh600745', 'sh601872', 'sz002049', 'sz002415',
  'sz000636', 'sz002456', 'sz002027', 'sz002040', 'sh600089',
  'sh600845', 'sh600206', 'sz002008', 'sz002024', 'sz002508',
  'sh603025', 'sz002460', 'sz002466', 'sh600271', 'sh600549',
  'sz002414', 'sz002465', 'sz002475', 'sh600699', 'sh601727',
  'sz002493', 'sz002518', 'sh600149', 'sz002532', 'sh600362',
  'sz002555', 'sh600392', 'sz002594', 'sh600406', 'sz002600'
];

const url = 'https://qt.gtimg.cn/q=' + codes.join(',');

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const stocks = [];
    const lines = data.split(';').filter(l => l.trim());
    lines.forEach(line => {
      const m = line.match(/"([^"]+)"/);
      if (m) {
        const parts = m[1].split('~');
        if (parts.length > 40) {
          const name = parts[1];
          const code = parts[2];
          const price = parseFloat(parts[3]);
          const prevClose = parseFloat(parts[4]);
          const high = parseFloat(parts[33]);
          const low = parseFloat(parts[34]);
          const changePct = parseFloat(parts[32]);
          const turnoverRate = parts[37] ? parseFloat(parts[37]) : 0;
          const volume = parts[6] ? parseInt(parts[6]) : 0;
          const amount = parts[5] ? parseFloat(parts[5]) : 0;
          
          if (price > 0 && price <= 50) {
            stocks.push({ name, code, price, changePct, high, low, turnoverRate, volume, amount });
          }
        }
      }
    });
    
    // 按涨幅排序
    stocks.sort((a, b) => b.changePct - a.changePct);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 50元以下涨幅榜 | 2026/6/17 10:24');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    // 涨停/涨幅>7%
    console.log('🔥 强势股（涨幅>5%）:');
    console.log('─'.repeat(80));
    console.log('  名称    代码      现价    涨幅    最高    最低    换手率');
    console.log('─'.repeat(80));
    stocks.filter(s => s.changePct > 5).forEach(s => {
      console.log(`  ${s.name.padEnd(6)} ${s.code}    ${s.price.toFixed(2).padEnd(7)} ${s.changePct.toFixed(2).padEnd(5)}%  ${s.high.toFixed(2).padEnd(6)} ${s.low.toFixed(2).padEnd(6)} ${s.turnoverRate.toFixed(1).padEnd(5)}%`);
    });
    
    // 涨幅0~5%
    console.log('');
    console.log('📈 温和上涨（涨幅0~5%）:');
    console.log('─'.repeat(80));
    console.log('  名称    代码      现价    涨幅    最高    最低    换手率');
    console.log('─'.repeat(80));
    stocks.filter(s => s.changePct > 0 && s.changePct <= 5).forEach(s => {
      console.log(`  ${s.name.padEnd(6)} ${s.code}    ${s.price.toFixed(2).padEnd(7)} ${s.changePct.toFixed(2).padEnd(5)}%  ${s.high.toFixed(2).padEnd(6)} ${s.low.toFixed(2).padEnd(6)} ${s.turnoverRate.toFixed(1).padEnd(5)}%`);
    });
    
    // 下跌
    console.log('');
    console.log('📉 下跌（涨幅<0）:');
    console.log('─'.repeat(80));
    console.log('  名称    代码      现价    涨幅    最高    最低    换手率');
    console.log('─'.repeat(80));
    stocks.filter(s => s.changePct < 0).slice(0, 15).forEach(s => {
      console.log(`  ${s.name.padEnd(6)} ${s.code}    ${s.price.toFixed(2).padEnd(7)} ${s.changePct.toFixed(2).padEnd(5)}%  ${s.high.toFixed(2).padEnd(6)} ${s.low.toFixed(2).padEnd(6)} ${s.turnoverRate.toFixed(1).padEnd(5)}%`);
    });
    
    // 持仓标注
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('💼 你的持仓:');
    console.log('═══════════════════════════════════════════════════════');
    const holding = stocks.find(s => s.code === '000636');
    if (holding) {
      const profit = (holding.price - 71) * 100;
      const profitPct = ((holding.price - 71) / 71 * 100).toFixed(2);
      console.log(`  ${holding.name} (${holding.code})`);
      console.log(`  买入价: 71.00元 | 现价: ${holding.price.toFixed(2)}元`);
      console.log(`  浮盈: ${profit.toFixed(0)}元 (+${profitPct}%)`);
    }
    console.log('');
  });
}).on('error', e => console.log('Error:', e.message));
