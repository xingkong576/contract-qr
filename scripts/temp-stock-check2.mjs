import http from 'http';
import https from 'https';

function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ data, status: res.statusCode, headers: res.headers }); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// 解析腾讯行情行
function parseQtLine(line) {
  const match = line.match(/v_\w+="(.+)"/);
  if (!match) return null;
  return match[1].split('~');
}

async function main() {
  // 1. 指数
  console.log('\n📊 大盘指数');
  try {
    const r = await fetchUrl('http://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006,s_sz399005');
    for (const line of r.data.trim().split('\n')) {
      const f = parseQtLine(line);
      if (!f) continue;
      const name = f[1];
      const price = parseFloat(f[3]) || 0;
      const chgPct = parseFloat(f[5]) || 0;
      const icon = chgPct > 0 ? '📈' : chgPct < 0 ? '📉' : '➡️';
      console.log(`  ${icon} ${name}  ${price.toFixed(2)}  ${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`);
    }
  } catch(e) { console.log('  失败:', e.message); }

  // 2. 东财涨幅榜 - 试多种参数
  console.log('\n🔥 涨幅榜');
  const eastmoneyUrls = [
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:13,m:0+t:80&fields=f2,f3,f6,f12,f14,f15,f16`,
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90&fields=f2,f3,f6,f12,f14`,
    `https://hq.sinajs.cn/list=s_sh000001`,
  ];
  for (const url of eastmoneyUrls) {
    try {
      const r = await fetchUrl(url);
      console.log(`  URL ok, status: ${r.status}, body: ${r.data.slice(0, 200)}`);
      if (r.status === 200 && r.data.includes('diff')) {
        const j = JSON.parse(r.data);
        if (j?.data?.diff) {
          console.log('  ✅ 获取成功!');
          for (const s of j.data.diff) {
            const name = s.f14 || '';
            if (name.includes('ST') || name.includes('退') || s.f12?.startsWith('68') || s.f12?.startsWith('30')) continue;
            const chg = Number(s.f3) || 0;
            if (chg < 2) break;
            const icon = chg >= 9.9 ? '🔒' : chg >= 7 ? '🔥' : '⭐';
            const amt = (Number(s.f6) / 1e8).toFixed(1);
            console.log(`  ${icon} ${name.padEnd(8)} ${s.f12}  ${Number(s.f2).toFixed(2)}  +${chg.toFixed(2)}%  ${amt}亿`);
          }
          break;
        }
      }
    } catch(e) { console.log(`  URL fail: ${e.message}`); }
  }

  // 3. 新浪涨幅榜
  console.log('\n🔥 新浪涨幅榜');
  try {
    const r = await fetchUrl('https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=1&num=20&sort=changepercent&asc=0&node=hs_a&symbol=&_s_r_a=page');
    console.log(`  status: ${r.status}, body: ${r.data.slice(0, 500)}`);
  } catch(e) { console.log('  失败:', e.message); }

  // 4. 板块热度 - 东财
  console.log('\n🔥 概念板块热度');
  try {
    const r = await fetchUrl('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:1,t:23,m:1,t:16,m:1,t:20,m:1,t:95&fields=f2,f3,f12,f14');
    console.log(`  status: ${r.status}, body: ${r.data.slice(0, 500)}`);
    if (r.data.includes('diff')) {
      const j = JSON.parse(r.data);
      if (j?.data?.diff) {
        for (const s of j.data.diff) {
          console.log(`  📊 ${s.f14}  ${Number(s.f2).toFixed(2)}  ${Number(s.f3).toFixed(2)}%`);
        }
      }
    }
  } catch(e) { console.log('  失败:', e.message); }
}

main();
