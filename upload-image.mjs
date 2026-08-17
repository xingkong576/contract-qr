#!/usr/bin/env node
/**
 * 上传本地图片到图床，返回公网 URL
 * 支持: ImgBB, 腾讯 COS（临时直链）, 或临时 HTTP server
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import { execSync } from 'child_process';

const IMAGE_FILE = process.argv[2];

if (!IMAGE_FILE || !fs.existsSync(IMAGE_FILE)) {
  console.error('Usage: node upload-image.mjs <image-file>');
  process.exit(1);
}

const imageData = fs.readFileSync(IMAGE_FILE);
const base64 = imageData.toString('base64');

// === 方案1: ImgBB ===
async function uploadImgBB() {
  return new Promise((resolve, reject) => {
    const token = process.env.IMGBB_TOKEN || '2d5a27a4944a84469a864737a84469a8';
    const formData = new URLSearchParams();
    formData.append('image', base64);
    formData.append('key', token);
    
    const req = https.request('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData.toString()),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success && parsed.data && parsed.data.url) {
            console.log('✅ ImgBB:', parsed.data.url);
            resolve(parsed.data.url);
          } else {
            reject(new Error(`ImgBB: ${JSON.stringify(parsed.error || parsed)}`));
          }
        } catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    req.write(formData.toString());
    req.end();
  });
}

// === 方案2: cat.pics (无需 API key) ===
async function uploadCatPics() {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    let body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    );
    body = Buffer.concat([body, imageData, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    
    const req = https.request('https://cat.pics/upload', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.url) {
            const url = parsed.thumb ? 'https://cat.pics' + parsed.thumb : 'https://cat.pics' + parsed.url;
            console.log('✅ cat.pics:', url);
            resolve(url);
          } else {
            reject(new Error(`cat.pics: ${JSON.stringify(parsed)}`));
          }
        } catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// === 方案3: 临时本地 HTTP 服务 ===
async function localServer() {
  return new Promise(async (resolve, reject) => {
    const PORT = 18777;
    const ext = IMAGE_FILE.endsWith('.png') ? 'png' : 'jpg';
    const fileName = `cat_${Date.now()}.${ext}`;
    
    const server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
        res.end(imageData);
      } else {
        res.writeHead(404); res.end('not found');
      }
    });
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ 本地服务: http://localhost:${PORT}/${fileName} (保持终端运行)`);
      // 同时尝试公网 IP
      try {
        const { execSync } = require('child_process');
        const ip = execSync('ipconfig', { encoding: 'utf8' })
          .split('\n')
          .find(line => line.includes('IPv4 地址'))
          ?.split(':')[1]?.trim();
        if (ip) {
          console.log(`✅ 局域网: http://${ip}:${PORT}/${fileName}`);
        }
      } catch {}
      resolve(`http://localhost:${PORT}/${fileName}`);
    });
    
    // 5秒后关闭服务（防止忘记关）
    setTimeout(() => { server.close(); }, 60000); // 1分钟超时
  });
}

// === 执行 ===
(async () => {
  console.log(`📁 文件: ${IMAGE_FILE} (${(imageData.length / 1024).toFixed(0)}KB)\n`);
  
  let url;
  try {
    url = await uploadImgBB();
  } catch (err) {
    console.log(`❌ ImgBB 失败: ${err.message}`);
    console.log('尝试 cat.pics...');
    try {
      url = await uploadCatPics();
    } catch (err2) {
      console.log(`❌ cat.pics 失败: ${err2.message}`);
      console.log('回退到本地服务...');
      url = await localServer();
    }
  }
  
  console.log(`\n📋 最终 URL: ${url}`);
})();
