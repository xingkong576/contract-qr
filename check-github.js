const https = require('https');

const USERNAME = 'xingkong576';
const REPO = 'contract-qr';
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.log('用法: node check-github.js <GITHUB_TOKEN>');
  console.log('');
  console.log('获取 Token:');
  console.log('  1. https://github.com/settings/tokens');
  console.log('  2. Generate new token (classic)');
  console.log('  3. 勾选 repo 权限');
  process.exit(1);
}

console.log(`检查 GitHub: ${USERNAME}/${REPO}...`);

const options = {
  hostname: 'api.github.com',
  port: 443,
  path: `/repos/${USERNAME}/${REPO}`,
  method: 'GET',
  headers: {
    'User-Agent': 'OpenClaw',
    'Authorization': `token ${TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode === 404) {
      console.log('❌ 仓库不存在，需要创建');
      process.exit(1);
    } else if (res.statusCode >= 400) {
      console.log(`❌ HTTP ${res.statusCode}: ${data.slice(0, 200)}`);
      process.exit(1);
    } else {
      const repo = JSON.parse(data);
      console.log(`✅ 仓库已存在`);
      console.log(`   URL: ${repo.html_url}`);
      console.log(`   分支: ${repo.default_branch}`);
      console.log(`   大小: ${repo.size} KB`);
    }
  });
});

req.on('error', e => {
  console.error('❌ 网络错误:', e.message);
  process.exit(1);
});

req.end();
