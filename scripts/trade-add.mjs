#!/usr/bin/env node
// 短线选股 - 模拟交易记录工具 v2.1
// 用法:
//   node trade-add.mjs <股票代码> <买入价> [股数] [日期]
//   node trade-add.mjs 000636 71.00 100
//   node trade-add.mjs 000636 71.00 100 2026-06-16
//
// 查看盈亏: node short-term-stock-picker.mjs track

import fs from 'fs';
import path from 'path';

const TRACK_FILE = path.join(process.cwd(), 'scripts', 'trade-tracker.json');

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

const code = process.argv[2];
const buyPrice = parseFloat(process.argv[3]);
const shares = parseInt(process.argv[4]) || 100;
const tradeDate = process.argv[5] || new Date().toISOString().slice(0, 10);

if (!code || isNaN(buyPrice)) {
  console.log('用法: node trade-add.mjs <股票代码> <买入价> [股数] [日期]');
  console.log('示例: node trade-add.mjs 000636 71.00 100');
  console.log('      node trade-add.mjs 000636 71.00 100 2026-06-16');
  process.exit(1);
}

if (code.length !== 6 || !/^\d+$/.test(code)) {
  console.log('❌ 股票代码格式错误，应为6位数字');
  process.exit(1);
}

if (buyPrice <= 0) {
  console.log('❌ 买入价必须大于0');
  process.exit(1);
}

const data = loadTrades();
const trade = {
  id: Date.now(),
  code: code,
  name: `股票${code}`, // 暂时不查，下次track时再填
  buyPrice: buyPrice,
  shares: shares,
  buyDate: tradeDate,
  buyTime: new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}),
  status: 'holding', // holding | settled
  sellPrice: null,
  sellDate: null,
  profitPct: null,
  profitAmt: null,
  note: '',
};

data.trades.push(trade);
saveTrades(data);

const cost = (buyPrice * shares).toFixed(0);
console.log(`\n✅ 模拟交易已记录:`);
console.log(`   股票: ${code}`);
console.log(`   买入价: ${buyPrice.toFixed(2)} 元`);
console.log(`   股数: ${shares} 股`);
console.log(`   成本: ${cost} 元`);
console.log(`   日期: ${tradeDate}`);
console.log(`   状态: 持仓中`);
console.log(`\n💡 明天可以用 "node short-term-stock-picker.mjs track" 查看盈亏`);
console.log(`💡 卖出时用 "node trade-settle.mjs <id> <卖出价>" 结算`);
console.log(`💡 用 "node trade-list.mjs" 查看所有持仓\n`);
