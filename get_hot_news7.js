const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeout: 10000 };
    const req = https.get(url, opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({__raw__: d.slice(0,5000)}); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy());
  });
}

async function main() {
  // === 新浪热榜 ===
  console.log('=== 新浪热榜 ===');
  try {
    const r = await fetchJSON('https://sinabo.top/api/hot');
    console.log(JSON.stringify(r, null, 2).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 微博热搜 ===
  console.log('\n=== RSSHub: 微博热搜 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/weibo/search/hot');
    if (r && r.item) r.item.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 知乎热榜 ===
  console.log('\n=== RSSHub: 知乎热榜 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/zhihu/hot-list');
    if (r && r.items) r.items.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 百度热搜 ===
  console.log('\n=== RSSHub: 百度热搜 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/baidu/trending');
    if (r && r.items) r.items.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 今日头条 ===
  console.log('\n=== RSSHub: 今日头条 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/toutiao/hot');
    if (r && r.items) r.items.slice(0, 30).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 豆瓣热评 ===
  console.log('\n=== RSSHub: 豆瓣热评 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/douban/hot');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 36氪 ===
  console.log('\n=== RSSHub: 36氪热榜 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/36kr/hot-list');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 虎嗅 ===
  console.log('\n=== RSSHub: 虎嗅热文 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/huxiu/hot');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 澎湃新闻 ===
  console.log('\n=== RSSHub: 澎湃新闻 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/thepaper/today');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 网易热评 ===
  console.log('\n=== RSSHub: 网易热评 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/netease/hot');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 抖音热榜 ===
  console.log('\n=== RSSHub: 抖音热榜 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/douyin/hot');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 虎扑 ===
  console.log('\n=== RSSHub: 虎扑步行街 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/hupu/bbs/hot');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }

  // === RSSHub - 贴吧 ===
  console.log('\n=== RSSHub: 贴吧热议 ===');
  try {
    const r = await fetchJSON('https://rsshub.app/tieba/general');
    if (r && r.items) r.items.slice(0, 20).forEach((x, i) => console.log(`${i+1}. ${x.title}`));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }
}

main();
