const http = require('http');
const https = require('https');

const urls = [
  { name: '东方财富涨幅榜', url: 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14' },
  { name: '涨停板池', url: 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f12,f14' },
];

for (const item of urls) {
  const mod = item.url.startsWith('https') ? https : http;
  mod.get(item.url, { timeout: 10000 }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(`\n=== ${item.name} ===`);
        const diffs = json.data?.diff || [];
        if (diffs.length === 0) {
          console.log('空数据');
        } else {
          for (const d of diffs.slice(0, 5)) {
            console.log(`${d.f14} (${d.f12}) 涨幅:${d.f3}% 现价:${d.f2}`);
          }
        }
      } catch (e) {
        console.log(`\n=== ${item.name} ===`);
        console.log('解析失败:', data.slice(0, 100));
      }
    });
  }).on('error', (e) => {
    console.log(`\n=== ${item.name} ===`);
    console.log('错误:', e.message);
  }).on('timeout', () => {
    console.log(`\n=== ${item.name} ===`);
    console.log('超时');
    this.destroy();
  });
}

// 等待所有请求完成
setTimeout(() => {
  console.log('\n=== 全部完成 ===');
  process.exit(0);
}, 15000);
