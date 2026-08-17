const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const IMAGE_PATH = 'C:\\Users\\Administrator\\Downloads\\assistant-media.png';
console.log('📤 Uploading image... File size:', fs.statSync(IMAGE_PATH).size, 'bytes');

const imageBuffer = fs.readFileSync(IMAGE_PATH);
const imageBase64 = imageBuffer.toString('base64');

// Try imgbb.com (free, no API key required for basic upload)
function tryImgBB() {
  console.log('Trying imgbb.com...');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  
  let formData = '--' + boundary + '\r\n';
  formData += 'Content-Disposition: form-data; name="key";\r\n\r\n';
  // imgbb public upload key (anonymous)
  formData += '\r\n--' + boundary + '\r\n';
  formData += 'Content-Disposition: form-data; name="source"; filename="assistant-media.png"\r\n';
  formData += 'Content-Type: image/png\r\n\r\n';
  const headerBytes = Buffer.from(formData, 'utf8');
  const footer = '\r\n--' + boundary + '--\r\n';
  const footerBytes = Buffer.from(footer);
  const totalLen = headerBytes.length + imageBuffer.length + footerBytes.length;
  
  const formBuffer = Buffer.alloc(totalLen);
  headerBytes.copy(formBuffer);
  imageBuffer.copy(formBuffer, headerBytes.length);
  footerBytes.copy(formBuffer, headerBytes.length + imageBuffer.length);
  
  const postData = formBuffer;
  
  const req = https.request({
    hostname: 'imgbb.com',
    path: '/api/1.0/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'User-Agent': 'Mozilla/5.0',
      'Content-Length': totalLen,
    },
    timeout: 30000,
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('imgbb response:', res.statusCode);
      try {
        const j = JSON.parse(data);
        if (j.success) {
          console.log('\n✅ Upload successful!');
          console.log('URL:', j.data.image.url);
          console.log('Delete URL:', j.data.image.delete_url);
          fs.writeFileSync('uploaded_url.txt', j.data.image.url);
        } else {
          console.log('imgbb upload failed:', JSON.stringify(j));
          trySmms();
        }
      } catch (e) {
        console.log('Parse error:', data.substring(0, 300));
        trySmms();
      }
    });
  });
  
  req.on('error', (err) => {
    console.log('imgbb error:', err.message);
    trySmms();
  });
  
  req.write(postData);
  req.end();
}

function trySmms() {
  console.log('Trying sm.ms/v2...');
  
  const body = JSON.stringify({
    bed: 'smms',
    smfile: 'data:image/png;base64,' + imageBase64
  });
  
  const req = https.request({
    hostname: 'sm.ms/api/v2/upload',
    path: '',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    timeout: 30000,
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('sm.ms response:', res.statusCode, data.substring(0, 500));
      try {
        const j = JSON.parse(data);
        if (j.code === 'success' || j.code === 'image_uploaded') {
          console.log('\n✅ sm.ms upload successful!');
          console.log('URL:', j.data.url);
          fs.writeFileSync('uploaded_url.txt', j.data.url);
        } else if (j.message) {
          console.log('sm.ms message:', j.message);
          tryCatBox();
        }
      } catch (e) {
        console.log('Parse error');
        tryCatBox();
      }
    });
  });
  
  req.on('error', (err) => {
    console.log('sm.ms error:', err.message);
    tryCatBox();
  });
  
  req.write(body);
  req.end();
}

function tryCatBox() {
  console.log('Trying catbox.host...');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let formData = '--' + boundary + '\r\n';
  formData += 'Content-Disposition: form-data; name="reqtype"\r\n\r\n';
  formData += 'fileupload\r\n--' + boundary + '\r\n';
  formData += 'Content-Disposition: form-data; name="userfile"; filename="assistant-media.png"\r\n';
  formData += 'Content-Type: image/png\r\n\r\n';
  const headerBytes = Buffer.from(formData, 'utf8');
  const footer = '\r\n--' + boundary + '--\r\n';
  const footerBytes = Buffer.from(footer);
  const totalLen = headerBytes.length + imageBuffer.length + footerBytes.length;
  
  const formBuffer = Buffer.alloc(totalLen);
  headerBytes.copy(formBuffer);
  imageBuffer.copy(formBuffer, headerBytes.length);
  footerBytes.copy(formBuffer, headerBytes.length + imageBuffer.length);
  
  const req = https.request({
    hostname: 'catboxhost.com',
    path: '/upload.php',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'User-Agent': 'Mozilla/5.0',
      'Content-Length': totalLen,
    },
    timeout: 30000,
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('catbox response:', res.statusCode);
      const urlMatch = data.match(/https?:\/\/[^"'\s]+\.catboxhost\.com\/[^"'\s]+/);
      if (urlMatch) {
        console.log('\n✅ catbox upload successful!');
        console.log('URL:', urlMatch[0]);
        fs.writeFileSync('uploaded_url.txt', urlMatch[0]);
      } else {
        console.log('catbox failed. Response:', data.substring(0, 300));
        console.log('\n📁 Image path:', IMAGE_PATH);
        console.log('💡 You can manually get a public URL from: https://imgbb.com or https://sm.ms');
      }
    });
  });
  
  req.on('error', (err) => {
    console.log('catbox error:', err.message);
    console.log('\n📁 Image path:', IMAGE_PATH);
    console.log('💡 You can manually get a public URL from: https://imgbb.com or https://sm.ms');
  });
  
  req.write(formBuffer);
  req.end();
}

tryImgBB();
