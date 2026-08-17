#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const IMAGE_PATH = 'C:\\Users\\Administrator\\Downloads\\assistant-media.png';

const b64data = fs.readFileSync(IMAGE_PATH, 'base64');
const imageBase64 = 'data:image/png;base64,' + b64data;

const body = JSON.stringify({
  model: 'agnes-video-v2.0',
  prompt: 'A cute black cat with bright green eyes looking at the camera, slowly blinking, ears twitching occasionally, gentle tail swaying, warm cozy atmosphere, cinematic lighting, slow peaceful movement',
  image: imageBase64,
  num_frames: 121,
  frame_rate: 24,
});

const req = https.request({
  hostname: 'apihub.agnes-ai.com',
  path: '/v1/videos',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + API_KEY,
  },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== RESPONSE ===');
    console.log(data);
    console.log('=== END ===');
    
    const j = JSON.parse(data);
    if (j.id) {
      // Poll task
      const taskId = j.id;
      console.log('\nTask ID: ' + taskId);
      
      function poll() {
        https.request({
          hostname: 'apihub.agnes-ai.com',
          path: '/v1/videos/' + taskId,
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + API_KEY },
        }, (res2) => {
          let d = '';
          res2.on('data', chunk => d += chunk);
          res2.on('end', () => {
            const j2 = JSON.parse(d);
            console.log('Status: ' + j2.status + ' Progress: ' + (j2.progress || 0));
            
            if (j2.status === 'completed' && j2.data && j2.data.url) {
              console.log('\n🎉 Video ready!');
              console.log('URL: ' + j2.data.url);
              
              // Download video
              const file = fs.createWriteStream('black_cat_video.mp4');
              https.get(j2.data.url, (res3) => {
                res3.pipe(file);
                file.on('finish', () => {
                  file.close();
                  const stats = fs.statSync('black_cat_video.mp4');
                  console.log('✅ Saved: black_cat_video.mp4 (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB)');
                });
              }).on('error', e => console.error('Download error:', e.message));
              
            } else if (j2.status === 'failed') {
              console.log('\n❌ Failed:', JSON.stringify(j2.error));
            } else {
              setTimeout(poll, 10000);
            }
          });
        }).on('error', err => console.error('Poll error:', err.message)).end();
      }
      
      setTimeout(poll, 3000);
    }
  });
});
req.on('error', err => console.error('Error:', err.message));
req.write(body);
req.end();
