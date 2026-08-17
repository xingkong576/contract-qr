#!/usr/bin/env node
// 短线选股系统 v2.0 - 盘前+盘中+收盘 三模式 + 模拟交易
// 用法：
//   node short-term-stock-picker.mjs premarket    - 盘前选股（9:25集合竞价）
//   node short-term-stock-picker.mjs intraday      - 盘中实时选股（9:30-15:00）
//   node short-term-stock-picker.mjs review        - 收盘复盘（15:00后）
//   node short-term-stock-picker.mjs track         - 跟踪模拟交易盈亏
//   node short-term-stock-picker.mjs               - 默认：盘前+收盘全套

import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE = 'https://push2.eastmoney.com';
const TRACK_FILE = path.join(process.cwd(), 'scripts', 'trade-tracker.json');

// ========== 网络请求 ==========
async function fetchData(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://quote.eastmoney.com/'
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch(e) { reject(e); }
          });
        }).on('error', reject);
      });
      return result;
    } catch(e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      } else {
        throw e;
      }
    }
  }
}

// ========== 工具函数 ==========
function fmt(v) { return v == null ? '--' : Number(v).toFixed(2); }
function fmtVol(v) {
  if (v == null) return '--';
  const n = Number(v);
  if (n >= 10000) return (n/10000).toFixed(1) + '万手';
  return n + '手';
}
function fmtAmt(v) {
  if (v == null) return '--';
  const n = Number(v);
  if (n >= 1e8) return (n/1e8).toFixed(2) + '亿';
  if (n >= 1e4) return (n/1e4).toFixed(1) + '万';
  return n.toFixed(0);
}
function ts() {
  return new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'});
}

// ========== 模拟交易数据 ==========
function loadTrades() {
  try {
    if (fs.existsSync(TRACK_FILE)) {
      return JSON.parse(fs.readFileSync(TRACK_FILE, 'utf-8'));
    }
  } catch(e) {}
  return { trades: [], version: '2.1' };
}

function saveTrades(data) {
  fs.writeFileSync(TRACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function isQualified(s) {
  const code = String(s.f12 || '');
  if (code.startsWith('68')) return false;
  if (code.startsWith('30')) return false;
  const name = String(s.f14 || '');
  if (name.includes('ST') || name.includes('st') || name.includes('退')) return false;
  if (s.f2 == null || s.f2 === 0) return false;
  if (s.f5 != null && Number(s.f5) === 0) return false;
  return true;
}

// ========== 大盘概览 ==========
async function marketOverview() {
  console.log('\n📊 大盘概览');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,0.399005` +
      `&fields=f2,f3,f4,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('  ' + '指数'.padEnd(12) + '点位'.padEnd(14) + '涨跌幅'.padEnd(12));
      console.log('  ' + '─'.repeat(38));
      resp.data.diff.forEach(s => {
        const icon = Number(s.f3) > 2 ? '🔥' : Number(s.f3) > 0 ? '📈' : '📉';
        console.log(`  ${icon} ${s.f14.padEnd(12)} ${fmt(s.f2).padEnd(14)} ${fmt(s.f3)+'%'.padEnd(12)}`);
      });
    }
  } catch(e) {
    console.log('  ⚠️ 指数获取失败:', e.message);
  }
}

// ========== 板块热度 ==========
async function scanSectors() {
  console.log('\n🔥 板块热度');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:1,t:2,m:1,t:23,m:1,t:16,m:1,t:20` +
      `&fields=f2,f3,f4,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('  概念板块涨幅TOP5:');
      resp.data.diff.slice(0, 5).forEach((s,i) => {
        console.log(`    ${i+1}. ${s.f14.padEnd(16)} ${fmt(s.f2).padStart(10)}  ${fmt(s.f3)+'%'}`);
      });
    }
  } catch(e) {
    console.log('  ⚠️ 概念板块获取失败:', e.message);
  }
}

