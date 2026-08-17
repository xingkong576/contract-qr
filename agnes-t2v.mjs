#!/usr/bin/env node
import https from 'https';

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const CREATE_ENDPOINT = 'https://apihub.agnes-ai.com/v1/videos';
const QUERY_ENDPOINT = 'https://apihub.agnes-ai.com/agnesapi';

function request(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    };
    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // 纯文本生成视频（不加图片）
  const body = {
    model: 'agnes-video-v2.0',
    prompt: 'A cute black cat sitting on a sunlit carpet indoors, golden eyes looking at camera gently, blinking slowly, ears twitching occasionally, tail swaying gently, warm cozy atmosphere, soft natural indoor lighting, fluffy fur texture, cinematic quality, slow peaceful motion',
    width: 576,
    height: 1024,
    num_frames: 121,
    frame_rate: 24,
  };

  console.log('🎬 提交文生视频任务...');
  console.log('   Model:', body.model);
  console.log('   Prompt:', body.prompt.substring(0, 80) + '...');
  console.log('   尺寸: 576x1024 (9:16 竖屏)\n');

  const result = await request('POST', CREATE_ENDPOINT, body);
  
  if (!result.data.id && !result.data.video_id) {
    console.log('❌ 提交失败:', JSON.stringify(result.data, null, 2));
    process.exit(1);
  }
  
  const taskId = result.data.id || result.data.video_id;
  console.log(`✅ 任务已提交，ID: ${taskId}`);
  console.log(`   完整响应: ${JSON.stringify(result.data, null, 2)}\n`);

  // 轮询结果
  console.log('⏳ 等待生成（最多 5 分钟）...');
  let elapsed = 0;
  while (elapsed < 300000) {
    await sleep(5000);
    elapsed += 5000;
    
    const status = await request('GET', `${QUERY_ENDPOINT}?video_id=${taskId}`);
    const s = status.data.status || status.data.state || 'unknown';
    const p = status.data.progress || 0;
    console.log(`   [${(elapsed/1000).toFixed(0)}s] 状态: ${s} | 进度: ${p}%`);
    
    if (s === 'completed' || s === 'succeeded') {
      console.log(`\n🎉 视频生成完成！`);
      console.log(`   完整响应: ${JSON.stringify(status.data, null, 2)}`);
      return;
    }
    if (s === 'failed' || s === 'error') {
      console.log(`\n❌ 失败: ${JSON.stringify(status.data, null, 2)}`);
      return;
    }
  }
  console.log('\n❌ 超时（5分钟）');
}

main();
