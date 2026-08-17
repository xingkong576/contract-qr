#!/usr/bin/env node
const https = require('https');

const API_KEY = '***';
const TASK_ID = 'task_YOUR_TASK_ID';

console.log('Checking task status with correct format...');

https.request({
  hostname: 'apihub.agnes-ai.com',
  path: '/v1/videos/' + TASK_ID,
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + API_KEY,
  },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== RESPONSE ===');
    console.log(JSON.stringify(JSON.parse(data), null, 2));
    console.log('=== END ===');
  });
}).on('error', err => console.error('Error:', err.message)).end();
