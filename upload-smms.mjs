#!/usr/bin/env node
/**
 * 上传到 sm.ms 图床（免费，无需 token，文件保留 1 年以上）
 */
import https from 'https';
import http from 'http';
import fs from 'fs';

const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) {
  console.error('Usage: node upload-smms.mjs <image-file>');
  process.exit(1);
}

const imageData = fs.readFileSync(FILE);

const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
let body = Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="smfile"; filename="${FILE.split('\\').pop()}"\r\nContent-Type: application/octet-stream\r\n\r\n`
);
body = Buffer.concat([body, imageData, Buffer.from(`\r\n--${boundary}--\r\n`)]);

console.log(`📤 上传到 sm.ms: ${FILE} (${(imageData.length/1024).toFixed(0)}KB)`);

// sm.ms 308 redirect 到 https://sm.ms -> 需要手动 follow
const req = https.request({
  hostname: 'sm.ms',
  path: '/api/v2/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
    'User-Agent': 'Mozilla/5.0',
  },
}, (res) => {
  // 处理 redirect
  if (res.statusCode === 308 || (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)) {
    console.log(`   🔄 重定向到: ${res.headers.location}`);
    const url = new URL(res.headers.location);
    const mod = url.protocol === 'https:' ? https : http;
    const redirectReq = mod.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'User-Agent': 'Mozilla/5.0',
      },
    }, (res2) => {
      let data = '';
      res2.on('data', chunk => data += chunk);
      res2.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            const url = parsed.data.url || parsed.data.links?.image;
            console.log(`✅ ${url}`);
          } else {
            console.error('❌ 上传失败:', JSON.stringify(parsed));
            process.exit(1);
          }
        } catch {
          console.error('❌ 解析失败:', data);
        }
      });
    });
    redirectReq.on('error', console.error);
    redirectReq.write(body);
    redirectReq.end();
    return;
  }
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        const url = parsed.data.url || parsed.data.links?.image;
        console.log(`✅ ${url}`);
      } else {
        console.error('❌ 上传失败:', JSON.stringify(parsed));
        process.exit(1);
      }
    } catch {
      console.error('❌ 解析失败:', data);
    }
  });
});

req.on('error', console.error);
req.write(body);
req.end();
