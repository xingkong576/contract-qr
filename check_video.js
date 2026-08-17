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
    console.log('=== RESPONSE ===');
    console.log(JSON.stringify(JSON.parse(data), null, 2));
    console.log('=== END ===');
  });
}).on('error', err => console.error('Error:', err.message)).end();
