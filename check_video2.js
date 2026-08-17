const https = require('https');

const API_KEY = '***';
const TASK_ID = 'task_j2TtVBltygQLlMjOjyLdSGncusMukEVo';

https.request({
  hostname: 'apihub.agnes-ai.com',
  path: '/v1/videos/' + TASK_ID,
  method: 'GET',
  headers: { 'Authorization': '***' + API_KEY },
  timeout: 15000,
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log(data);
  });
}).on('error', err => console.error('Error:', err.message)).end();
