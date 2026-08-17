#!/usr/bin/env node
/**
 * Agnès AI 图片生成脚本
 * 
 * Usage:
 *   node agnes-image.mjs "prompt text" [output-filename]
 *
 * Examples:
 *   node agnes-image.mjs "a serene bamboo forest at dawn" bamboo.png
 *   node agnes-image.mjs "cute cat, watercolor style"
 *
 * Environment:
 *   AGNES_API_KEY - API key (or uses hardcoded key below)
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.AGNES_API_KEY || 'sk-y3ZCtNlpra36023kTcreN2FXC5cOoIxVbs8cqZJSo5QUidrI';
const API_ENDPOINT = 'https://apihub.agnes-ai.com/v1/images/generations';
const DEFAULT_MODEL = 'agnes-image-2.0-flash';

function generateImage(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
    });

    const url = new URL(API_ENDPOINT);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error.message));
          } else if (result.data && result.data.length > 0) {
            resolve(result.data[0]);
          } else {
            reject(new Error('No image data returned'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\n${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error('Usage: node agnes-image.mjs "prompt" [output.png]');
    process.exit(1);
  }

  const outputFile = process.argv[3] || `agnes_${Date.now()}.png`;

  console.log(`🎨 Generating image for: "${prompt}"`);
  console.log(`   Model: ${DEFAULT_MODEL}`);

  try {
    const result = await generateImage(prompt);
    const imageUrl = result.url;

    if (!imageUrl) {
      console.error('❌ No URL in response:', JSON.stringify(result));
      process.exit(1);
    }

    console.log(`   Downloading: ${imageUrl}`);

    // Download the image
    const download = (url, dest) => new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, (res) => {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(dest);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    const savedPath = path.resolve(outputFile);
    await download(imageUrl, savedPath);
    const stats = fs.statSync(savedPath);
    console.log(`✅ Saved: ${savedPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
