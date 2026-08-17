const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const { toFile } = require('qrcode');

const URL_RE = /https:\/\/[\w-]+\.lhr\.life/;

// 1. 启动本地 HTTP 服务
const PORT = 8765;
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>合同详情 YS202210411</title>
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
  <div class="row"><span class="label">合同编号</span><span class="value">YS202210411</span></div>
  <div class="row"><span class="label">出卖人</span><span class="value">甘肃中天房地产开发有限责任公司</span></div>
  <div class="row"><span class="label">买受人</span><span class="value">马巧霞</span></div>
  <div class="row"><span class="label">证件号码</span><span class="value id">622726198105172200</span></div>
  <div class="row"><span class="label">共有人</span><span class="value">马志杰</span></div>
  <div class="row"><span class="label">证件号码</span><span class="value id">62272619821218221X</span></div>
  <div class="row"><span class="label">总价</span><span class="value price">¥735,335</span></div>
  <div class="row"><span class="label">备案状态</span><span class="badge">已备案</span></div>
  <div class="row"><span class="label">备案时间</span><span class="value">2022-11-09 16:44:39</span></div>
  <div class="row"><span class="label">备案机关</span><span class="value">庄浪县住房和城乡建设局</span></div>
  <h2>🏠 房屋信息</h2>
  <div class="row"><span class="label">建筑面积</span><span class="value">127.84 平方米</span></div>
  <div class="row"><span class="label">套内面积</span><span class="value">99.22 平方米</span></div>
  <div class="row"><span class="label">房屋用途</span><span class="value">住宅</span></div>
  <div class="row"><span class="label">座落</span><span class="value addr">庄浪县水洛镇庄浪县中天花园B区11号楼1单元1501室</span></div>
</div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`✅ 本地服务: http://127.0.0.1:${PORT}`);

  // 2. 启动隧道
  const SSH = 'C:\\Program Files\\Git\\usr\\bin\\ssh.exe';
  const ssh = spawn(SSH, [
    '-T',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-R', `80:127.0.0.1:${PORT}`,
    'nokey@localhost.run'
  ], { stdio: 'pipe' });

  let tunnelUrl = null;

  ssh.stdout.on('data', (d) => {
    const t = d.toString();
    const m = t.match(URL_RE);
    if (m && !tunnelUrl) { tunnelUrl = m[0]; console.log('✅ 隧道:', tunnelUrl); }
  });
  ssh.stderr.on('data', (d) => {
    const t = d.toString();
    const m = t.match(URL_RE);
    if (m && !tunnelUrl) { tunnelUrl = m[0]; console.log('✅ 隧道( stderr):', tunnelUrl); }
  });

  ssh.on('close', (c) => {
    if (tunnelUrl) console.log('✅ 隧道稳定');
    else console.log('❌ 隧道断开:', c);
  });
  ssh.on('error', (e) => console.error('❌ SSH错误:', e.message));

  // 等待隧道就绪
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!tunnelUrl) { ssh.kill('SIGKILL'); resolve(); }
    }, 15000);
    const poll = setInterval(() => {
      if (tunnelUrl) { clearInterval(poll); clearTimeout(timer); resolve(); }
    }, 500);
  });

  if (!tunnelUrl) {
    console.log('❌ 隧道建立失败');
    server.close();
    process.exit(1);
  }

  // 3. 生成二维码
  const outPath = 'C:\\Users\\Administrator\\Desktop\\contract_qr.png';
  try {
    await toFile(outPath, tunnelUrl, {
      errorCorrectionLevel: 'H',
      margin: 3,
      width: 500
    });
    const st = fs.statSync(outPath);
    console.log(`✅ 二维码已保存: ${outPath} (${st.size} bytes)`);
  } catch (e) {
    console.error('❌ 二维码生成失败:', e.message);
  }

  server.close();
});

server.on('error', (e) => console.error('❌ 服务启动失败:', e.message));
