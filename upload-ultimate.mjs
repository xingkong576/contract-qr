#!/usr/bin/env node
/**
 * 终极图床上传脚本 - 尝试多种方案
 * 
 * 方案 1: 0x0.st (纯文本返回，直接出 URL)
 * 方案 2: GitHub Gist API (用 gh CLI 或 raw API)
 * 方案 3: File.io (临时共享)
 */
import https from 'https';
import http from 'http';
import fs from 'fs';

const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) {
  console.error('Usage: node upload-ultimate.mjs <image-file>');
  process.exit(1);
}

const imageData = fs.readFileSync(FILE);
const fileName = FILE.split('\\').pop();
const ext = fileName.split('.').pop().toLowerCase();

console.log(`📁 ${FILE} (${(imageData.length/1024).toFixed(0)}KB, .${ext})\n`);

// === 方案 1: 0x0.st ===
async function upload_0x0() {
  return new Promise((resolve, reject) => {
    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    let body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    body = Buffer.concat([body, imageData, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    
    console.log('[1] 尝试 0x0.st...');
    const req = https.request({
      hostname: '0x0.st',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'User-Agent': 'curl/7.68.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const url = data.trim();
        if (url.startsWith('http')) {
          console.log(`   ✅ 0x0.st: ${url}`);
          resolve(url);
        } else {
          reject(new Error(data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// === 方案 2: Imgur 匿名上传 ===
async function upload_imgur() {
  return new Promise((resolve, reject) => {
    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    const base64img = imageData.toString('base64');
    
    console.log('[2] 尝试 Imgur (匿名)...');
    const req = https.request({
      hostname: 'api.imgur.com',
      path: '/3/image',
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID 9e57cb1c4791f6d',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success && parsed.data?.link) {
            console.log(`   ✅ Imgur: ${parsed.data.link}`);
            resolve(parsed.data.link);
          } else {
            reject(new Error(JSON.stringify(parsed.data || parsed)));
          }
        } catch { reject(new Error(data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(JSON.stringify({ image: base64img, type: 'base64' }));
    req.end();
  });
}

// === 方案 3: File.io ===
async function upload_fileio() {
  return new Promise((resolve, reject) => {
    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    let body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    body = Buffer.concat([body, imageData, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    
    console.log('[3] 尝试 file.io...');
    const req = https.request({
      hostname: 'file.io',
      path: '/',
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
        try {
          const parsed = JSON.parse(data);
          if (parsed.success && parsed.link) {
            console.log(`   ✅ file.io: ${parsed.link}`);
            resolve(parsed.link);
          } else {
            reject(new Error(JSON.stringify(parsed)));
          }
        } catch { reject(new Error(data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// === 执行 ===
(async () => {
  for (const upload of [upload_0x0, upload_imgur, upload_fileio]) {
    try {
      const url = await upload();
      console.log(`\n🎉 成功! 图片 URL: ${url}`);
      return;
    } catch (err) {
      console.log(`   ❌ ${err.message}`);
      console.log('');
    }
  }
  console.log('❌ 所有方案都失败了');
})();
