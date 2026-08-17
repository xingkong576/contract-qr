const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchJSON(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': UA, ...extraHeaders }, timeout: 10000 };
    const req = https.get(url, opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy());
  });
}

async function main() {
  // === 微博热搜 ===
  console.log('=== 微博热搜 ===');
  try {
    const j = await fetchJSON('https://weibo.com/ajax/side/hotSearch', {
      'Referer': 'https://m.weibo.cn/',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
    });
    if (j.data && j.data.weibo) {
      j.data.weibo.slice(0, 30).forEach((x, i) => {
        console.log(`${String(i+1).padStart(2,' ')} [${x.word_hot}] ${x.word}`);
      });
    } else if (j.data && j.data.real) {
      j.data.real.slice(0, 30).forEach((x, i) => {
        console.log(`${String(i+1).padStart(2,' ')} [${x.num}] ${x.word}`);
      });
    } else if (j.data && j.data.top) {
      j.data.top.slice(0, 30).forEach((x, i) => {
        console.log(`${String(i+1).padStart(2,' ')} [${x.num}] ${x.word}`);
      });
    } else {
      console.log(JSON.stringify(j).slice(0, 1000));
    }
  } catch(e) { console.log('Error:', e.message); }

  // === 新浪热榜 ===
  console.log('\n=== 新浪热榜 ===');
  try {
    const j = await fetchJSON('https://api.kiji.im/top-list/', { 'Accept': 'application/json' });
    if (j) console.log(JSON.stringify(j).slice(0, 3000));
  } catch(e) { console.log('Error:', e.message); }

  // === 豆瓣热门 ===
  console.log('\n=== 豆瓣热门 ===');
  try {
    const j = await fetchJSON('https://www.douban.com/group/tp/hot_discussion?cats=1', { 'Accept': 'text/html' });
    if (typeof j === 'string') {
      const titles = j.match(/<a[^>]*class=["'][^"']*title[^"']*["'][^>]*>(.*?)<\/a>/gi) || [];
      titles.slice(0, 25).forEach((t, i) => {
        const title = t.replace(/<[^>]+>/g, '').trim();
        console.log(`${i+1}. ${title}`);
      });
      if (titles.length === 0) {
        // Fallback: try other pattern
        const links = j.match(/<a[^>]*href="\/group\/topic\/\d+[^"]*"[^>]*>(.*?)<\/a>/gi) || [];
        links.slice(0, 25).forEach((l, i) => {
          const title = l.replace(/<[^>]+>/g, '').trim();
          console.log(`${i+1}. ${title}`);
        });
      }
    } else {
      console.log(JSON.stringify(j).slice(0, 1000));
    }
  } catch(e) { console.log('Error:', e.message); }

  // === 腾讯新闻热榜 ===
  console.log('\n=== 腾讯新闻热榜 ===');
  try {
    const j = await fetchJSON('https://pacaio.match.qq.com/irs/rcd?cid=127&token=&ext=hotnews&num=30');
    if (j && rcd) {
      // Try different path
      const data = j.rcd?.[0]?.data?.cards?.[0]?.data?.items;
      if (data) {
        data.slice(0, 30).forEach((x, i) => {
          console.log(`${i+1}. ${x.title} [${x.hit || ''}]`);
        });
      } else {
        console.log(JSON.stringify(j).slice(0, 2000));
      }
    }
  } catch(e) { console.log('Error:', e.message); }

  // === 百度热搜 API ===
  console.log('\n=== 百度热搜 ===');
  try {
    const r = await fetchJSON('https://top.baidu.com/api/searchbox?prod=entire&pos=hotaplus');
    if (typeof r === 'object') {
      // Try to find data array
      const d = r.data || r.coldDataMsg || r.result || r.items;
      if (d && d.length) {
        d.slice(0, 30).forEach((x, i) => {
          console.log(`${i+1}. ${x.query || x.title || x.word || JSON.stringify(x).slice(0,100)}`);
        });
      } else {
        console.log(JSON.stringify(r).slice(0, 3000));
      }
    }
  } catch(e) { console.log('Error:', e.message); }

  // === 网易新闻热榜 ===
  console.log('\n=== 网易热榜 ===');
  try {
    const j = await fetchJSON('https://news.163.com/special/0001386F/rank_whole.html');
    // Likely HTML, try to extract
    if (typeof j === 'string') {
      const items = j.match(/<a[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/gi) || [];
      // Only take news-like titles
      const newsItems = items.filter(x => !x.includes('广告') && !x.includes('备案') && x.length > 10);
      newsItems.slice(0, 30).forEach((t, i) => {
        const title = t.replace(/<[^>]+>/g, '').trim();
        if (title.length > 5) console.log(`${i+1}. ${title}`);
      });
    }
  } catch(e) { console.log('Error:', e.message); }
}

main();
