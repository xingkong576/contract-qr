const http = require('http');

// 获取涨幅榜和成交额榜
const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=50&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f8,f9,f12,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115&_=Date.now()';

const req = http.get(url, function(res) {
  let data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    try {
      const j = JSON.parse(data);
      const list = j.data.diff || [];
      
      console.log('=== 涨幅榜TOP30 ===');
      list.slice(0, 30).forEach(s => {
        const rate = s.f3 ? Number(s.f3) : 0;
        const price = s.f2 ? Number(s.f2) / 100 : 0;
        console.log((s.f14||'').padEnd(10) + ' ' + price.toFixed(2).padStart(7) + ' ' + rate.toFixed(2).padStart(7) + '%');
      });
      
      console.log('\n=== 成交额TOP20 ===');
      const byAmount = [...list].sort((a, b) => (b.f62||0) - (a.f62||0));
      byAmount.slice(0, 20).forEach(s => {
        const rate = s.f3 ? Number(s.f3) : 0;
        const price = s.f2 ? Number(s.f2) / 100 : 0;
        console.log((s.f14||'').padEnd(10) + ' ' + price.toFixed(2).padStart(7) + ' ' + rate.toFixed(2).padStart(7) + '% ' + (s.f62||0) + '亿');
      });
    } catch(e) {
      console.log('Error:', e.message);
      console.log(data.slice(0, 1000));
    }
  });
});
req.on('error', function(e) { console.error(e.message); });
req.setTimeout(15000);
