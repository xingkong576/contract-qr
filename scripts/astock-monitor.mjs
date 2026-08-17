#!/usr/bin/env node
// A股实时监控 & 优质股票池生成器
// 数据来源：东方财富免费API（无需API Key）
// 用法：
//   node astock-monitor.mjs pool        - 生成优质股票池（盘前）
//   node astock-monitor.mjs update       - 盘中实时更新（获取涨跌榜）
//   node astock-monitor.mjs snapshot     - 全市场快照（获取主要板块）
//   node astock-monitor.mjs watch <code> - 查询个股行情
//   node astock-monitor.mjs all          - 生成完整日报（开盘+盘中+收盘）

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE = 'https://push2.eastmoney.com';
const WORKSPACE = process.env.HOME || process.env.USERPROFILE || '/home';
const DATA_DIR = path.join(WORKSPACE, '.openclaw', 'workspace', 'astock-data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ========== 网络请求（带重试） ==========
async function fetchData(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

// ========== 数据格式化工具 ==========
function formatPrice(v) {
  return v == null ? '--' : Number(v).toFixed(2);
}

function formatChange(pct) {
  if (pct == null) return '--';
  const n = Number(pct);
  return n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
}

function formatVolume(vol) {
  // 东方财富 f5 是成交量(手)
  if (vol == null) return '--';
  const v = Number(vol);
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿手';
  if (v >= 10000) return (v / 10000).toFixed(2) + '万手';
  return v + '手';
}

function formatAmount(amt) {
  // f6 成交额(元)
  if (amt == null) return '--';
  const a = Number(amt);
  if (a >= 1e12) return (a / 1e12).toFixed(2) + '亿';
  if (a >= 1e8) return (a / 1e8).toFixed(2) + '亿';
  if (a >= 1e4) return (a / 1e4).toFixed(2) + '万';
  return a.toFixed(0);
}

function getTimestamp() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// ========== 过滤规则 ==========
function isQualified(s) {
  const code = String(s.f12 || '');
  // 排除科创板（68开头）
  if (code.startsWith('68')) return false;
  // 排除创业板（30开头）
  if (code.startsWith('30')) return false;
  // 排除ST股（名称包含ST）
  const name = String(s.f14 || '');
  if (name.includes('ST') || name.includes('st')) return false;
  return true;
}

// ========== 盘前选股：生成优质股票池 ==========
async function generateStockPool() {
  console.log(`\n🕘 ${getTimestamp()} - 开始生成优质股票池...\n`);
  console.log('  过滤规则: 排除科创板(68开头)、排除ST股\n');
  const pool = [];

  // 策略1：涨幅榜TOP（强势股）- 沪深主板+创业板
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14,f15,f16,f17`
    );
    if (resp?.data?.diff) {
      resp.data.diff.forEach(s => {
        if (isQualified(s)) {
          pool.push({
            code: s.f12,
            name: s.f14,
            price: formatPrice(s.f2),
            change: formatChange(s.f3),
            changeAmt: formatPrice(s.f4),
            volume: formatVolume(s.f5),
            amount: formatAmount(s.f6),
            amplitude: s.f15 != null ? Number(s.f15).toFixed(2) + '%' : '--',
            turnover: s.f16 != null ? Number(s.f16).toFixed(2) + '%' : '--',
            pe: s.f17 != null ? Number(s.f17).toFixed(2) : '--',
            source: '涨幅榜'
          });
        }
      });
    }
  } catch(e) { console.log('  ⚠️ 涨幅榜获取失败:', e.message); }

  // 策略2：成交额TOP（资金关注）
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2` +
      `&fid=f6&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14`
    );
    if (resp?.data?.diff) {
      resp.data.diff.forEach(s => {
        if (isQualified(s) && !pool.find(p => p.code === s.f12)) {
          pool.push({
            code: s.f12,
            name: s.f14,
            price: formatPrice(s.f2),
            change: formatChange(s.f3),
            changeAmt: formatPrice(s.f4),
            volume: formatVolume(s.f5),
            amount: formatAmount(s.f6),
            source: '成交额TOP'
          });
        }
      });
    }
  } catch(e) { console.log('  ⚠️ 成交额榜获取失败:', e.message); }

  // 策略3：北向资金/主力资金关注 - 概念板块涨幅
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=15&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:1,t:2,m:1,t:23,m:1,t:16,m:1,t:20` +
      `&fields=f2,f3,f4,f12,f14`
    );
    if (resp?.data?.diff) {
      resp.data.diff.forEach(s => {
        if (isQualified(s) && !pool.find(p => p.code === s.f12)) {
          pool.push({
            code: s.f12,
            name: s.f14,
            price: formatPrice(s.f2),
            change: formatChange(s.f3),
            changeAmt: formatPrice(s.f4),
            source: '概念板块'
          });
        }
      });
    }
  } catch(e) { console.log('  ⚠️ 概念板块获取失败:', e.message); }

  // 去重取TOP 50
  const unique = [];
  const seen = new Set();
  pool.forEach(p => {
    if (!seen.has(p.code) && unique.length < 50) {
      unique.push(p);
      seen.add(p.code);
    }
  });

  // 格式化输出
  const table = unique.map((p, i) => {
    let line = `  ${String(i + 1).padStart(2)}. ${p.name.padEnd(8)}`;
    line += ` ${p.code}`;
    line += `  ${p.price.padStart(8)}`;
    line += `  ${p.change.padStart(9)}`;
    if (p.amount) line += `  ${String(p.amount).padStart(8)}`;
    line += `  [${p.source}]`;
    return line;
  }).join('\n');

  const output = [
    '═══════════════════════════════════════════════════════════════',
    '🚀  A股优质股票池',
    `⏰  生成时间: ${getTimestamp()}`,
    '═══════════════════════════════════════════════════════════════',
    '  代码    名称            最新价    涨跌幅      成交额    来源',
    '─────────────────────────────────────────────────────────────',
    table,
    '─────────────────────────────────────────────────────────────',
    `  共 ${unique.length} 只股票`,
    '═══════════════════════════════════════════════════════════════\n',
  ].join('\n');

  console.log(output);

  // 保存到文件
  const today = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
  const file = path.join(DATA_DIR, `pool-${today}.txt`);
  fs.writeFileSync(file, output, 'utf-8');
  console.log(`💾 已保存到: ${file}\n`);

  return output;
}

// ========== 盘中实时更新 ==========
async function marketUpdate() {
  console.log(`\n📡 ${getTimestamp()} - 盘中行情更新\n`);
  const updates = [];

  // 涨幅榜TOP20
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('📈 涨幅TOP20:');
      let count = 0;
      resp.data.diff.forEach((s, i) => {
        if (isQualified(s)) {
          console.log(`  ${String(count+1).padStart(2)}. ${s.f14.padEnd(8)} ${formatPrice(s.f2).padStart(8)} ${formatChange(s.f3).padStart(10)}  ${formatAmount(s.f6)}`);
          count++;
          if (count >= 20) return;
        }
      });
      updates.push({ type: '涨幅TOP', data: resp.data.diff });
    }
  } catch(e) { console.log('  ⚠️ 涨幅榜失败:', e.message); }

  console.log('');

  // 跌幅榜TOP10
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=10&po=-1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('📉 跌幅TOP10:');
      let count = 0;
      resp.data.diff.forEach((s, i) => {
        if (isQualified(s)) {
          console.log(`  ${String(count+1).padStart(2)}. ${s.f14.padEnd(8)} ${formatPrice(s.f2).padStart(8)} ${formatChange(s.f3).padStart(10)}  ${formatAmount(s.f6)}`);
          count++;
          if (count >= 10) return;
        }
      });
      updates.push({ type: '跌幅TOP', data: resp.data.diff });
    }
  } catch(e) { console.log('  ⚠️ 跌幅榜失败:', e.message); }

  console.log('');

  // 上证指数 & 深证 & 创业板
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,0.399005` +
      `&fields=f2,f3,f4,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('📊 主要指数:');
      resp.data.diff.forEach(s => {
        console.log(`  ${s.f14.padEnd(12)} ${formatPrice(s.f2).padStart(10)} ${formatChange(s.f3).padStart(10)}`);
      });
      updates.push({ type: '指数', data: resp.data.diff });
    }
  } catch(e) { console.log('  ⚠️ 指数获取失败:', e.message); }

  // 保存更新记录
  const today = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
  const file = path.join(DATA_DIR, `update-${today}.txt`);
  fs.appendFileSync(file, `${getTimestamp()} 更新完成\n`, 'utf-8');

  return updates;
}

// ========== 板块热点 ==========
async function sectorHot() {
  console.log(`\n🔥 ${getTimestamp()} - 板块热点\n`);

  // 概念板块涨幅
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:1,t:2,m:1,t:23,m:1,t:16,m:1,t:20` +
      `&fields=f2,f3,f4,f5,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('🔥 概念板块涨幅TOP20:');
      resp.data.diff.forEach((s, i) => {
        console.log(`  ${String(i+1).padStart(2)}. ${s.f14.padEnd(12)} ${formatPrice(s.f2).padStart(8)} ${formatChange(s.f3).padStart(10)}  ${formatVolume(s.f5)}`);
      });
    }
  } catch(e) { console.log('  ⚠️ 概念板块失败:', e.message); }

  console.log('');

  // 行业板块
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=15&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:1,t:3,m:1,t:11,m:1,t:14` +
      `&fields=f2,f3,f4,f5,f12,f14`
    );
    if (resp?.data?.diff) {
      console.log('🏭 行业板块涨幅TOP15:');
      resp.data.diff.forEach((s, i) => {
        console.log(`  ${String(i+1).padStart(2)}. ${s.f14.padEnd(12)} ${formatPrice(s.f2).padStart(8)} ${formatChange(s.f3).padStart(10)}`);
      });
    }
  } catch(e) { console.log('  ⚠️ 行业板块失败:', e.message); }
}

