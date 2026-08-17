#!/usr/bin/env node
/**
 * Agnès AI 视频生成 - 全自动版
 * 
 * 支持本地图片或 URL
 * 自动裁剪到 64 倍数，自动上传到 litterbox 图床
 * 
 * Usage:
 *   node agnes-video.mjs "本地图片路径" "提示词" [输出文件名.mp4]
 *
 * Examples:
 *   node agnes-video.mjs ".\cat.jpg" "一只可爱的小猫" output.mp4
 *   node agnes-video.mjs "C:\path\to\image.png" "描述视频内容"
 *   node agnes-video.mjs "https://example.com/photo.jpg" "描述内容" output.mp4
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';

const API_KEY = process.env.AGNES_API_KEY || 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const CREATE_ENDPOINT = 'https://apihub.agnes-ai.com/v1/videos';
const QUERY_ENDPOINT = 'https://apihub.agnes-ai.com/agnesapi';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 600000;

// === Tool: HTTP request ===
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

// === Upload via curl.exe and litterbox ===
async function uploadImage(localPath) {
  return new Promise((resolve, reject) => {
    console.log('   📤 上传到图床...');
    try {
      const result = execSync(
        `curl.exe -s --max-time 20 -F "reqtype=fileupload" -F "time=24h" -F "fileToUpload=@${localPath}" https://litterbox.catbox.moe/resources/internals/api.php`,
        { encoding: 'utf8', timeout: 30000 }
      ).trim();
      if (result.startsWith('http')) {
        console.log(`   ✅ ${result}`);
        resolve(result);
      } else {
        reject(new Error('上传返回异常: ' + result));
      }
    } catch (err) {
      reject(new Error(`上传失败: ${err.message}`));
    }
  });
}

// === Crop image to 64-multiple dimensions ===
async function cropTo64Multiple(localPath) {
  const meta = await sharp(localPath).metadata();
  const w = meta.width;
  const h = meta.height;

  if (w % 64 === 0 && h % 64 === 0) {
    console.log(`   ✅ 尺寸已满足 64 倍数: ${w}x${h}`);
    return localPath;
  }

  const finalW = Math.round(w / 64) * 64;
  const finalH = Math.round(h / 64) * 64;

  console.log(`   ✂️ 裁剪: ${w}x${h} → ${finalW}x${finalH} (64 倍数)`);

  const parsed = path.parse(localPath);
  const outPath = path.join(parsed.dir, parsed.name + '_64.jpg');

  await sharp(localPath)
    .resize(finalW, finalH, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 })
    .toFile(outPath);

  console.log(`   ✅ 裁剪完成: ${outPath}`);
  return outPath;
}

// === Download file ===
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

// === Poll video result ===
async function pollVideo(videoId) {
  const startTime = Date.now();
  const queryUrl = `${QUERY_ENDPOINT}?video_id=${videoId}`;
  console.log(`   ⏳ 查询任务: ${videoId}`);
  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    const result = await request('GET', queryUrl);
    if (result.error) {
      console.error(`   ❌ 查询错误: ${result.error.message || JSON.stringify(result.error)}`);
      return null;
    }
    const status = result.status || result.state || (result.video ? 'completed' : 'processing');
    const progress = result.progress || 0;
    console.log(`   ⏳ 状态: ${status} | 进度: ${progress}`);
    if (status === 'succeeded' || status === 'completed' || status === 'done') {
      const videoUrl = result.video || result.video_url || result.output?.video ||
                       (typeof result.data === 'string' ? result.data : null) ||
                       result.result?.video || result.remixed_from_video_id;
      return { videoUrl, result };
    }
    if (status === 'failed' || status === 'error') {
      console.error(`   ❌ 任务失败: ${result.error?.message || JSON.stringify(result)}`);
      return null;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error('   ❌ 超时');
  return null;
}

// === Main ===
async function main() {
  const imageInput = process.argv[2];
  const prompt = process.argv[3];
  const outputFile = process.argv[4];

  if (!imageInput || !prompt) {
    console.error('Usage: node agnes-video.mjs <image-path-or-url> <prompt> [output.mp4]');
    console.error('');
    console.error('Examples:');
    console.error('  node agnes-video.mjs ".\\cat.png" "一只可爱的小花猫在草地上" output.mp4');
    console.error('  node agnes-video.mjs "https://example.com/photo.png" "描述内容"');
    process.exit(1);
  }

  const outPath = outputFile
    ? path.resolve(outputFile)
    : path.resolve(`agnes_video_${Date.now()}.mp4`);

  console.log(`🎬 视频生成`);
  console.log(`   模型: agnes-video-v2.0`);
  console.log('');

  // === Step 0: Resolve image ===
  let imageUrl;

  if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
    imageUrl = imageInput;
    console.log(`   ✅ 使用已有 URL`);
  } else {
    const localPath = path.resolve(imageInput);
    if (!fs.existsSync(localPath)) {
      console.error(`❌ 文件不存在: ${localPath}`);
      process.exit(1);
    }
    const stats = fs.statSync(localPath);
    console.log(`   📁 本地图片: ${localPath} (${(stats.size/1024).toFixed(0)}KB)`);

    const cropped = await cropTo64Multiple(localPath);
    imageUrl = await uploadImage(cropped);
  }

  console.log(`   图片: ${imageUrl}`);
  console.log(`   提示: ${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}`);
  console.log('');

  // === Step 1: Submit video task ===
  console.log('📤 提交视频任务...');
  const createBody = {
    model: 'agnes-video-v2.0',
    prompt,
    image: imageUrl,
    num_frames: 121,
    frame_rate: 24,
  };
  const createResult = await request('POST', CREATE_ENDPOINT, createBody);
  if (createResult.error) {
    console.error(`❌ 提交失败: ${createResult.error.message || JSON.stringify(createResult)}`);
    process.exit(1);
  }
  const videoId = createResult.video_id || createResult.id || createResult.task_id || createResult.taskId;
  if (!videoId) {
    console.error('❌ 无法获取视频任务 ID');
    console.error('   返回:', JSON.stringify(createResult, null, 2));
    process.exit(1);
  }
  console.log(`   ✅ 任务已提交: ${videoId}`);
  console.log('');

  // === Step 2: Wait for result ===
  console.log('⏳ 等待生成...');
  const pollResult = await pollVideo(videoId);
  if (!pollResult || !pollResult.videoUrl) {
    console.error('❌ 视频生成失败');
    process.exit(1);
  }

  // === Step 3: Download ===
  console.log(`\n📥 下载视频...`);
  try {
    await download(pollResult.videoUrl, outPath);
    const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(1);
    console.log(`✅ 视频已保存: ${outPath} (${sizeMB} MB)`);
    console.log(`   视频 URL: ${pollResult.videoUrl}`);
  } catch (err) {
    console.error(`❌ 下载失败: ${err.message}`);
    console.error(`   可用 URL: ${pollResult.videoUrl}`);
  }
}

main();
