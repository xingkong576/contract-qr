const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchJSON(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: { 'User-Agent': UA, ...extraHeaders },
      timeout: 10000,
    };
    const req = mod.get(url, opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy());
  });
}

async function main() {
  // Weibo hot search
  console.log('=== 微博热搜 ===');
  try {
    const j = await fetchJSON('https://weibo.com/ajax/statuses/hot_bursts', { Referer: 'https://weibo.com/' });
    if (j.data) j.data.slice(0, 25).forEach((x, i) => console.log(`${i+1}. ${x.word} [${x.num}]`));
    else console.log(JSON.stringify(j).slice(0, 500));
  } catch(e) { console.log('Error:', e.message); }

  // Baidu hot word API
  console.log('\n=== 百度热搜 ===');
  try {
    const j = await fetchJSON('https://top.baidu.com/api/searchbox?prod=entire');
    console.log(JSON.stringify(j).slice(0, 1500));
  } catch(e) { console.log('Error:', e.message); }

  // QQ News
  console.log('\n=== QQ新闻 ===');
  try {
    const j = await fetchJSON('https://r.inews.qq.com/getAppNews?aid=18&cid=1&num=20&act=killme&reqid=');
    console.log(JSON.stringify(j).slice(0, 1500));
  } catch(e) { console.log('Error:', e.message); }

  // Toutiao hot search
  console.log('\n=== 头条热搜 ===');
  try {
    const j = await fetchJSON('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc&o=update&a=hot&count=20&max_behot_time=0');
    console.log(JSON.stringify(j).slice(0, 1500));
  } catch(e) { console.log('Error:', e.message); }

  // Sina hot search
  console.log('\n=== 新浪热门 ===');
  try {
    const j = await fetchJSON('https://s.weibo.com/top/summary');
    if (typeof j === 'string') {
      // Try to extract hot search items from HTML
      const matches = j.match(/<td class="td02"><a href="[^"]*" target="_blank">(.*?)<\/a>/g);
      if (matches) {
        matches.slice(0, 25).forEach((m, i) => {
          const title = m.match(/>(.*?)<\/a>/)?.[1] || '';
          const hotMatch = m.match(/"num">(\d+)<\/span>/);
          console.log(`${i+1}. ${title} [${hotMatch ? hotMatch[1] : '?'}]`);
        });
      }
    }
  } catch(e) { console.log('Error:', e.message); }

  // Baidu hot search (alternative)
  console.log('\n=== 百度热搜(备用) ===');
  try {
    const j = await fetchJSON('https://top.baidu.com/api/searchbox');
    console.log(JSON.stringify(j).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }
}

main();
