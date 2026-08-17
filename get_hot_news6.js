const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchRaw(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', 'Accept': '*/*', ...extraHeaders },
      timeout: 12000,
    };
    const req = mod.get(url, opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy());
  });
}

async function main() {
  // === 今日热榜 - 首页JSON API ===
  console.log('=== 今日热榜首页 ===');
  try {
    const html = await fetchRaw('https://tophub.today/', { 'Accept': 'text/html' });
    // Look for API endpoints or hot data in the page
    const apiMatches = html.match(/https?:\/\/tophub\.today\/api\/[^\s"']+/g);
    console.log('API endpoints found:', apiMatches);
    // Look for __NEXT_DATA__ or data injection
    const dataScript = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (dataScript) {
      console.log('Found __NEXT_DATA__');
      console.log(dataScript[1].substring(0, 3000));
    }
    // Look for hot items pattern
    const hotItems = html.match(/<a[^>]*class="[^"]*item[^"]*"[^>]*>[^<]*<span[^>]*>(.*?)<\/span>/gi) || [];
    console.log('Items found:', hotItems.length);
  } catch(e) { console.log('Error:', e.message); }

  // === Google News China ===
  console.log('\n=== Google News ===');
  try {
    const html = await fetchRaw('https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans');
    const titles = (html.match(/<title>(.*?)<\/title>/g) || []).map(t => t.replace(/<\/?title>/g, ''));
    titles.slice(1, 31).forEach((t, i) => console.log(`${i+1}. ${t}`));
  } catch(e) { console.log('Error:', e.message); }

  // === Hacker News China ===
  console.log('\n=== HN热榜 ===');
  try {
    const j = await JSON.parse(await fetchRaw('https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty'));
    console.log(j.slice(0, 5));
  } catch(e) { console.log('Error:', e.message); }

  // === QQ新闻热榜 API ===
  console.log('\n=== QQ新闻 ===');
  try {
    const html = await fetchRaw('https://r.inews.qq.com/getAppNews?aid=18&cid=1&num=20&reqid=');
    console.log(html.substring(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 企鹅号热文 ===
  console.log('\n=== 企鹅号热文 ===');
  try {
    const html = await fetchRaw('https://xvs.qq.com/xvs/api/v3/search/content/getContentList?searchid=1781228800000&reqid=&pagenum=1&pagesize=20&sort=7&appname=pc&searchkey=%E7%83%AD%E9%97%A8&channelid=&biztype=&token=&gdt_vid=&gdt_sid=&callback=');
    console.log(html.substring(0, 3000));
  } catch(e) { console.log('Error:', e.message); }
}

main();
