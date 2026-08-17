const http = require('http');

const TOKEN = 'b2d7fc74be8bfe63323f2d5fab1f49c03755283c86bf923e';
const BASE = 'http://127.0.0.1:18791';

function apiRequest(method, path, body = null, profile = 'user') {
  return new Promise((resolve, reject) => {
    const queryString = profile ? `?profile=${profile}` : '';
    const options = {
      hostname: '127.0.0.1',
      port: 18791,
      path: path + queryString,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
          resolve(json);
        } catch (e) {
          console.log('Response (raw):', data.substring(0, 500));
          resolve(data);
        }
      });
    });
    
    req.on('error', e => {
      console.error('Error:', e.message);
      reject(e);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('=== Testing Browser Control API ===\n');
  
  // 1. Get status
  console.log('1. Getting browser status...');
  await apiRequest('GET', '/');
  console.log();
  
  // 2. Navigate to Doubao
  console.log('2. Navigating to Doubao...');
  await apiRequest('POST', '/navigate', { url: 'https://www.doubao.com' });
  console.log();
  
  // 3. Wait a bit then snapshot
  console.log('3. Waiting 3 seconds...');
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('4. Taking snapshot...');
  await apiRequest('POST', '/snapshot', {});
}

main().catch(console.error);
