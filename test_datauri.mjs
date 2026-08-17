#!/usr/bin/env node
/**
 * Test if Agnes API accepts data URI for image parameter
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const CREATE_ENDPOINT = 'https://apihub.agnes-ai.com/v1/videos';
const QUERY_ENDPOINT = 'https://apihub.agnes-ai.com/agnesapi';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 600000;

function request(method, urlStr, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { const p = JSON.parse(data); resolve(p); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Read the cropped image and encode as base64 data URI
  const croppedPath = path.resolve("C:\\Users\\Administrator\\Pictures\\assistant-media (1)_64.jpg");
  if (!fs.existsSync(croppedPath)) {
    // Crop it first
    const originalPath = "C:\\Users\\Administrator\\Pictures\\assistant-media (1).png";
    const meta = await sharp(originalPath).metadata();
    const finalW = Math.round(meta.width / 64) * 64;
    const finalH = Math.round(meta.height / 64) * 64;
    console.log(`裁剪: ${meta.width}x${meta.height} -> ${finalW}x${finalH}`);
    await sharp(originalPath).resize(finalW, finalH, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toFile(croppedPath);
  }

  const imageData = fs.readFileSync(croppedPath);
  const base64 = imageData.toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;
  
  console.log(`📁 图片已读取: ${(imageData.length/1024).toFixed(0)}KB`);
  console.log(`📤 data URI 长度: ${dataUri.length} 字符`);

  // Submit video task with data URI
  console.log('\n📤 提交视频任务 (data URI)...');
  const prompt = "一只可爱的橘白相间的小花猫，坐在草地上，侧着头看向镜头，表情好奇又温柔，阳光温暖的午后，背景是模糊的绿色植物和花朵，微风轻抚，毛发微微飘动，高清摄影，浅景深";
  
  const createBody = {
    model: 'agnes-video-v2.0',
    prompt,
    image: dataUri,
    num_frames: 121,
    frame_rate: 24,
  };

  const createResult = await request('POST', CREATE_ENDPOINT, createBody);
  
  if (createResult.error) {
    console.error(`❌ 提交失败:`, JSON.stringify(createResult.error || createResult, null, 2));
    
    // If data URI doesn't work, try the temp.sh URL approach
    console.log('\n🔄 尝试 temp.sh URL...');
    createBody.image = 'https://temp.sh/cqzqE/assistant-media_1_64.jpg';
    const retry = await request('POST', CREATE_ENDPOINT, createBody);
    console.log('Retry result:', JSON.stringify(retry, null, 2));
    
    process.exit(1);
  }

  console.log('✅ 提交成功:', JSON.stringify(createResult, null, 2));
}

main();
