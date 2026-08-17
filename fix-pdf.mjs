const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = 'C:\\Users\\Administrator\\.openclaw\\workspace\\tmp';
const outputDir = 'C:\\Users\\Administrator\\.openclaw\\workspace\\tmp\\fixed';

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir).filter(f => f.match(/page_\d{2}\.png$/)).sort();
console.log(`Found ${files.length} pages`);

async function process() {
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    
    console.log(`Processing ${file}...`);
    
    await sharp(inputPath)
      .modulate({
        brightness: 1.15,   // +15% brightness
        saturation: 1.1     // slight saturation boost for clarity
      })
      .normalize()         // auto levels for contrast
      .sharpen({ sigma: 1.0, edge: true, m1: 1.5, m2: 1 }) // sharpen
      .toFile(outputPath);
      
    console.log(`  Done: ${file}`);
  }
  console.log('All pages processed!');
  console.log('Output:', outputDir);
}

process();