// ========== 获取单只股票实时价格 ==========
async function getStockPrice(code) {
  // secids 格式: 1.600519(沪市), 0.000858(深市)
  const prefix = code.startsWith('6') ? '1' : '0';
  const secid = `${prefix}.${code}`;
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/stock/get?fltt=2&secids=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f169,f170`
    );
    if (resp?.data) {
      return {
        price: resp.data.f43,      // 现价
        open: resp.data.f44,       // 开盘价
        yesterdayClose: resp.data.f45, // 昨收
        high: resp.data.f46,
        low: resp.data.f47,
        volume: resp.data.f48,
        amount: resp.data.f169,    // 成交额
        name: resp.data.f58,
      };
    }
  } catch(e) {
    // try fallback field set
    try {
      const resp = await fetchData(
        `${BASE}/api/qt/stock/get?fltt=2&secids=${secid}&fields=f2,f3,f4,f5,f6,f12,f14,f16`
      );
      if (resp?.data) {
        return {
          price: resp.data.f2,
          open: resp.data.f4,
          yesterdayClose: null,
          high: null,
          low: null,
          volume: resp.data.f5,
          amount: resp.data.f6,
          name: resp.data.f14,
        };
      }
    } catch(e2) {}
  }
  return null;
}

// ========== 模拟交易跟踪 ==========
async function trackTrades() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  📋 模拟交易跟踪 - 盈亏统计                           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  const data = loadTrades();
  const trades = data.trades || [];

  if (trades.length === 0) {
    console.log('  📭 暂无模拟交易记录。\n');
    console.log('  使用方法：');
    console.log('  1. 盘前/盘中选股后，手动添加交易记录');
    console.log('  2. 格式: node track-add.mjs <股票代码> <买入价> <日期>');
    console.log('  3. 次日运行本命令查看盈亏');
    return;
  }

  console.log(`\n  共 ${trades.length} 笔交易\n`);

  let totalProfit = 0;
  let winCount = 0;
  let loseCount = 0;
  let holdCount = 0;

  const today = new Date().toISOString().slice(0, 10);

  for (const t of trades) {
    const status = t.status || 'holding';
    const profitPct = t.profitPct || 0;
    const profitAmt = t.profitAmt || 0;

    if (status === 'holding') {
      holdCount++;
      // 尝试获取最新价格计算浮动盈亏
      const price = await getStockPrice(t.code);
      if (price && price.price) {
        const currentPct = ((price.price - t.buyPrice) / t.buyPrice * 100).toFixed(2);
        const currentAmt = (price.price - t.buyPrice) * t.shares;
        console.log(`  📌 ${t.name} (${t.code}) — 持仓中`);
        console.log(`     买入: ${t.buyPrice} 现价: ${price.price} 浮动: ${currentPct}% (${currentAmt >= 0 ? '+' : ''}${currentAmt.toFixed(0)}元)`);
        totalProfit += currentAmt;
      } else {
        console.log(`  📌 ${t.name} (${t.code}) — 持仓中（无法获取现价）`);
      }
    } else {
      // 已结算
      if (profitPct >= 0) winCount++; else loseCount++;
      const icon = profitPct >= 0 ? '🟢' : '🔴';
      console.log(`  ${icon} ${t.name} (${t.code}) — 已结算`);
      console.log(`     买入: ${t.buyPrice} 卖出: ${t.sellPrice} 盈亏: ${profitPct}% (${profitAmt >= 0 ? '+' : ''}${profitAmt.toFixed(0)}元)`);
      totalProfit += profitAmt;
    }
  }

  const totalTrades = winCount + loseCount;
  console.log('\n' + '─'.repeat(50));
  console.log(`\n  📊 统计汇总:`);
  console.log(`     总交易数: ${totalTrades}`);
  console.log(`     盈利: ${winCount} 次  亏损: ${loseCount} 次`);
  if (totalTrades > 0) {
    const winRate = (winCount / totalTrades * 100).toFixed(1);
    console.log(`     胜率: ${winRate}%`);
  }
  console.log(`     持仓中: ${holdCount} 笔`);
  console.log(`     累计盈亏: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)} 元`);

  // 按日期分组
  const byDate = {};
  for (const t of trades) {
    const d = t.date || 'unknown';
    if (!byDate[d]) byDate[d] = { count: 0, profit: 0, wins: 0, losses: 0 };
    byDate[d].count++;
    byDate[d].profit += t.profitAmt || 0;
    if (t.status === 'settled') {
      if (t.profitPct >= 0) byDate[d].wins++; else byDate[d].losses++;
    }
  }

  const dates = Object.keys(byDate).sort().reverse();
  if (dates.length > 0) {
    console.log('\n  📅 每日明细:');
    for (const d of dates.slice(-10)) { // 最近10天
      const s = byDate[d];
      const icon = s.profit >= 0 ? '🟢' : '🔴';
      console.log(`    ${d}  ${icon} ${s.count}笔 | 胜率: ${((s.wins/(s.wins+s.losses))*100||0).toFixed(0)}% | 盈亏: ${s.profit>=0?'+':''}${s.profit.toFixed(0)}元`);
    }
  }
}

// ========== 模式1：盘前选股（9:25集合竞价）==========
async function premarket() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  🌅 盘前选股 - 集合竞价分析                           ║');
  console.log('║  用途：选出今日开盘追涨目标                           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  await marketOverview();

  // 昨日涨停股
  console.log('\n🔥 昨日涨停股（今日竞价强弱）');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=50&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14,f16`
    );
    if (resp?.data?.diff) {
      const todayLimitUp = resp.data.diff.filter(s => isQualified(s) && Number(s.f3) >= 9.9);
      if (todayLimitUp.length > 0) {
        console.log(`  今日已涨停(${todayLimitUp.length}只):`);
        todayLimitUp.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
        todayLimitUp.slice(0, 10).forEach(s => {
          console.log(`    🔒 ${s.f14.padEnd(10)} ${s.f12}  ${fmt(s.f2)}  ${fmtAmt(s.f6)} 封板`);
        });
      }

      const strongStocks = resp.data.diff.filter(s => {
        if (!isQualified(s)) return false;
        const chg = Number(s.f3 || 0);
        const amt = Number(s.f6 || 0);
        return chg >= 3 && chg < 9.9 && amt > 3e8;
      });
      strongStocks.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
      if (strongStocks.length > 0) {
        console.log(`\n  📈 今日强势候选(${strongStocks.length}只) - 追涨关注:`);
        console.log('  ' + '序号'.padEnd(4) + '代码'.padEnd(10) + '名称'.padEnd(10) + '现价'.padEnd(10) + '涨幅'.padEnd(10) + '成交额'.padEnd(14));
        console.log('  ' + '─'.repeat(58));
        strongStocks.slice(0, 10).forEach((s,i) => {
          console.log(`  ${String(i+1).padEnd(4)}${s.f12.padEnd(10)}${s.f14.padEnd(10)}${fmt(s.f2).padEnd(10)}${fmt(s.f3)+'%'.padEnd(10)}${fmtAmt(s.f6).padEnd(14)}`);
        });
      }
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }

  await scanSectors();

  console.log('\n💡 操作建议:');
  console.log('  • 涨停股：观察封单强度，明日可追连板');
  console.log('  • 强势股：竞价高开+放量，开盘可追');
  console.log('  • 板块龙头：成交额最大的那只优先关注');

  // 记录今日选股
  recordTodaySelections();
}

