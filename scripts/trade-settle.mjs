#!/usr/bin/env node
// 短线选股 - 模拟交易结算工具
// 用法: node trade-settle.mjs <交易ID> <卖出价> [卖出日期]
//   交易ID: 用 trade-list.mjs 查看
//   卖出价: 整数或小数

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

function saveTrades(data) {
  fs.writeFileSync(TRACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const tradeId = parseInt(process.argv[2]);
const sellPrice = parseFloat(process.argv[3]);
const sellDate = process.argv[4] || new Date().toISOString().slice(0, 10);

if (!tradeId || isNaN(sellPrice)) {
  console.log('用法: node trade-settle.mjs <交易ID> <卖出价> [卖出日期]');
  console.log('示例: node trade-settle.mjs 1 68.50');
  console.log('      node trade-settle.mjs 1 68.50 2026-06-17');
  process.exit(1);
}

const data = loadTrades();
const trade = data.trades.find(t => t.id === tradeId);

if (!trade) {
  console.log(`❌ 未找到交易ID: ${tradeId}`);
  console.log('用 "node trade-list.mjs" 查看所有交易');
  process.exit(1);
}

if (trade.status === 'settled') {
  console.log(`⚠️ 该交易已结算，无法重复结算`);
  process.exit(1);
}

const cost = trade.buyPrice * trade.shares;
const revenue = sellPrice * trade.shares;
const profit = revenue - cost;
const profitPct = ((sellPrice - trade.buyPrice) / trade.buyPrice * 100);

trade.status = 'settled';
trade.sellPrice = sellPrice;
trade.sellDate = sellDate;
trade.profitPct = Math.round(profitPct * 100) / 100;
trade.profitAmt = Math.round(profit);

saveTrades(data);

const icon = profit >= 0 ? '🟢' : '🔴';
console.log(`\n${icon} 交易已结算:`);
console.log(`   股票: ${trade.name} (${trade.code})`);
console.log(`   买入: ${trade.buyPrice.toFixed(2)} × ${trade.shares} = ${cost.toFixed(0)} 元`);
console.log(`   卖出: ${sellPrice.toFixed(2)} × ${trade.shares} = ${revenue.toFixed(0)} 元`);
console.log(`   盈亏: ${profit >= 0 ? '+' : ''}${profit.toFixed(0)} 元 (${profitPct.toFixed(2)}%)`);
console.log(`   日期: ${trade.buyDate} → ${sellDate}\n`);
