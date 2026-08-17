const http = require('http');

// 获取概念板块
const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f62&_=Date.now()';

const req = http.get(url, function(res) {
  let data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    try {
      const j = JSON.parse(data);
      const list = j.data.diff || [];
      console.log('=== 概念板块热度TOP20 ===');
      list.slice(0, 20).forEach(s => {
        console.log((s.f14||'').padEnd(20) + ' ' + (s.f2?(Number(s.f2)/100).toFixed(2)+'%':'').padEnd(10) + ' ' + (s.f62||'') + '亿');
      });
    } catch(e) {
      console.log('Error:', e.message);
    }
  });
});
req.on('error', function(e) { console.error(e.message); });
req.setTimeout(15000);
