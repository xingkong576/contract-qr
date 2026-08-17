const fs = require('fs');
const https = require('https');

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const IMAGE_URL = 'https://i.ibb.co/TxH5YnJF/assistant-media.png';

console.log('🎬 Submitting video generation task...');
console.log('Image URL:', IMAGE_URL);

const body = JSON.stringify({
  model: 'agnes-video-v2.0',
  prompt: '一只可爱的黑猫，绿色的眼睛看着镜头，缓慢眨眼，耳朵偶尔抖动，尾巴轻轻摇摆，温馨舒适的氛围，电影级灯光，缓慢平静的动作',
  image: IMAGE_URL,
  num_frames: 121,
  frame_rate: 24
});

const req = https.request({
  hostname: 'apihub.agnes-ai.com',
  path: '/v1/videos',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + API_KEY,
  },
  timeout: 30000,
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== RESPONSE ===');
    console.log(data);
    console.log('=== END ===');
    
    try {
      const j = JSON.parse(data);
      if (j.id) {
        const taskId = j.id;
        console.log('✅ Task submitted! Task ID:', taskId);
        
        let retries = 0;
        function poll() {
          https.request({
            hostname: 'apihub.agnes-ai.com',
            path: '/v1/videos/' + taskId,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + API_KEY },
            timeout: 15000,
          }, (res2) => {
            let d = '';
            res2.on('data', chunk => d += chunk);
            res2.on('end', () => {
              try {
                const j2 = JSON.parse(d);
                console.log('Status:', j2.status, 'Progress:', j2.progress || 0);
                
                if (j2.status === 'completed' && j2.data && j2.data.url) {
                  console.log('\n🎉 Video ready!');
                  console.log('URL:', j2.data.url);
                  
                  const file = fs.createWriteStream('black_cat_video.mp4');
                  https.get(j2.data.url, (res3) => {
                    res3.pipe(file);
                    file.on('finish', () => {
                      file.close();
                      const stats = fs.statSync('black_cat_video.mp4');
                      console.log('✅ Saved: black_cat_video.mp4 (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB)');
                    });
                  }).on('error', e => console.error('Download error:', e.message));
                  
                } else if (j2.status === 'failed') {
                  console.log('\n❌ Failed:', JSON.stringify(j2.error || j2));
                } else {
                  retries++;
                  if (retries >= 120) {
                    console.log('\n⏰ Timeout');
                  } else {
                    setTimeout(poll, 10000);
                  }
                }
              } catch (e) {
                console.error('Parse error:', e.message);
              }
            });
          }).on('error', err => console.error('Poll error:', err.message)).end();
        }
        
        setTimeout(poll, 5000);
      } else {
        console.log('❌ Error:', JSON.stringify(j));
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
});
req.on('error', err => console.error('Error:', err.message));
req.write(body);
req.end();
