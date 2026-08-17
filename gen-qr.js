const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { toFile } = require('qrcode');

const URL_RE = /https:\/\/[\w-]+\.lhr\.life/;

// 动态端口
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
    srv.on('error', reject);
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const outPath = args[0] || path.join(process.env.USERPROFILE, 'Desktop', 'contract_qr.png');
  const useTunnel = !args.includes('--local');

  // 找端口
  const port = await getFreePort();
  console.log(`🔌 端口: ${port}`);

  // 启动服务
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync('contract_page.html', 'utf8'));
  });

  await new Promise((resolve, reject) => {
    server.on('listening', resolve);
    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
  console.log(`✅ 本地: http://127.0.0.1:${port}`);

  let url;
  if (useTunnel) {
    // SSH 隧道
    const ssh = spawn('C:\\Program Files\\Git\\usr\\bin\\ssh.exe', [
      '-T', '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',
      '-R', `80:127.0.0.1:${port}`,
      'nokey@localhost.run'
    ], { stdio: 'pipe' });

    let tunnelUrl = null;
    ssh.stdout.on('data', (d) => {
      const m = d.toString().match(URL_RE);
      if (m && !tunnelUrl) { tunnelUrl = m[0]; console.log(`✅ 隧道: ${tunnelUrl}`); }
    });
    ssh.stderr.on('data', (d) => {
      const m = d.toString().match(URL_RE);
      if (m && !tunnelUrl) { tunnelUrl = m[0]; console.log(`✅ 隧道: ${tunnelUrl}`); }
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!tunnelUrl) { ssh.kill('SIGKILL'); reject(new Error('隧道超时')); }
      }, 15000);
      const poll = setInterval(() => {
        if (tunnelUrl) { clearInterval(poll); clearTimeout(timer); resolve(); }
      }, 500);
    });

    url = tunnelUrl;
  } else {
    url = `http://127.0.0.1:${port}`;
    console.log(`🔗 本地: ${url}`);
  }

  // 生成二维码
  await toFile(outPath, url, { errorCorrectionLevel: 'H', margin: 3, width: 500 });
  const st = fs.statSync(outPath);
  console.log(`✅ 二维码: ${outPath} (${st.size} bytes)`);
  console.log('📱 用微信扫码即可查看合同详情');

  server.close();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
