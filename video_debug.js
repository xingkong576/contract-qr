#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';

// Step 1: Submit task
const b64data = fs.readFileSync('C:\\Users\\Administrator\\.openclaw\\workspace\\memory\\black_cat.jpg', 'base64');
const imageBase64 = 'data:image/jpeg;base64,' + b64data;

const body = JSON.stringify({
  model: 'agnes-video-v2.0',
  prompt: 'A cute black cat with bright green eyes sitting on a soft bed, slowly blinking and looking at the camera with curiosity, gentle tail swaying, warm cozy sunlight atmosphere, cinematic lighting, slow peaceful movement',
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
  });
});
req.on('error', err => console.error('Error:', err.message));
req.write(body);
req.end();
