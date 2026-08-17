const https = require('https');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const TASK_ID = 'task_6sxCUT3DajQHT3Tp2N9HXcvpoSaQdgiZ';

https.request({
  hostname: 'apihub.agnes-ai.com',
  path: '/v1/videos/' + TASK_ID,
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + API_KEY },
  timeout: 15000,
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log(data);
  });
}).on('error', err => console.error('Error:', err.message)).end();
