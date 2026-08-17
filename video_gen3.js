#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const API_KEY = 'sk-y3ZtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';

async function generateVideo(prompt, imagePath) {
  return new Promise((resolve, reject) => {
    const b64data = fs.readFileSync(imagePath, 'base64');
    const imageBase64 = 'data:image/jpeg;base64,' + b64data;

    const body = JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt: prompt,
      image: imageBase64,
      num_frames: 121,
      frame_rate: 24,
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
            reject(new Error(JSON.stringify(result.error)));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function pollTask(taskId) {
  return new Promise((resolve, reject) => {
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
              setTimeout(poll, 10000);
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

async function main() {
  const prompt = process.argv[2];
  const imagePath = process.argv[3];

  console.log('Generating video...');
  console.log('Image: ' + imagePath);

  try {
    const task = await generateVideo(prompt, imagePath);
    console.log('Task ID: ' + task.id);
    console.log('Duration: ' + task.seconds + 's');

    console.log('Waiting...');
    const videoUrl = await pollTask(task.id);
    console.log('URL: ' + videoUrl);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