// ========== 记录今日选股（用于后续跟踪）==========
function recordTodaySelections() {
  // 读取今日已生成的报告，提取候选股
  const memoryDir = path.join(process.cwd(), 'memory');
  const today = new Date().toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai'}).replace(/\//g, '-');
  const dailyFile = path.join(memoryDir, `${today}-daily.md`);

  if (fs.existsSync(dailyFile)) {
    const content = fs.readFileSync(dailyFile, 'utf-8');
    // 简单的正则匹配股票代码
    const codeRegex = /\b([0-9]{6})\b/g;
    const codes = new Set();
    let m;
    while ((m = codeRegex.exec(content)) !== null) {
      const code = m[1];
      if (!code.startsWith('68') && !code.startsWith('30')) {
        codes.add(code);
      }
    }
    if (codes.size > 0) {
      console.log(`\n📝 今日选股记录: ${codes.size} 只股票在报告中提及`);
    }
  }
}

// ========== 模式2：盘中实时 ==========
async function intraday() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  ⚡ 盘中实时选股                                      ║');
  console.log('║  用途：盘中追强势股                                   ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  await marketOverview();

  // 涨幅榜
  console.log('\n📈 涨幅榜TOP15（盘中追涨）');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=50&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14,f16`
    );
    if (resp?.data?.diff) {
      const qualified = resp.data.diff.filter(s => {
        if (!isQualified(s)) return false;
        const chg = Number(s.f3 || 0);
        const trn = Number(s.f16 || 0);
        const amt = Number(s.f6 || 0);
        return chg >= 3 && chg <= 9 && trn >= 3 && trn <= 20 && amt > 3e8;
      });
      qualified.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
      qualified.slice(0, 15).forEach((s,i) => {
        const badge = Number(s.f3) >= 7 ? '🔥' : '';
        console.log(`  ${String(i+1).padEnd(2)}. ${badge} ${s.f14.padEnd(10)} ${s.f12}  ${fmt(s.f2).padStart(8)}  ${fmt(s.f3)+'%'.padStart(8)}  ${fmtAmt(s.f6).padStart(10)}`);
      });
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }

  // 成交额TOP
  console.log('\n💰 成交额TOP10（资金关注）');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2` +
      `&fid=f6&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14`
    );
    if (resp?.data?.diff) {
      const qualified = resp.data.diff.filter(s => isQualified(s));
      qualified.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
      qualified.slice(0, 10).forEach((s,i) => {
        console.log(`  ${String(i+1).padEnd(2)}. ${s.f14.padEnd(10)} ${s.f12}  ${fmt(s.f2).padStart(8)}  ${fmt(s.f3)+'%'.padStart(8)}  ${fmtAmt(s.f6).padStart(10)}`);
      });
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }

  await scanSectors();

  console.log('\n💡 盘中操作:');
  console.log('  • 追涨停：涨幅>7%且放量，开盘追');
  console.log('  • 做T：持仓股日内波动>3%可高抛低吸');
  console.log('  • 止损：跌破5日线或亏损>5%果断走');
}

