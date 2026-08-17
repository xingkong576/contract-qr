#!/usr/bin/env node
const https = require('https');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const TASK_ID = 'task_7WPs9KIhAcNwIJJsNOOULafawiU3SE7T';

function poll() {
  const req = https.request({
    hostname: 'apihub.agnes-ai.com',
    path: '/v1/videos/' + TASK_ID,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + API_KEY },
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('=== RESPONSE ===');
      console.log(data);
      console.log('=== END ===');
      
      const j = JSON.parse(data);
      if (j.status === 'completed' && j.data && j.data.url) {
        console.log('\n🎉 Video ready!');
        console.log('URL: ' + j.data.url);
      } else if (j.status === 'failed') {
        console.log('\n❌ Failed');
      } else {
        console.log('Status: ' + j.status + ' Progress: ' + (j.progress || 0));
        setTimeout(poll, 10000);
      }
    });
  });
  req.on('error', err => console.error('Error:', err.message));
  req.end();
}

setTimeout(poll, 3000);
