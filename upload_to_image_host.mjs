#!/usr/bin/env node
const fs = await import('fs');
const https = await import('https');
const path = await import('path');

const IMAGE_PATH = 'C:\\Users\\Administrator\\Downloads\\assistant-media.png';

console.log('📤 Uploading image to free image hosting...');

const imageBuffer = fs.readFileSync(IMAGE_PATH);
const imageBase64 = imageBuffer.toString('base64');
const ext = path.extname(IMAGE_PATH);

// Try sm.ms (free image hosting, no API key needed)
const body = JSON.stringify({
  bed: 'smms',
  smfile: {
    content: 'data:image/png;base64,' + imageBase64,
    filename: 'assistant-media' + ext,
    type: 'image/png'
  }
});

console.log('Trying sm.ms...');

const req = https.request({
  hostname: 'sm.ms/api/v2/upload',
  path: '',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30000,
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('sm.ms response:', res.statusCode);
    console.log(data);
    try {
      const j = JSON.parse(data);
      if (j.code === 'success') {
        console.log('✅ Upload successful!');
        console.log('URL:', j.data.url);
        console.log('Delete URL:', j.data.delete);
      } else {
        console.log('sm.ms upload failed, trying other methods...');
        // Try postimages.org
        tryPostImages(imageBase64, ext);
      }
    } catch (e) {
      console.log('Parse error, trying other methods...');
      tryPostImages(imageBase64, ext);
    }
  });
});
req.on('error', (err) => {
  console.log('sm.ms error:', err.message);
  tryPostImages(imageBase64, ext);
});
req.on('timeout', () => {
  req.destroy();
  console.log('sm.ms timeout, trying other methods...');
  tryPostImages(imageBase64, ext);
});
req.write(body);
req.end();

function tryPostImages(imageBase64, ext) {
  console.log('Trying postimages.org...');
  
  // postimages uses multipart form
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  
  let formData = '';
  formData += '--' + boundary + '\r\n';
  formData += 'Content-Disposition: form-data; name="source"; filename="assistant-media' + ext + '"\r\n';
  formData += 'Content-Type: image/png\r\n\r\n';
  formData += Buffer.from(imageBase64, 'base64').toString('binary');
  formData += '\r\n';
  formData += '--' + boundary + '--\r\n';
  
  const formBuffer = Buffer.from(formData, 'binary');
  
  const req2 = https.request({
    hostname: 'postimages.org',
    path: '/cgi-bin/post-image.cgi',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'User-Agent': 'Mozilla/5.0',
      'Content-Length': formBuffer.length,
    },
    timeout: 30000,
  }, (res2) => {
    let data2 = '';
    res2.on('data', chunk => data2 += chunk);
    res2.on('end', () => {
      console.log('postimages response:', res2.statusCode);
      // Look for image URL in response
      const urlMatch = data2.match(/https?:\/\/i\d*\.(postimages|imgbb)\.org\/images\/[^\s"']+/);
      if (urlMatch) {
        console.log('✅ Upload successful!');
        console.log('URL:', urlMatch[0]);
      } else {
        console.log('postimages also failed. Will try alternative approach.');
        console.log('File size:', fs.statSync(IMAGE_PATH).size, 'bytes');
      }
    });
  });
  
  req2.on('error', (err) => {
    console.log('postimages error:', err.message);
    console.log('📁 Image path:', IMAGE_PATH);
    console.log('📁 File size:', fs.statSync(IMAGE_PATH).size, 'bytes');
    console.log('💡 Manual upload needed to a public image hosting service.');
  });
  
  req2.on('timeout', () => {
    req2.destroy();
    console.log('postimages timeout');
  });
  
  req2.write(formBuffer);
  req2.end();
}
