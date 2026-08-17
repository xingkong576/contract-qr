import https from 'https';

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 仅沪深主板: m:0+t:6 (沪市主板) + m:0+t:80 (深市主板)
// f3=涨跌幅, po=1降序
const url = 'https://push2.eastmoney.com/api/qt/clist/get?cb=&fid=f3&po=1&pz=20&pn=1&np=1&fltt=2&invt=2&fs=m:0+t:6,m:0+t:80&fields=f2,f3,f4,f5,f6,f7,f8,f12,f14';
try {
  const raw = await fetch(url);
  const j = JSON.parse(raw);
  if (!j || !j.data || !j.data.diff) {
    console.log('无数据');
    console.log(raw.slice(0, 500));
    process.exit(0);
  }
  console.log('=== 沪深主板涨幅榜 TOP20 ===');
  console.log('(排除创业板/科创板/ST)');
  console.log('');
  
  let count = 0;
  for (const s of j.data.diff) {
    if (s.f3 <= 0) break;
    const code = s.f12;
    const name = s.f14;
    // 排除ST
    if (name.includes('ST') || name.includes('*ST')) continue;
    const price = (s.f2 || 0).toFixed(2);
    const change = (s.f3 || 0).toFixed(2);
    const vol = s.f5 ? (s.f5 / 10000).toFixed(0) : '-';
    const turn = s.f8 ? (s.f8 / 100000000).toFixed(2) : '-';
    const amp = s.f7 ? s.f7.toFixed(2) : '-';
    console.log(`${String(count+1).padStart(2)}. ${name.padEnd(6)} ${code}  ¥${price.padStart(8)}  涨幅:${change.padStart(7)}%  振幅:${amp.padStart(6)}  换手:${turn.padStart(6)}亿  量:${vol.padStart(6)}万`);
    count++;
    if (count >= 15) break;
  }
  if (count === 0) console.log('无符合条件的股票');
} catch (e) {
  console.error('请求失败:', e.message);
}
