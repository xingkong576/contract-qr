#!/usr/bin/env node
const https = require('https');

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
      console.log('=== FULL RESPONSE ===');
      console.log(JSON.stringify(j, null, 2));
      console.log('=== END ===');
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', err => console.error('Error:', err.message)).end();