// ========== 模式3：收盘复盘 ==========
async function review() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  📋 收盘复盘 - 选明日候选                            ║');
  console.log('║  用途：今晚复盘，明天开盘用                           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  await marketOverview();

  // 涨停股分析
  console.log('\n🔒 今日涨停股分析');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=50&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14,f16`
    );
    if (resp?.data?.diff) {
      const limitUp = resp.data.diff.filter(s => {
        if (!isQualified(s)) return false;
        return Number(s.f3) >= 9.9;
      });
      if (limitUp.length > 0) {
        limitUp.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
        limitUp.forEach((s,i) => {
          console.log(`  🔥 ${s.f14.padEnd(10)} ${s.f12}  ${fmt(s.f2).padStart(8)}  ${fmt(s.f3)+'%'.padStart(8)}  ${fmtAmt(s.f6).padStart(10)}  ${fmtVol(s.f5)}`);
        });
        console.log(`  共 ${limitUp.length} 只涨停`);
      } else {
        console.log('  📭 今日无主板涨停股');
      }
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }

  // 强势股
  console.log('\n📈 强势股（涨幅5%-9%，明日连板候选）');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=50&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14,f16`
    );
    if (resp?.data?.diff) {
      const strong = resp.data.diff.filter(s => {
        if (!isQualified(s)) return false;
        const chg = Number(s.f3 || 0);
        const amt = Number(s.f6 || 0);
        return chg >= 5 && chg < 9.9 && amt > 5e8;
      });
      strong.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
      strong.slice(0, 10).forEach((s,i) => {
        console.log(`  ${String(i+1).padEnd(2)}. ${s.f14.padEnd(10)} ${s.f12}  ${fmt(s.f2).padStart(8)}  ${fmt(s.f3)+'%'.padStart(8)}  ${fmtAmt(s.f6).padStart(10)}`);
      });
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }

  await scanSectors();

  // 成交额TOP
  console.log('\n💰 成交额TOP10（主线资金流向）');
  console.log('─'.repeat(40));
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2` +
      `&fid=f6&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14`
    );
    if (resp?.data?.diff) {
      const qualified = resp.data.diff.filter(s => isQualified(s));
      qualified.sort((a,b) => Number(b.f6||0) - Number(a.f6||0));
      qualified.slice(0, 10).forEach((s,i) => {
        console.log(`  ${String(i+1).padEnd(2)}. ${s.f14.padEnd(10)} ${s.f12}  ${fmt(s.f2).padStart(8)}  ${fmt(s.f3)+'%'.padStart(8)}  ${fmtAmt(s.f6).padStart(10)}`);
      });
    }
  } catch(e) {
    console.log('  ⚠️ 获取失败:', e.message);
  }

  console.log('\n💡 明日操作计划:');
  console.log('  • 涨停股：观察竞价强弱，强则追连板');
  console.log('  • 强势股：明日高开可追，低开观望');
  console.log('  • 主线板块：成交额最大的板块优先关注');
}

// ========== 主程序 ==========
const mode = process.argv[2] || 'all';

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║       🚀 短线选股系统 v2.1                           ║');
console.log('║       过滤：排除科创板(68) · 创业板(30) · ST股       ║');
console.log('╚═══════════════════════════════════════════════════════╝');

(async () => {
  switch(mode) {
    case 'premarket':
    case '盘前':
    case 'p':
      await premarket();
      break;
    case 'intraday':
    case '盘中':
    case 'i':
      await intraday();
      break;
    case 'review':
    case '复盘':
    case 'r':
      await review();
      break;
    case 'track':
    case '跟踪':
    case 't':
      await trackTrades();
      break;
    default:
      console.log('\n📅 执行模式：盘前选股 + 收盘复盘');
      await premarket();
      await review();
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`⏰ 分析完成: ${ts()}`);
  console.log('═══════════════════════════════════════════════════\n');
})();