// ========== 查询个股 ==========
async function queryStock(code) {
  console.log(`\n🔍 ${getTimestamp()} - 查询: ${code}\n`);

  try {
    const resp = await fetchData(
      `${BASE}/api/qt/stock/get?secid=${code}&fields=f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f22,f23,f24,f25,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f41&ut=fa5fd1943c7b386f172d6893dbfba10b`
    );
    if (resp?.data) {
      const d = resp.data;
      console.log(`  名称: ${d.f14 || '--'}`);
      console.log(`  代码: ${d.f12 || code}`);
      console.log(`  最新价: ${formatPrice(d.f2)}`);
      console.log(`  涨跌额: ${formatPrice(d.f4)}`);
      console.log(`  涨跌幅: ${formatChange(d.f3)}`);
      console.log(`  最高: ${formatPrice(d.f32)}`);
      console.log(`  最低: ${formatPrice(d.f33)}`);
      console.log(`  今开: ${formatPrice(d.f34)}`);
      console.log(`  昨收: ${formatPrice(d.f35)}`);
      console.log(`  成交量: ${formatVolume(d.f5)}`);
      console.log(`  成交额: ${formatAmount(d.f6)}`);
      console.log(`  换手率: ${d.f16 != null ? Number(d.f16).toFixed(2) + '%' : '--'}`);
      console.log(`  市盈率: ${d.f17 != null ? Number(d.f17).toFixed(2) : '--'}`);
      console.log(`  总市值: ${d.f20 != null ? formatAmount(d.f20) : '--'}`);
      console.log(`  流通市值: ${d.f21 != null ? formatAmount(d.f21) : '--'}`);
      console.log(`  涨停价: ${formatPrice(d.f40)}`);
      console.log(`  跌停价: ${formatPrice(d.f39)}`);
    }
  } catch(e) {
    console.log(`  ❌ 查询失败: ${e.message}`);
  }
}

