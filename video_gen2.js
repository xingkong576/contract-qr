#!/usr/bin/env node
/**
 * Agnès AI 视频生成脚本
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.env.AGNES_API_KEY || 'sk-y3Z…idrI';
const DEFAULT_MODEL = 'agnes-video-v2.0';

async function generateVideo(prompt, imagePath, options = {}) {
  return new Promise((resolve, reject) => {
    const b64data = fs.readFileSync(imagePath, 'base64');
    const imageBase64 = 'data:image/jpeg;base64,' + b64data;

    const body = JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      prompt,
      image: imageBase64,
      num_frames: options.num_frames || 121,
      frame_rate: options.frame_rate || 24,
    });

    const options2 = {
      hostname: 'apihub.agnes-ai.com',
      path: '/v1/videos',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
      },
    };
    const req = https.request(options2, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.id && result.status === 'queued') {
            resolve(result);
          } else if (result.error) {
            reject(new Error(result.error.message || JSON.stringify(result.error)));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error('Parse error: ' + e.message + '\n' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function pollTask(taskId, options = {}) {
  return new Promise((resolve, reject) => {
    const maxRetries = options.maxRetries || 60;
    const intervalMs = options.intervalMs || 10000;
    let retries = 0;

    function poll() {
      const req = https.request({
        hostname: 'apihub.agnes-ai.com',
        path: '/v1/videos/' + taskId,
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + API_KEY },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            console.log('Status: ' + j.status + ' Progress: ' + (j.progress || 0));
            
            if (j.status === 'completed' && j.data && j.data.url) {
              resolve(j.data.url);
            } else if (j.status === 'failed') {
              reject(new Error('Failed: ' + JSON.stringify(j)));
            } else {
              retries++;
              if (retries >= maxRetries) {
                reject(new Error('Timeout'));
              } else {
                setTimeout(poll, intervalMs);
              }
            }
          } catch (e) {
            reject(new Error('Parse error: ' + e.message));
          }
        });
      });
      req.on('error', reject);
      req.end();
    }

    setTimeout(poll, 3000);
  });
}

function downloadVideo(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const prompt = process.argv[2];
  const imagePath = process.argv[3];
  const outputFile = process.argv[4] || 'cat_video_' + Date.now() + '.mp4';

  if (!prompt || !imagePath) {
    console.error('Usage: node video_gen2.js "prompt" "image_path" [output.mp4]');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error('File not found: ' + imagePath);
    process.exit(1);
  }

  console.log('Generating video...');
  console.log('Image: ' + imagePath);

  try {
    const task = await generateVideo(prompt, imagePath);
    const taskId = task.id;
    console.log('Task submitted! Task ID: ' + taskId);
    console.log('Model: ' + task.model);
    console.log('Duration: ' + task.seconds + 's');
    console.log('Resolution: ' + task.size);

    console.log('Waiting for completion...');
    const videoUrl = await pollTask(taskId);
    console.log('Video ready!');
    console.log('URL: ' + videoUrl);

    const savedPath = path.resolve(outputFile);
    console.log('Downloading to: ' + savedPath);
    await downloadVideo(videoUrl, savedPath);
    
    const stats = fs.statSync(savedPath);
    console.log('Saved: ' + savedPath + ' (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB)');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
