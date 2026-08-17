/**
 * Upload to temp.sh and get direct download URL
 * temp.sh returns an HTML page with a POST download button.
 * We need to find the actual file download mechanism.
 */
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';

const localPath = process.argv[2];
if (!localPath) { console.error('Usage: node upload-direct.mjs <file>'); process.exit(1); }

async function tryDirectDownload(url) {
  // Try various URL patterns to get direct download
  const patterns = [];
  
  // Pattern 1: add ?download to URL
  patterns.push(url + '?download');
  
  // Pattern 2: /d/ prefix  (like /d/pyFUD/file.jpg)
  const match = url.match(/temp\.sh\/([^/]+)\/(.+)/);
  if (match) {
    patterns.push(`https://temp.sh/d/${match[1]}/${match[2]}`);
    patterns.push(`https://temp.sh/raw/${match[1]}/${match[2]}`);
    patterns.push(`https://temp.sh/dl/${match[1]}/${match[2]}`);
  }

  for (const testUrl of patterns) {
    await new Promise((resolve) => {
      const urlObj = new URL(testUrl);
      const mod = urlObj.protocol === 'https:' ? https : http;
      mod.get(testUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          const ct = res.headers['content-type'] || '';
          console.log(`${testUrl}: status=${res.statusCode} ct=${ct} size=${data.length}`);
          if (ct.startsWith('image/')) {
            console.log(`✅ DIRECT URL FOUND: ${testUrl}`);
            process.exit(0);
          }
          resolve();
        });
      }).on('error', () => resolve());
    });
  }

  // If none worked, try POST method to the original URL
  await new Promise((resolve) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Length': '0' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const ct = res.headers['content-type'] || '';
        console.log(`POST ${url}: status=${res.statusCode} ct=${ct} size=${data.length}`);
        if (ct.startsWith('image/')) {
          console.log(`✅ POST URL WORKS FOR DIRECT DOWNLOAD`);
        }
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.end();
  });
  
  console.log('❌ No direct download URL found for temp.sh');
  console.log('Try using a different upload service');
}

// First upload
console.log('📤 Uploading...');
const result = execSync(`curl.exe -s -F "file=@${localPath}" https://temp.sh/upload`, {
  encoding: 'utf8', timeout: 30000
}).trim();
console.log(`📍 Uploaded: ${result}`);

// Then try direct download
tryDirectDownload(result);
