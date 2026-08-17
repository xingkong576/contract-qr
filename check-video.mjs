#!/usr/bin/env node
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const API_KEY = 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const QUERY_ENDPOINT = 'https://apihub.agnes-ai.com/agnesapi';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 300000;
const VIDEO_ID = 'video_bGl0ZWxsbTpjdXN0b21fbGxtX3Byb3ZpZGVyOm9wZW5haTttb2RlbF9pZDphZ25lcy12aWRlby12Mi4wO3ZpZGVvX2lkOnZpZGVvXzY4OGMwNjY1NjY0YTBjYTAyNjRkYTFlOTA4MjI1YTFlMTYyMmM5MGI5NTFiMGY2ZQ==';

function request(method, urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔍 查询视频生成结果...\n');
  const startTime = Date.now();
  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    const result = await request('GET', `${QUERY_ENDPOINT}?video_id=${VIDEO_ID}`);
    const status = result.status || result.state || 'unknown';
    const progress = result.progress || 0;
    console.log(`[${new Date().toLocaleTimeString('zh-CN')}] Status: ${status} | Progress: ${progress}%`);
    
    if (status === 'succeeded' || status === 'completed' || status === 'done') {
      const videoUrl = result.video || result.video_url || result.result?.video || result.remixed_from_video_id;
      console.log('\n✅ 视频生成完成！');
      console.log(`   视频 URL: ${videoUrl}`);
      console.log(`   完整响应: ${JSON.stringify(result, null, 2)}`);
      return;
    }
    if (status === 'failed' || status === 'error') {
      console.error('\n❌ 视频生成失败:', result.error?.message || JSON.stringify(result));
      return;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error('\n❌ 超时退出');
}

main();
