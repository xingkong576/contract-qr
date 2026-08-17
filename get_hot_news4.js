const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

function fetchJSON(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Encoding': 'identity', ...extraHeaders },
      timeout: 12000,
    };
    const req = mod.get(url, opts, res => {
      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        console.log('Redirect:', res.statusCode, res.headers.location);
        resolve(fetchJSON(res.headers.location, extraHeaders));
        return;
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          if (d.startsWith('<')) {
            resolve({ __html__: d.slice(0, 5000) });
          } else {
            resolve(JSON.parse(d));
          }
        } catch(e) {
          resolve({ __raw__: d.slice(0, 3000) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy());
  });
}

async function main() {
  // === 微博热搜 - 移动端 ===
  console.log('=== 微博热搜 ===');
  try {
    const j = await fetchJSON('https://m.weibo.cn/api/container/getIndex?containerid=106003c&extparam=%E7%83%AD%E6%90%9C%E6%A6%9C&page_type=searchall', {
      Referer: 'https://m.weibo.cn/',
    });
    console.log(JSON.stringify(j, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 微博热搜 - 另一个接口 ===
  console.log('\n=== 微博热搜2 ===');
  try {
    const j = await fetchJSON('https://m.weibo.cn/api/container/getIndex?containerid=231583', {
      Referer: 'https://m.weibo.cn/',
    });
    console.log(JSON.stringify(j, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 知乎热榜 ===
  console.log('\n=== 知乎热榜 ===');
  try {
    const j = await fetchJSON('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=20&desktop=true', {
      Referer: 'https://www.zhihu.com/hot',
      'x-requested-with': 'fetch',
      'x-requested-with-header': 'XMLHttpRequest',
    });
    console.log(JSON.stringify(j, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 百度热搜 ===
  console.log('\n=== 百度热搜 ===');
  try {
    const j = await fetchJSON('https://top.baidu.com/api/searchbox');
    console.log(typeof j === 'string' ? j.slice(0, 3000) : JSON.stringify(j, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 抖音热搜 ===
  console.log('\n=== 抖音热搜 ===');
  try {
    const j = await fetchJSON('https://www.douyin.com/aweme/v1/web/hot/search/list/');
    console.log(JSON.stringify(j, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 澎湃热榜 ===
  console.log('\n=== 澎湃新闻 ===');
  try {
    const j = await fetchJSON('https://www.thepaper.cn/loadnewsTempList.jsp?type=1&flag=1&page=1&_=1234');
    console.log(JSON.stringify(j, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }
}

main();
