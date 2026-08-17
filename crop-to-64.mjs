#!/usr/bin/env node
/**
 * 裁剪图片为 64 的倍数尺寸，保持画面中心区域
 * Usage: node crop-to-64.mjs <input.jpg/png> [output.jpg/png]
 * 
 * 裁剪策略：保持画面中心区域，宽高缩放到最接近的 64 倍数
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const input = process.argv[2];
const output = process.argv[3] || path.join(path.dirname(input), path.parse(input).name + '_64.jpg');

if (!input || !fs.existsSync(input)) {
  console.error(`Usage: node crop-to-64.mjs <input-image> [output-image]`);
  process.exit(1);
}

const origStat = fs.statSync(input);
console.log(`原始图片: ${input}`);
console.log(`大小: ${(origStat.size / 1024).toFixed(0)}KB`);

// 检查是否已安装 ImageMagick
try {
  const version = execSync('magick -version', { encoding: 'utf8' });
  console.log('ImageMagick 已安装 ✅');
} catch {
  console.error('\n❌ 未检测到 ImageMagick (magick 命令)');
  console.error('请安装: winget install ImageMagick.ImageMagick');
  process.exit(1);
}

const orig = fs.readFileSync(input);
const base64 = orig.toString('base64');

// 用 ImageMagick 获取原始尺寸
const identify = execSync(`magick identify -format "%w %h" "${input}"`, { encoding: 'utf8' }).trim();
const [origW, origH] = identify.split(/\s+/).map(Number);
console.log(`尺寸: ${origW}x${origH}`);

// 计算目标尺寸（64 的倍数，保持宽高比，中心裁剪）
const targetW = Math.round(origW / 64) * 64;  // 1664
const targetH = Math.round(origH / 64) * 64;  // 2176

console.log(`目标尺寸: ${targetW}x${targetH}`);

// 执行裁剪：先等比缩放，再中心裁剪到目标尺寸
execSync(`magick "${input}" -resize ${targetW}x${targetH} -gravity Center -crop ${targetW}x${targetH}+0+0 +repage "${output}"`, {
  stdio: 'inherit'
});

const outStat = fs.statSync(output);
console.log(`\n✅ 裁剪完成: ${output}`);
console.log(`大小: ${(outStat.size / 1024).toFixed(0)}KB`);
