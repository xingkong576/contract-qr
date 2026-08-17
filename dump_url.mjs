import https from 'https';
import fs from 'fs';
const url = process.argv[2] || 'https://temp.sh/pyFUD/assistant-media_1_64.jpg';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('CT:', res.headers['content-type']);
    console.log('Loc:', res.headers['location']);
    console.log('Full HTML:');
    console.log(d);
  });
});
