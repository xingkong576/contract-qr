import http from 'http';

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function main() {
  // 1. 涨停股
  const ztUrl = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f2,f3,f4,f5,f6,f8,f12,f14,f23';
  // 2. 跌幅榜（反向）
  const topGainersUrl = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:80&fields=f2,f3,f12,f14';
  // 3. 成交额
  const volUrl = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=0&np=1&fltt=2&invt=2&fid=f6&fs=m:0+t:80&fields=f2,f3,f6,f12,f14';
  // 4. 概念板块
  const sectorUrl = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f12,f14,f62';

  console.log('=== 涨停股 ===');
  try {
    const zt = JSON.parse(await fetch(ztUrl));
    const diff = zt.data?.diff?.slice(0, 10) || [];
    diff.forEach(s => {
      const change = s.f3?.toFixed(2);
      console.log(`${s.f14} ${s.f2}  涨幅:${change}%  成交额:${(s.f6/1e8).toFixed(2)}亿  换手:${s.f8?.toFixed(2)}%`);
    });
    console.log(`共 ${diff.length} 只涨停\n`);
  } catch(e) { console.log('涨停股获取失败:', e.message, '\n'); }

  console.log('=== 涨幅TOP10 ===');
  try {
    const top = JSON.parse(await fetch(topGainersUrl));
    const diff = top.data?.diff?.slice(0, 10) || [];
    diff.forEach(s => {
      console.log(`${s.f14} ${s.f2}  涨幅:${(s.f3||0).toFixed(2)}%  成交额:${(s.f6/1e8).toFixed(2)}亿`);
    });
    console.log('');
  } catch(e) { console.log('涨幅榜获取失败:', e.message, '\n'); }

  console.log('=== 成交额TOP10 ===');
  try {
    const vol = JSON.parse(await fetch(volUrl));
    const diff = vol.data?.diff?.slice(0, 10) || [];
    diff.forEach(s => {
      console.log(`${s.f14} ${s.f2}  成交额:${(s.f6/1e8).toFixed(2)}亿  涨幅:${(s.f3||0).toFixed(2)}%`);
    });
    console.log('');
  } catch(e) { console.log('成交额获取失败:', e.message, '\n'); }

  console.log('=== 概念板块涨幅TOP10 ===');
  try {
    const sector = JSON.parse(await fetch(sectorUrl));
    const diff = sector.data?.diff?.slice(0, 10) || [];
    diff.forEach(s => {
      console.log(`${s.f14}  涨幅:${(s.f3||0).toFixed(2)}%  领涨: 成交:${(s.f62/1e8).toFixed(2)}亿`);
    });
    console.log('');
  } catch(e) { console.log('板块获取失败:', e.message, '\n'); }

  // 5. 大盘指数
  console.log('=== 大盘指数 ===');
  try {
    const indexUrl = 'http://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=1.000001,0.399001,0.399006';
    const idx = JSON.parse(await fetch(indexUrl));
    const list = idx.data?.diff || [];
    list.forEach(s => {
      const nameMap = { '1.000001': '上证指数', '0.399001': '深证成指', '0.399006': '创业板指' };
      console.log(`${nameMap[s.f12] || s.f12}: ${(s.f2||0).toFixed(2)}  涨跌幅:${(s.f3||0).toFixed(2)}%  涨跌:${(s.f4||0).toFixed(2)}`);
    });
  } catch(e) { console.log('指数获取失败:', e.message); }
}

main().catch(e => console.error(e));
