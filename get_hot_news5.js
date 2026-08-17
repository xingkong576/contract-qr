const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchRaw(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', ...extraHeaders },
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
  // === 今日热榜 ===
  console.log('=== 今日热榜 ===');
  try {
    // TopHot uses /n/ID pages
    const html = await fetchRaw('https://tophub.today/');
    console.log(html.slice(0, 5000));
  } catch(e) { console.log('Error:', e.message); }

  // === 今日头条热榜 API (已验证可用) ===
  console.log('\n=== 今日头条 (补充) ===');
  try {
    const https = require('https');
    const j = await JSON.parse(await fetchRaw('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc&o=update&a=hot&count=20&max_behot_time=0'));
    if (j.data) {
      j.data.forEach((x, i) => {
        console.log(`${i+1}. ${x.Title} [${x.HotValue}]`);
      });
    }
  } catch(e) { console.log('Error:', e.message); }

  // === Bing热榜 ===
  console.log('\n=== Bing热榜 ===');
  try {
    const html = await fetchRaw('https://www.bing.com/hotsearch?set_language=zh-CN&set_country=CN');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const items = doc.querySelectorAll('.trendingItem, .hotItem, [data-cmp-item]');
    items.forEach((item, i) => {
      const title = item.querySelector('.trendingTitle, a, .title, h3')?.textContent?.trim() || '';
      if (title && title.length > 3) console.log(`${i+1}. ${title}`);
    });
    if (items.length === 0) {
      const links = doc.querySelectorAll('a');
      let count = 0;
      for (const a of links) {
        const t = a.textContent?.trim();
        if (t && t.length > 5 && t.length < 50 && count < 30) {
          console.log(`${++count}. ${t}`);
        }
      }
    }
  } catch(e) { console.log('Error:', e.message); }
}

main();
