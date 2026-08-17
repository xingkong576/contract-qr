#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const TASK_ID = 'task_RYIbeHRnPc2klkDfBDpFrLhmdlPHx9gR';

console.log('Checking task status...');

https.request({
  hostname: 'apihub.agnes-ai.com',
  path: '/v1/videos/' + TASK_ID,
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
        console.log('\n🎉 Video ready!');
        console.log('URL: ' + j.data.url);
        
        const file = fs.createWriteStream('black_cat_video.mp4');
        https.get(j.data.url, (res2) => {
          res2.pipe(file);
          file.on('finish', () => {
            file.close();
            const stats = fs.statSync('black_cat_video.mp4');
            console.log('✅ Saved: black_cat_video.mp4 (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB)');
          });
        }).on('error', e => console.error('Download error:', e.message));
        
      } else if (j.status === 'failed') {
        console.log('\n❌ Failed:', JSON.stringify(j.error || j));
      } else {
        console.log('Still processing... Status: ' + j.status);
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', err => console.error('Error:', err.message)).end();
