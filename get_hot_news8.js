const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'User-Agent': UA, 'Accept': '*/*', ...headers },
      timeout: 8000,
      method: 'GET',
    };
    https.get(url, opts, res => {
      let d = '';
      // Handle gzip
      let data = res;
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({__raw__: d.substring(0, 5000)}); }
      });
    }).on('error', reject).setTimeout(8000);
  });
}

async function main() {
  const results = [];

  // === 新浪热榜 - 公开接口 ===
  console.log('\n=== 新浪热榜 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/v2/weibohotnews/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title} [${x.hot || ''}]`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 新浪热评 - 网易 ===
  console.log('\n=== 网易热评 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/v2/wangyirediso/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 25).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 新浪新闻热评 ===
  console.log('\n=== 新浪热评 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/sinaHot/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title} [${x.hot || ''}]`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 百度热搜 ===
  console.log('\n=== 百度热搜 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/baiduHot/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title} [${x.hot || ''}]`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 知乎热榜 ===
  console.log('\n=== 知乎热榜 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/zhihu/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 25).forEach((x, i) => console.log(`${i+1}. ${x.title} [${x.hot || ''}]`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 百度热搜 - 备用 ===
  console.log('\n=== 百度热搜2 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/v2/baiduHot/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 25).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 今日热榜 - API ===
  console.log('\n=== 36氪热榜 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/36kr/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === QQ新闻热评 ===
  console.log('\n=== QQ热评 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/qqnewshot/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 抖音热榜 ===
  console.log('\n=== 抖音热榜 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/dyhot/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 25).forEach((x, i) => console.log(`${i+1}. ${x.title} [${x.hot || ''}]`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }

  // === 虎扑热帖 ===
  console.log('\n=== 虎扑热帖 ===');
  try {
    const r = await fetchJSON('https://tenapi.cn/hupu/', { 'Accept': 'application/json' });
    if (r.data && r.data.length) r.data.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 1000));
  } catch(e) { console.log('Error:', e.message); }
}

main();
