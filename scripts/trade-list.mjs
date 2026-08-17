#!/usr/bin/env node
// 短线选股 - 模拟交易列表
// 用法: node trade-list.mjs [holding|settled|all]

import fs from 'fs';
import path from 'path';

const TRACK_FILE = path.join(process.cwd(), 'scripts', 'trade-tracker.json');

function loadTrades() {
  try {
    if (fs.existsSync(TRACK_FILE)) {
      return JSON.parse(fs.readFileSync(TRACK_FILE, 'utf-8'));
    }
  } catch(e) {}
  return { trades: [] };
}

const data = loadTrades();
const trades = data.trades || [];
const filter = process.argv[2] || 'all';

if (trades.length === 0) {
  console.log('📭 暂无模拟交易记录');
  console.log('\n添加交易:');
  console.log('  node trade-add.mjs <股票代码> <买入价> [股数]');
  console.log('  例: node trade-add.mjs 000636 71.00 100');
  process.exit(0);
}

console.log('\n📋 模拟交易列表\n');

const filtered = filter === 'all' ? trades : trades.filter(t => t.status === filter);

if (filtered.length === 0) {
  console.log(`  无${filter === 'holding' ? '持仓' : '已结算'}记录`);
  console.log(`  用 "node trade-list.mjs all" 查看全部`);
  process.exit(0);
}

for (const t of filtered) {
  const statusIcon = t.status === 'holding' ? '📌' : (t.profitPct >= 0 ? '🟢' : '🔴');
  const statusText = t.status === 'holding' ? '持仓中' : '已结算';
  
  console.log(`  ${statusIcon} ID:${t.id}  ${t.name} (${t.code}) — ${statusText}`);
  console.log(`     买入: ${t.buyPrice} 股数: ${t.shares} 日期: ${t.buyDate}`);
  
  if (t.status === 'settled') {
    console.log(`     卖出: ${t.sellPrice} 盈亏: ${t.profitPct}% (${t.profitAmt >= 0 ? '+' : ''}${t.profitAmt}元)`);
  }
  console.log('');
}

// 汇总
const holdings = trades.filter(t => t.status === 'holding');
const settled = trades.filter(t => t.status === 'settled');
const totalProfit = settled.reduce((sum, t) => sum + (t.profitAmt || 0), 0);
const wins = settled.filter(t => t.profitPct >= 0).length;
const losses = settled.length - wins;

console.log('─'.repeat(50));
console.log(`总计: ${trades.length}笔 | 持仓: ${holdings.length} | 已结算: ${settled.length}`);
if (settled.length > 0) {
  console.log(`胜率: ${wins}/${settled.length} (${(wins/settled.length*100).toFixed(1)}%)`);
}
console.log(`累计盈亏: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(0)} 元\n`);
