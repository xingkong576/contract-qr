#!/usr/bin/env node
import https from 'https';
import http from 'http';

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const CREATE_ENDPOINT = 'https://apihub.agnes-ai.com/v1/videos';
const QUERY_ENDPOINT = 'https://apihub.agnes-ai.com/agnesapi';

function request(method, urlStr, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    };
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) { req.write(typeof body === 'string' ? body : JSON.stringify(body)); }
    req.end();
  });
}

async function main() {
  // Submit task
  const body = {
    model: 'agnes-video-v2.0',
    prompt: 'A cute black cat sitting on a sunlit carpet, golden eyes gazing gently at the camera, blinking slowly, ears twitching occasionally, tail swaying gently, warm cozy atmosphere, cinematic lighting, slow natural motion, detailed fur texture',
    image: 'https://temp.sh/vhGEA/living_room_cat_resized.jpg',
    num_frames: 121,
    frame_rate: 24,
  };
  
  console.log('📤 Submitting video task...');
  console.log('   Image:', body.image);
  console.log('   Prompt:', body.prompt.substring(0, 80) + '...');
  
  const createResult = await request('POST', CREATE_ENDPOINT, body);
  console.log('   Response:', JSON.stringify(createResult, null, 2));
}

main();
