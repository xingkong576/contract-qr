import https from 'https';
https.get('https://temp.sh/pyFUD/assistant-media_1_64.jpg', { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    // Find download link
    const hrefs = [...d.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    hrefs.forEach(h => console.log('href:', h));
    // Also look for raw/direct download
    const rawMatch = d.match(/raw.*?href="([^"]+)"/i);
    if (rawMatch) console.log('Raw link:', rawMatch[1]);
    
    // Look for /d/ or /download/ patterns
    console.log('---');
    console.log(d.substring(1000, 2000));
  });
});
