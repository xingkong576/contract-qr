import https from 'https';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(d));
      r.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // 涨幅榜TOP15
  const url1 = 'https://push2.eastmoney.com/api/qt/clist/get?cb=&pn=1&pz=15&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f2,f3,f12,f14,f62,f15,f16,f17';
  const raw1 = await fetch(url1);
  const j1 = JSON.parse(raw1);
  const topGainers = j1.data?.diff || [];

  // 成交额TOP10
  const url2 = 'https://push2.eastmoney.com/api/qt/clist/get?cb=&pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048&fields=f2,f3,f62,f12,f14,f15,f16,f17';
  const raw2 = await fetch(url2);
  const j2 = JSON.parse(raw2);
  const topVolume = j2.data?.diff || [];

  console.log('===TOP_GAINERS===');
  topGainers.forEach((s, i) => {
    console.log(`${i+1}|${s.f14}|${s.f12}|${s.f2}|${s.f3}|${s.f62||0}|${s.f15||''}|${s.f16||''}|${s.f17||''}`);
  });
  console.log('===TOP_VOLUME===');
  topVolume.forEach((s, i) => {
    console.log(`${i+1}|${s.f14}|${s.f12}|${s.f2}|${s.f3}|${s.f62||0}|${s.f15||''}|${s.f16||''}|${s.f17||''}`);
  });
}

main().catch(e => console.error(e));
