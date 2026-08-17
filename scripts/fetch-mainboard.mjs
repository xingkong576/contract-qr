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

console.log('=== 主板涨幅榜 TOP15 ===');
console.log('(排除创业板30+/科创板20%/ST)');
console.log('');

// 上证+深证主板涨幅榜
const url = 'https://push2.eastmoney.com/api/qt/clist/get?cb=&fid=f3&po=1&pz=15&pn=1&np=1&fltt=2&invt=2&fs=m:1+t:2,m:0+t:16,m:0+t:23,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18,f21,f23,f25,f26,f28,f31,f32,f33,f34,f35,f37,f38,f39,f40,f41';
try {
  const raw = await fetch(url);
  const j = JSON.parse(raw);
  if (j && j.data && j.data.diff) {
    j.data.diff.forEach((s, i) => {
      if (s.f3 <= 0) return; // 只看涨幅正的
      const code = s.f12;
      const name = s.f14;
      const price = (s.f2 || 0).toFixed(2);
      const change = (s.f3 || 0).toFixed(2);
      const volume = s.f5 ? (s.f5 / 10000).toFixed(0) : '-';
      const turnover = s.f8 ? (s.f8 / 100000000).toFixed(2) : '-';
      const amplitude = s.f7 ? s.f7.toFixed(2) : '-';
      const pe = s.f9 ? s.f9 : '-';
      console.log(`${String(i+1).padStart(2)}. ${name.padEnd(6)} ${code}  ¥${price.padStart(8)}  涨幅:${change.padStart(7)}%  振幅:${amplitude}  换手:${turnover}亿  量:${volume}万  PE:${pe}`);
    });
  } else {
    console.log('无数据:', raw.slice(0, 300));
  }
} catch (e) {
  console.error('请求失败:', e.message);
}
