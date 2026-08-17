#!/usr/bin/env node
/**
 * 上传到 catbox.moe（无需注册，无需 token，最大 200MB）
 * 
 * API: POST https://catbox.moe/user/api.php
 *   reqtype=fileupload
 *   fileToUpload=@file
 * 
 * 返回: 直接返回文件的公网 URL
 */
import https from 'https';
import fs from 'fs';

const FILE = process.argv[2];

if (!FILE || !fs.existsSync(FILE)) {
  console.error('Usage: node upload-catbox.mjs <image-file>');
  process.exit(1);
}

const imageData = fs.readFileSync(FILE);

// 用 multipart/form-data 上传
const boundary = '----CatBoxBoundary' + Math.random().toString(36).slice(2);
const fileName = FILE.split('\\').pop();

// Build multipart body
const parts = [];
parts.push(Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`
));
parts.push(Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
));
parts.push(imageData);
parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
const body = Buffer.concat(parts);

console.log(`📤 上传到 catbox.moe: ${FILE} (${(imageData.length/1024).toFixed(0)}KB)`);

const req = https.request({
  hostname: 'catbox.moe',
  path: '/user/api.php',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
    'User-Agent': 'Mozilla/5.0',
  },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const url = data.trim();
    if (url.startsWith('https://')) {
      console.log(`✅ ${url}`);
    } else {
      console.error(`❌ 上传失败: ${data}`);
      process.exit(1);
    }
  });
});
req.on('error', (err) => {
  console.error(`❌ 网络错误: ${err.message}`);
  process.exit(1);
});
req.setTimeout(30000, () => {
  req.destroy();
  console.error('❌ 超时');
  process.exit(1);
});
req.write(body);
req.end();
