#!/usr/bin/env node
const https = require('https');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const TASK_ID = 'task_RYIbeHRnPc2klkDfBDpFrLhmdlPHx9gR';

console.log('Polling video task...');

function poll() {
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
        } else if (j.status === 'failed') {
          console.log('\n❌ Failed:', JSON.stringify(j.error || j));
        } else {
          setTimeout(poll, 10000);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    });
  }).on('error', err => console.error('Poll error:', err.message)).end();
}

// Poll every 10 seconds for 5 minutes
for (let i = 0; i < 30; i++) {
  setTimeout(poll, i * 10000);
}
