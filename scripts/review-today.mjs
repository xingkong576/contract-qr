#!/usr/bin/env node
/**
 * 收盘复盘脚本 - 使用 AkShare 获取数据
 * 2026-07-07
 */

const { spawn } = await import("child_process");

function runPython(code) {
  return new Promise((resolve, reject) => {
    const py = spawn("python", ["-c", code]);
    let stdout = "";
    let stderr = "";
    py.stdout.on("data", d => stdout += d);
    py.stderr.on("data", d => stderr += d);
    py.on("close", code => {
      if (code !== 0) reject(new Error(stderr.trim()));
      else resolve(stdout.trim());
    });
    py.on("error", reject);
  });
}

async function main() {
  const today = "20260707";
  console.log("=".repeat(60));
  console.log("📊 A股收盘复盘报告");
  console.log(`   日期: ${today}`);
  console.log("=".repeat(60));

  // 1. 涨停股
  try {
    const code = `
import akshare as ak
import json
df = ak.stock_zt_pool_em(date='${today}')
print(json.dumps(df[['代码','名称','涨跌幅','封板资金','最后一次涨停时间','打开次数','涨停原因'].head(30)].to_dict(orient='records'), ensure_ascii=False, default=str))
`;
    const result = await runPython(code);
    const data = JSON.parse(result);
    console.log("\n🔒 今日涨停股 TOP30:");
    console.log("-".repeat(60));
    data.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.名称} (${item.代码})  涨幅:${item.涨跌幅}%  封板资金:${item.封板资金}  原因:${item.涨停原因}`);
    });
  } catch (e) {
    console.log("\n⚠️ 涨停股数据获取失败:", e.message.split("\n")[0]);
  }

  // 2. 跌幅榜/强势股
  try {
    const code = `
import akshare as ak
import json
df = ak.stock_zh_a_spot_em()
df = df[(df['涨跌幅'] >= 5) & (df['涨跌幅'] < 10)]
df = df.sort_values('涨跌幅', ascending=False)
cols = ['代码','名称','最新价','涨跌幅','成交额','总市值','换手率']
df = df[[c for c in cols if c in df.columns]].head(20)
print(json.dumps(df.to_dict(orient='records'), ensure_ascii=False, default=str))
`;
    const result = await runPython(code);
    const data = JSON.parse(result);
    console.log("\n📈 强势股（涨幅5%-9%）TOP20:");
    console.log("-".repeat(60));
    data.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.名称} (${item.代码})  涨幅:${item.涨跌幅}%  现价:${item.最新价}  成交额:${item.成交额}`);
    });
  } catch (e) {
    console.log("\n⚠️ 强势股数据获取失败:", e.message.split("\n")[0]);
  }

  // 3. 概念板块涨幅
  try {
    const code = `
import akshare as ak
import json
df = ak.stock_board_concept_name_em()
df = df.sort_values('涨跌幅', ascending=False)
cols = ['板块名称','涨跌幅','上涨家数','下跌家数','领涨股票','领涨股价']
df = df[[c for c in cols if c in df.columns]].head(15)
print(json.dumps(df.to_dict(orient='records'), ensure_ascii=False, default=str))
`;
    const result = await runPython(code);
    const data = JSON.parse(result);
    console.log("\n🔥 概念板块热度 TOP15:");
    console.log("-".repeat(60));
    data.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.板块名称}  涨跌幅:${item.涨跌幅}%  上涨:${item.上涨家数}家  下跌:${item.下跌家数}家  领涨:${item.领涨股票}(${item.领涨股价})`);
    });
  } catch (e) {
    console.log("\n⚠️ 概念板块数据获取失败:", e.message.split("\n")[0]);
  }

  // 4. 成交额TOP10
  try {
    const code = `
import akshare as ak
import json
df = ak.stock_zh_a_spot_em()
df = df.sort_values('成交额', ascending=False)
cols = ['代码','名称','最新价','涨跌幅','成交额','总市值']
df = df[[c for c in cols if c in df.columns]].head(10)
print(json.dumps(df.to_dict(orient='records'), ensure_ascii=False, default=str))
`;
    const result = await runPython(code);
    const data = JSON.parse(result);
    console.log("\n💰 成交额TOP10:");
    console.log("-".repeat(60));
    data.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.名称} (${item.代码})  现价:${item.最新价}  涨跌:${item.涨跌幅}%  成交额:${item.成交额}`);
    });
  } catch (e) {
    console.log("\n⚠️ 成交额数据获取失败:", e.message.split("\n")[0]);
  }

  // 5. 大盘指数
  try {
    const code = `
import akshare as ak
import json
indices = [['000001','上证指数'],['000300','沪深300'],['000905','中证500'],['399001','深证成指'],['399006','创业板指']]
result = []
for cd, nm in indices:
    df = ak.stock_zh_index_daily(symbol=cd)
    latest = df.tail(1).iloc[0]
    result.append({'名称':nm,'收盘':float(latest['close']),'日期':str(latest['date'])})
print(json.dumps(result, ensure_ascii=False, default=str))
`;
    const result = await runPython(code);
    const data = JSON.parse(result);
    console.log("\n📊 大盘指数:");
    console.log("-".repeat(60));
    data.forEach(item => {
      console.log(`  ${item.名称}: ${item.收盘.toFixed(2)} (${item.日期})`);
    });
  } catch (e) {
    console.log("\n⚠️ 大盘指数数据获取失败:", e.message.split("\n")[0]);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ 复盘完成");
  console.log("=".repeat(60));
}

main().catch(e => {
  console.error("主程序错误:", e.message);
  process.exit(1);
});
