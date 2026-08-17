const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'User-Agent': UA },
      timeout: 10000,
    };
    const req = https.get(url, opts, res => {
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
  // Toutiao hot search
  console.log('=== 今日头条热搜 ===');
  try {
    const j = await fetchJSON('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc&o=update&a=hot&count=20&max_behot_time=0');
    if (j.data) {
      j.data.forEach((x, i) => {
        console.log(`${i+1}. ${x.Title} [热度: ${x.HotValue}]`);
      });
    } else {
      console.log(JSON.stringify(j).slice(0, 500));
    }
  } catch(e) { console.log('Error:', e.message); }

  // Sina hot search via HTML
  console.log('\n=== 新浪微博热搜 ===');
  try {
    const r = await fetchJSON('https://weibo.com/ajax/side/hotSearch');
    if (typeof r === 'object' && r.data) {
      r.data.real.forEach((x, i) => {
        console.log(`${i+1}. ${x.word} [热度: ${x.num}]`);
      });
    } else if (typeof r === 'string') {
      console.log(r.slice(0, 500));
    } else {
      console.log(JSON.stringify(r).slice(0, 500));
    }
  } catch(e) { console.log('Error:', e.message); }

  // Zhihu hot
  console.log('\n=== 知乎热榜 ===');
  try {
    const r = await fetchJSON('https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=20');
    if (typeof r === 'object' && r.data) {
      r.data.forEach((x, i) => {
        console.log(`${i+1}. ${x.target.title} [热度: ${x.detail_text}]`);
      });
    } else {
      console.log(typeof r === 'string' ? r.slice(0, 500) : JSON.stringify(r).slice(0, 500));
    }
  } catch(e) { console.log('Error:', e.message); }

  // Baidu hot search via different endpoint
  console.log('\n=== 百度热搜 ===');
  try {
    const r = await fetchJSON('https://top.baidu.com/api/searchbox?prod=entire&pos=hotaplus');
    if (typeof r === 'string') console.log(r.slice(0, 2000));
    else console.log(JSON.stringify(r).slice(0, 2000));
  } catch(e) { console.log('Error:', e.message); }
}

main();
