const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── 配置 ────────────────────────────────────────────────────────────────────
const USERNAME = 'xingkong576';
const REPO = 'contract-qr';
const BRANCH = 'main';
const FILE_PATH = 'contract_page.html';

// 读取 HTML 文件
const htmlContent = fs.readFileSync(path.join(__dirname, FILE_PATH), 'utf8');

// 获取 GitHub Token
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) {
  console.log('❌ 未设置 GITHUB_TOKEN 环境变量');
  console.log('请执行: $env:GITHUB_TOKEN="ghp_..."');
  process.exit(1);
}

console.log(`📦 部署到 GitHub Pages: ${USERNAME}/${REPO}`);

// ─── GitHub API ──────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: urlPath,
      method: method,
      headers: {
        'User-Agent': 'OpenClaw-Deploy',
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        } else {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── git 命令 ────────────────────────────────────────────────────────────────
function gitRun(args, cwd = __dirname) {
  try {
    return execSync(`git ${args.join(' ')}`, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  // 1. 初始化 git 仓库
  console.log('\n🔧 初始化 git 仓库...');
  const gitInit = gitRun(['init'], __dirname);
  console.log('   初始化完成');

  // 2. 检查是否已有 remote
  const remotes = gitRun(['remote', 'get-url', 'origin'], __dirname);
  if (remotes.includes('error')) {
    console.log('📦 添加 GitHub remote...');
    const remoteUrl = `https://${TOKEN}@github.com/${USERNAME}/${REPO}.git`;
    gitRun(['remote', 'add', 'origin', remoteUrl], __dirname);
  }

  // 3. 配置 git
  gitRun(['config', 'user.email', '114883592@qq.com'], __dirname);
  gitRun(['config', 'user.name', 'xingkong576'], __dirname);
  gitRun(['config', 'commit.gpgsign', 'false'], __dirname);

  // 4. 创建 .gitignore
  const gitignore = 'node_modules/\n*.log\n';
  fs.writeFileSync(path.join(__dirname, '.gitignore'), gitignore);

  // 5. 添加文件
  console.log('\n📄 添加文件...');
  gitRun(['add', '.'], __dirname);

  // 6. 提交
  console.log('   提交更改...');
  gitRun(['commit', '-m', 'Deploy contract page to GitHub'], __dirname);

  // 7. 设置分支名
  gitRun(['branch', '-M', BRANCH], __dirname);

  // 8. 推送到 GitHub
  console.log('\n🚀 推送到 GitHub...');
  const pushOutput = gitRun(['push', '-u', 'origin', BRANCH], __dirname);
  console.log('   推送完成');

  // 9. 启用 GitHub Pages
  console.log('\n🌐 配置 GitHub Pages...');
  try {
    await apiRequest('POST', `/repos/${USERNAME}/${REPO}/pages`, JSON.stringify({
      source: { branch: BRANCH, path: '/' }
    }));
    console.log('✅ Pages 已启用');
  } catch (e) {
    console.log(`⚠️  Pages 配置: ${e.message}`);
  }

  // 10. 等待 Pages 部署
  console.log('\n⏳ 等待 Pages 部署...');
  await new Promise(r => setTimeout(r, 5000));

  const pagesInfo = await apiRequest('GET', `/repos/${USERNAME}/${REPO}/pages`);
  const pagesUrl = pagesInfo.html_url || `https://${USERNAME}.github.io/${REPO}`;
  console.log(`✅ Pages URL: ${pagesUrl}`);

  // 11. 生成二维码
  console.log('\n📱 生成二维码...');
  const qrScript = path.join(__dirname, 'gen-qr.js');
  const outPath = path.join(process.env.USERPROFILE, 'Desktop', 'contract_qr.png');
  try {
    execSync(`node "${qrScript}" "${outPath}" --no-tunnel`, {
      stdio: 'inherit',
      timeout: 30000
    });
    console.log(`✅ 二维码已生成: ${outPath}`);
  } catch (e) {
    console.log(`⚠️  二维码生成跳过: ${e.message}`);
    console.log(`   可用此 URL 生成二维码: ${pagesUrl}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 部署完成！');
  console.log(`   Pages: ${pagesUrl}`);
  console.log('   用微信扫描桌面二维码即可查看合同详情');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => {
  console.error('\n❌ 部署失败:', e.message);
  process.exit(1);
});
