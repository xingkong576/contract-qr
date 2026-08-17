const http = require('http');

// 获取涨停板数据
const url = 'http://push2ex.eastmoney.com/getTopicZTPool?_var=topicztpool&date=20260817&page_size=30&sort=CHANGE_RATE&order=desc&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58';

const req = http.get(url, function(res) {
  let data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    try {
      const j = JSON.parse(data);
      const items = j.data?.detail || [];
      console.log('=== 涨停股列表 ===');
      items.slice(0, 20).forEach(s => {
        console.log((s.f14||'').padEnd(10) + ' ' + (s.f2||0) + ' ' + (s.f3||0) + '%');
      });
    } catch(e) {
      console.log('Error:', e.message);
      console.log(data.slice(0, 1500));
    }
  });
});
req.on('error', function(e) { console.error(e.message); });
req.setTimeout(15000);
