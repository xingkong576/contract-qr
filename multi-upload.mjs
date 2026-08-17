#!/usr/bin/env node
/**
 * 多图床备选上传方案
 * 按优先级依次尝试：
 * 1. postimages.org（无需 token）
 * 2. imgbb.com（需要 token）
 * 3. 本地 http server（持久化运行）
 */
import https from 'https';
import http from 'http';
import fs from 'fs';

const FILE = process.argv[2];
if (!FILE || !fs.existsSync(FILE)) {
  console.error('Usage: node multi-upload.mjs <image-file>');
  process.exit(1);
}

const imageData = fs.readFileSync(FILE);
console.log(`📁 ${FILE} (${(imageData.length/1024).toFixed(0)}KB)\n`);

// === 1. postimages.org（无需注册，免费） ===
async function uploadPostImages() {
  return new Promise((resolve, reject) => {
    const boundary = '----PiBound' + Math.random().toString(36).slice(2);
    const fileName = FILE.split('\\').pop();
    let body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="upload"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    body = Buffer.concat([body, imageData, Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="submit"\r\n\r\nUpload\r\n--${boundary}--\r\n`)]);
    
    console.log('🔹 尝试 postimages.org...');
    const req = https.request({
      hostname: 'postimages.org',
      path: '/v1/upload.php',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://postimages.org/',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.images) {
            console.log(`✅ postimages: https://i.postimg.cc/${parsed.images.original}`);
            resolve(`https://i.postimg.cc/${parsed.images.original}`);
          } else if (parsed.success) {
            console.log(`✅ postimages: ${parsed.image_url}`);
            resolve(`https://i.postimg.cc/${parsed.image_url}`);
          } else {
            console.log(`   postimages 返回: ${data.substring(0, 200)}`);
            reject(new Error('postimages 返回异常'));
          }
        } catch {
          console.log(`   postimages 非 JSON 响应: ${data.substring(0, 200)}`);
          reject(new Error('postimages 非 JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// === 2. 本地持久化 HTTP server ===
async function localServer() {
  return new Promise(async (resolve, reject) => {
    const PORT = 18777;
    const ext = FILE.endsWith('.png') ? 'png' : 'jpg';
    const fileName = `cat_${Date.now()}.${ext}`;
    const startTime = Date.now();
    
    console.log('🔹 启动本地 HTTP 服务...');
    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === `/${fileName}`) {
        res.writeHead(200, {
          'Content-Type': FILE.endsWith('.png') ? 'image/png' : 'image/jpeg',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        });
        res.end(imageData);
      } else {
        res.writeHead(404); res.end();
      }
    });
    
    await new Promise((resolveListen) => {
      server.listen(PORT, '0.0.0.0', resolveListen);
    });
    
    // 获取局域网 IP
    const { execSync } = await import('child_process');
    const ip = execSync('ipconfig', { encoding: 'utf8' })
      .split('\n')
      .find(line => line.includes('IPv4 地址'))
      ?.split(':')[1]?.trim();
    
    const localUrl = `http://localhost:${PORT}/${fileName}`;
    const lanUrl = ip ? `http://${ip}:${PORT}/${fileName}` : null;
    
    console.log(`✅ 本地服务已启动`);
    console.log(`   localhost: ${localUrl}`);
    if (lanUrl) console.log(`   局域网: ${lanUrl}`);
    console.log(`   将在 ${60 - Math.floor((Date.now()-startTime)/1000)} 秒后自动关闭`);
    
    resolve(localUrl);
    
    // 60 秒后自动关闭
    setTimeout(() => {
      server.close();
      console.log('   🏁 服务已关闭');
    }, 60000);
  });
}

// === 执行 ===
(async () => {
  let url;
  try {
    url = await uploadPostImages();
  } catch (err) {
    console.log(`   ❌ ${err.message}`);
    console.log('\n回退到本地服务（局域网可访问）...');
    url = await localServer();
  }
  
  console.log(`\n📋 使用此 URL 生成视频`);
})();
