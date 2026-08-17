import https from 'https';

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 沪深涨幅榜TOP15
const url = 'https://push2.eastmoney.com/api/qt/clist/get?cb=&fid=f3&po=1&pz=15&pn=1&np=1&fltt=2&invt=2&fs=m:0+t:6,m:0+t:80,m:1+t:2&fields=f2,f3,f4,f12,f14';
try {
  const raw = await fetch(url);
  const j = JSON.parse(raw);
  if (j && j.data && j.data.diff) {
    console.log('涨幅榜TOP15:');
    console.log('──────────────────────────────────────');
    j.data.diff.forEach((s, i) => {
      console.log(`${String(i+1).padStart(2)}. ${s.f14.padEnd(8)} ${s.f12.padStart(8)}  现价:${s.f2.toFixed(2)}  涨幅:${s.f3.toFixed(2)}%`);
    });
  } else {
    console.log('解析失败:', raw.slice(0, 500));
  }
} catch (e) {
  console.error('请求失败:', e.message);
}
