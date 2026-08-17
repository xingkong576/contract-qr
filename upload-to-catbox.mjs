#!/usr/bin/env node
import https from 'https';
import fs from 'fs';

// 上传图片到 catbox.moe（更稳定的图床）
const imagePath = 'C:\\Users\\Administrator\\.openclaw\\workspace\\living_room_cat_resized.jpg';
const imageBuffer = fs.readFileSync(imagePath);

const formData = Buffer.concat([
  Buffer.from("------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n"),
  Buffer.from("Content-Disposition: form-data; name=\"reqtype\"\r\n\r\nfileupload\r\n"),
  Buffer.from("------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n"),
  Buffer.from("Content-Disposition: form-data; name=\"fileToUpload\"; filename=\"cat.jpg\"\r\n"),
  Buffer.from("Content-Type: image/jpeg\r\n\r\n"),
  imageBuffer,
  Buffer.from("\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n")
]);

console.log('📤 上传图片到 catbox.moe...');

const req = https.request({
  hostname: 'catbox.moe',
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    'Content-Length': formData.length,
  },
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Catbox 可能返回 redirect
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Response:', data.substring(0, 500));
    if (res.headers.location) {
      console.log('Redirect to:', res.headers.location);
    }
  });
});

req.on('error', e => console.log('Error:', e.message));
req.write(formData);
req.end();
