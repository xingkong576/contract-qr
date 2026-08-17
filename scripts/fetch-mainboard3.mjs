import https from 'https';

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ok: true, data }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

// 东方财富涨幅榜 - 全部A股
async function run() {
  // 方案1: 上证涨幅
  try {
    const url1 = 'https://push2.eastmoney.com/api/qt/clist/get?cb=&fid=f3&po=1&pz=15&pn=1&np=1&fltt=2&invt=2&fs=m:0+t:6,m:0+t:80&fields=f2,f3,f4,f5,f6,f7,f8,f12,f14';
    const r1 = await fetch(url1);
    const j1 = JSON.parse(r1.data);
    
    console.log('=== 沪深主板涨幅榜 TOP15 ===');
    console.log('(排除ST/创业板/科创板)');
    console.log('');
    
    let count = 0;
    if (j1 && j1.data && j1.data.diff) {
      for (const s of j1.data.diff) {
        if (s.f3 <= 0) break;
        const name = s.f14 || '';
        if (name.includes('ST') || name.includes('*ST')) continue;
        const code = s.f12;
        const price = (s.f2 || 0).toFixed(2);
        const change = (s.f3 || 0).toFixed(2);
        const vol = s.f5 ? (s.f5 / 10000).toFixed(0) : '-';
        const turn = s.f8 ? (s.f8 / 100000000).toFixed(2) : '-';
        const amp = s.f7 ? s.f7.toFixed(2) : '-';
        console.log(`${String(count+1).padStart(2)}. ${name.padEnd(6)} ${code}  ¥${price.padStart(8)}  涨幅:${change.padStart(7)}%  振幅:${amp.padStart(6)}  换手:${turn.padStart(6)}亿  量:${vol.padStart(6)}万`);
        count++;
        if (count >= 15) break;
      }
    }
    console.log('\n共获取', count, '只主板涨幅股');
  } catch(e) {
    console.error('上证获取失败:', e.message);
  }
}

run();
