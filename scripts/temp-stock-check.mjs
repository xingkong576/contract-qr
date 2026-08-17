import http from 'http';
import https from 'https';

function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(data); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// 解析腾讯行情返回
function parseQtLine(line) {
  // format: v_sh000001="1~上证指数~000001~3927.18~0.22~0.01~..."
  const match = line.match(/v_\w+="(.+)"/);
  if (!match) return null;
  const fields = match[1].split('~');
  return fields;
}

// 腾讯涨跌榜: rank_zdf
async function getGainers() {
  console.log('🔥 涨幅榜TOP20');
  console.log('─'.repeat(60));
  try {
    const data = await fetchUrl('http://qt.gtimg.cn/q=rank_zdf_zdf');
    const lines = data.trim().split('\n');
    const stocks = [];
    for (const line of lines) {
      const f = parseQtLine(line);
      if (!f || f.length < 8) continue;
      const name = f[1];
      const code = f[2];
      const price = parseFloat(f[3]) || 0;
      const chgPct = parseFloat(f[32]) || 0;  // 涨跌幅
      const chg = parseFloat(f[31]) || 0;      // 涨跌额
      const amount = parseFloat(f[37]) || 0;    // 成交额(万)
      if (name.includes('ST') || name.includes('退')) continue;
      if (code.startsWith('68') || code.startsWith('30')) continue;
      stocks.push({ name, code, price, chg, chgPct, amount });
    }
    stocks.sort((a, b) => b.chgPct - a.chgPct);
    const top = stocks.filter(s => s.chgPct >= 2).slice(0, 20);
    top.forEach((s, i) => {
      const icon = s.chgPct >= 9.9 ? '🔒' : s.chgPct >= 7 ? '🔥' : '⭐';
      console.log(`  ${String(i+1).padEnd(2)}. ${icon} ${s.name.padEnd(8)} ${s.code}  ${s.price.toFixed(2)}  ${s.chgPct >= 0 ? '+' : ''}${s.chgPct.toFixed(2)}%  ${(s.amount/10000).toFixed(1)}亿`);
    });
    if (top.length === 0) console.log('  📭 今日无强势股');
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }
}

// 腾讯板块热度
async function getsectors() {
  console.log('\n🔥 概念板块热度TOP10');
  console.log('─'.repeat(60));
  try {
    const data = await fetchUrl('http://qt.gtimg.cn/q=s_board_rank');
    const lines = data.trim().split('\n');
    const sectors = [];
    for (const line of lines) {
      const f = parseQtLine(line);
      if (!f || f.length < 6) continue;
      const name = f[1];
      const change = parseFloat(f[5]) || 0;
      if (name.includes('ST')) continue;
      sectors.push({ name, change });
    }
    sectors.sort((a, b) => b.change - a.change);
    sectors.slice(0, 10).forEach((s, i) => {
      const icon = s.change >= 2 ? '🔥' : s.change >= 0.5 ? '📈' : '📊';
      console.log(`  ${icon} ${String(i+1).padEnd(2)}. ${s.name.padEnd(16)} ${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`);
    });
  } catch(e) {
    console.log('  ⚠️ 板块获取失败:', e.message);
  }
}

// 涨停股
async function getLimitUp() {
  console.log('\n🔒 今日涨停股');
  console.log('─'.repeat(60));
  try {
    const data = await fetchUrl('http://qt.gtimg.cn/q=rank_zdf_zdf');
    const lines = data.trim().split('\n');
    const limitUps = [];
    for (const line of lines) {
      const f = parseQtLine(line);
      if (!f || f.length < 8) continue;
      const name = f[1];
      const code = f[2];
      const price = parseFloat(f[3]) || 0;
      const chgPct = parseFloat(f[32]) || 0;
      if (name.includes('ST') || name.includes('退')) continue;
      if (code.startsWith('68') || code.startsWith('30')) continue;
      if (chgPct >= 9.9) {
        const amount = parseFloat(f[37]) || 0;
        limitUps.push({ name, code, price, chgPct, amount });
      }
    }
    limitUps.sort((a, b) => b.amount - a.amount);
    if (limitUps.length > 0) {
      limitUps.forEach((s, i) => {
        console.log(`  🔒 ${s.name.padEnd(8)} ${s.code}  ${s.price.toFixed(2)}  ${s.chgPct.toFixed(2)}%  ${(s.amount/10000).toFixed(1)}亿`);
      });
      console.log(`\n  共 ${limitUps.length} 只涨停`);
    } else {
      console.log('  📭 今日无主板涨停股');
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }
}

// 大盘指数
async function getMarket() {
  console.log('\n📊 大盘指数（收盘）');
  console.log('─'.repeat(60));
  try {
    const data = await fetchUrl('http://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006,s_sz399005');
    const lines = data.trim().split('\n');
    for (const line of lines) {
      const f = parseQtLine(line);
      if (!f) continue;
      const name = f[1];
      const price = parseFloat(f[3]) || 0;
      const chg = parseFloat(f[4]) || 0;
      const chgPct = parseFloat(f[5]) || 0;
      const icon = chgPct > 0 ? '📈' : chgPct < 0 ? '📉' : '➡️';
      console.log(`  ${icon} ${name}  ${price.toFixed(2)}  ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}  ${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`);
    }
  } catch(e) {
    console.log('  ⚠️ 指数获取失败:', e.message);
  }
}

async function main() {
  await getMarket();
  await getLimitUp();
  await getGainers();
  await getsectors();
}

main();
