#!/usr/bin/env node
import https from 'https';
import fs from 'fs';

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const IMAGE_PATH = 'C:\\Users\\Administrator\\.openclaw\\workspace\\living_room_cat_resized.jpg';

// 直接用 Agnès 的方式：图片上传用 imgbb
const IMGBB_KEY = '2d5a27d109611c75d79b2216929d4e53'; // 之前测试有效的 key

async function uploadToImgbb() {
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  
  const formData = Buffer.concat([
    Buffer.from('image='),
    Buffer.from(imageBuffer.toString('base64'))
  ]);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.imgbb.com',
      path: `/1/upload?key=${IMGBB_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': formData.length
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            console.log('✅ 上传成功!');
            console.log('URL:', parsed.data.url);
            console.log('Direct URL:', parsed.data.direct_url);
            resolve(parsed.data.direct_url);
          } else {
            console.log('❌ 上传失败:', JSON.stringify(parsed, null, 2));
            reject(new Error('Upload failed'));
          }
        } catch {
          console.log('❌ 解析失败:', data.substring(0, 500));
          reject(new Error('Parse failed'));
        }
      });
    });
    
    req.on('error', e => {
      console.log('❌ 请求错误:', e.message);
      reject(e);
    });
    
    req.write(formData);
    req.end();
  });
}

async function submitVideoTask(imageUrl) {
  const body = JSON.stringify({
    model: 'agnes-video-v2.0',
    prompt: '一只可爱的黑猫，坐在阳光洒进来的地毯上，金色的瞳孔温柔地注视着镜头，微微眨眼，耳朵偶尔抖动，尾巴轻轻摇摆，温暖的室内光线，毛茸茸的质感，宁静温馨的氛围，电影级灯光，缓慢自然的动作，4K画质',
    image: imageUrl,
    num_frames: 121,
    frame_rate: 24,
    height: 768,
    width: 1024,
  });
  
  console.log('\n🎬 提交视频任务...');
  console.log('   图片:', imageUrl);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'apihub.agnes-ai.com',
      path: '/v1/videos',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            console.log('✅ 任务已提交!');
            console.log('   ID:', parsed.id);
            console.log('   Video ID:', parsed.video_id);
            resolve(parsed);
          } else {
            console.log('❌ 提交失败:', JSON.stringify(parsed, null, 2));
            reject(new Error('Submit failed'));
          }
        } catch {
          console.log('❌ 解析失败:', data.substring(0, 500));
          reject(new Error('Parse failed'));
        }
      });
    });
    
    req.on('error', e => {
      console.log('❌ 请求错误:', e.message);
      reject(e);
    });
    
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    const imageUrl = await uploadToImgbb();
    const result = await submitVideoTask(imageUrl);
    console.log('\n🎉 全部完成!');
  } catch (e) {
    console.error('❌ 失败:', e.message);
  }
}

main();
