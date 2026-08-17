#!/usr/bin/env node
/**
 * 用 sharp 裁剪/缩放图片为 64 的倍数尺寸
 * Usage: node smart-crop-64.mjs <input.jpg/png> [output.jpg] [max_width] [max_height]
 * 
 * 策略：保持中心区域，等比缩小到 64 的倍数，不拉伸变形
 */

import sharp from 'sharp';
import path from 'path';

const input = process.argv[2];
const output = process.argv[3] || path.join(path.dirname(input), path.parse(input).name + '_64.jpg');
const maxW = parseInt(process.argv[4]) || 1664;  // 默认 1664 (64*26)
const maxH = parseInt(process.argv[5]) || 2176;  // 默认 2176 (64*34)

if (!input) {
  console.error('Usage: node smart-crop-64.mjs <input-image> [output-image] [max_width] [max_height]');
  process.exit(1);
}

const stats = await sharp(input).metadata();
const origW = stats.width;
const origH = stats.height;
console.log(`原始: ${origW}x${origH}`);

// 计算缩放比例，让图片适配到 maxW x maxH 范围内
const scale = Math.min(maxW / origW, maxH / origH, 1.0);
const targetW = Math.round(origW * scale);
const targetH = Math.round(origH * scale);

// 对齐到 64 的倍数
const fitW = Math.round(targetW / 64) * 64;
const fitH = Math.round(targetH / 64) * 64;

// 确保至少 64x64
const finalW = Math.max(fitW, 64);
const finalH = Math.max(fitH, 64);

console.log(`缩放: ${targetW}x${targetH}`);
console.log(`对齐: ${finalW}x${finalH}`);

// 中心裁剪
const left = Math.round((fitW - finalW) / 2);
const top = Math.round((fitH - finalH) / 2);

await sharp(input)
  .resize({
    width: fitW,
    height: fitH,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .extract({
    left: Math.max(0, left),
    top: Math.max(0, top),
    width: finalW,
    height: finalH
  })
  .jpeg({ quality: 92 })
  .toFile(output);

const outStats = await sharp(output).metadata();
console.log(`\n✅ 完成: ${output}`);
console.log(`尺寸: ${outStats.width}x${outStats.height}`);

// 验证 64 倍数
console.log(`${finalW}÷64=${finalW/64} ✅`);
console.log(`${finalH}÷64=${finalH/64} ✅`);
