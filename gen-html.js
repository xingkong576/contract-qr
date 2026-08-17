const fs = require('fs');
const path = require('path');

// 合同数据
const CONTRACT = {
  contractNo: 'YS202210411',
  seller: '甘肃中天房地产开发有限责任公司',
  buyer: '马巧霞',
  buyerId: '622726198105172200',
  coOwner: '马志杰',
  coOwnerId: '62272619821218221X',
  total: '735335',
  status: '已备案',
  filedTime: '2022-11-09 16:44:39',
  filedOrg: '庄浪县住房和城乡建设局',
  area: '127.84',
  indoorArea: '99.22',
  usage: '住宅',
  address: '庄浪县水洛镇庄浪县中天花园B区11号楼1单元1501室'
};

// 生成 HTML 页面
function renderHTML(data) {
  const rows = [
    { l: '合同编号', v: data.contractNo },
    { l: '出卖人', v: data.seller },
    { l: '买受人', v: data.buyer },
    { l: '证件号码', v: data.buyerId, cls: 'id' },
    { l: '共有人', v: data.coOwner },
    { l: '证件号码', v: data.coOwnerId, cls: 'id' },
    { l: '总价', v: `¥${Number(data.total).toLocaleString()}`, cls: 'price' },
    { l: '备案状态', v: data.status, cls: 'badge' },
    { l: '备案时间', v: data.filedTime },
    { l: '备案机关', v: data.filedOrg },
  ].map(r =>
    `<div class="row"><span class="label">${r.l}</span><span class="value ${r.cls || ''}">${r.v}</span></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>合同详情 ${data.contractNo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6fa;padding:14px;font-size:17px;line-height:1.8}
.card{background:#fff;border-radius:16px;padding:22px;box-shadow:0 2px 16px rgba(0,0,0,.07);max-width:720px;margin:0 auto}
h1{font-size:24px;text-align:center;margin-bottom:18px;font-weight:700}
h2{font-size:19px;border-left:5px solid #3498db;padding-left:10px;margin:22px 0 12px;color:#2c3e50}
.row{display:flex;margin-bottom:10px;align-items:flex-start}
.label{color:#888;width:120px;flex-shrink:0;font-size:16px}
.value{color:#1a1a1a;font-weight:500;font-size:17px}
.id{color:#2563eb;font-weight:bold;letter-spacing:1.5px;font-size:19px}
.price{font-size:26px;color:#dc2626;font-weight:bold}
.badge{display:inline-block;background:#dc2626;color:#fff;border-radius:7px;padding:3px 14px;font-size:19px;font-weight:bold}
.addr{line-height:1.8}
</style>
</head>
<body>
<div class="card">
  <h1>📋 合同详情</h1>
  ${rows}
  <h2>🏠 房屋信息</h2>
  <div class="row"><span class="label">建筑面积</span><span class="value">${data.area} 平方米</span></div>
  <div class="row"><span class="label">套内面积</span><span class="value">${data.indoorArea} 平方米</span></div>
  <div class="row"><span class="label">房屋用途</span><span class="value">${data.usage}</span></div>
  <div class="row"><span class="label">座落</span><span class="value addr">${data.address}</span></div>
</div>
</body>
</html>`;
}

// 生成并保存 HTML
const html = renderHTML(CONTRACT);
const outPath = path.join(__dirname, 'contract_page.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✅ ${path.basename(outPath)} generated (${html.length} chars)`);