// ========== 全市场日报 ==========
async function fullDailyReport() {
  console.log(`\n📋 ${getTimestamp()} - A股全市场日报\n`);
  const report = [];

  report.push(`A股全市场日报 - ${getTimestamp()}`);
  report.push('═'.repeat(60));

  // 1. 指数
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,0.399005` +
      `&fields=f2,f3,f4,f12,f14`
    );
    if (resp?.data?.diff) {
      report.push('\n📊 主要指数:');
      resp.data.diff.forEach(s => {
        report.push(`  ${s.f14.padEnd(12)} ${formatPrice(s.f2).padStart(10)} ${formatChange(s.f3).padStart(10)}`);
      });
    }
  } catch(e) {}

  // 2. 涨速榜
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=50&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:0+t:6,m:0+t:80,m:0+t:70,m:0+t:90` +
      `&fields=f2,f3,f4,f5,f6,f12,f14`
    );
    if (resp?.data?.diff) {
      report.push('\n📈 强势股TOP20:');
      let count = 0;
      resp.data.diff.forEach((s, i) => {
        if (isQualified(s)) {
          report.push(`  ${String(count+1).padStart(2)}. ${s.f14.padEnd(8)} ${formatPrice(s.f2).padStart(8)} ${formatChange(s.f3).padStart(10)}  ${formatAmount(s.f6)}`);
          count++;
          if (count >= 20) return;
        }
      });
    }
  } catch(e) {}

  // 3. 板块
  try {
    const resp = await fetchData(
      `${BASE}/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:1,t:2` +
      `&fields=f2,f3,f4,f12,f14`
    );
    if (resp?.data?.diff) {
      report.push('\n🔥 概念板块TOP10:');
      resp.data.diff.slice(0, 10).forEach((s, i) => {
        report.push(`  ${String(i+1).padStart(2)}. ${s.f14.padEnd(14)} ${formatChange(s.f3).padStart(10)}`);
      });
    }
  } catch(e) {}

  // 保存
  const today = new Date().toLocaleDateString('zh-CN').replace(/\//g, '');
  const file = path.join(DATA_DIR, `daily-${today}.txt`);
  fs.writeFileSync(file, report.join('\n'), 'utf-8');
  console.log(report.join('\n'));
  console.log(`\n💾 已保存到: ${file}`);
}

// ========== 主入口 ==========
const action = process.argv[2];
const code = process.argv[3];

switch (action) {
  case 'pool':
    generateStockPool();
    break;
  case 'update':
    marketUpdate();
    break;
  case 'snapshot':
    sectorHot();
    break;
  case 'watch':
    if (!code) {
      console.log('用法: node astock-monitor.mjs watch <股票代码>');
      console.log('示例: node astock-monitor.mjs watch 1.600519');
    } else {
      queryStock(code);
    }
    break;
  case 'all':
    fullDailyReport();
    break;
  default:
    console.log(`
🚀 A股实时监控 & 优质股票池

用法:
  node astock-monitor.mjs pool        - 生成优质股票池
  node astock-monitor.mjs update       - 盘中行情更新（涨幅/跌幅/指数）
  node astock-monitor.mjs snapshot     - 板块热点
  node astock-monitor.mjs watch <code> - 查询个股
  node astock-monitor.mjs all          - 全市场日报

代码格式:
  1.xxxxxx  - 上交所
  0.xxxxxx  - 深交所
  示例: 1.600519 (贵州茅台)
    `);
}
