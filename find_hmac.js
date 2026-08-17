var f = require('fs');
var c = f.readFileSync('C:/Users/Administrator/.openclaw/workspace/chplayer_v2.min.js', 'utf8');

// Find the HMAC importKey calls - these are the signing code
var idx = c.indexOf('.importKey("raw"');
if (idx < 0) idx = c.indexOf(".importKey('raw'");
if (idx < 0) idx = c.indexOf(".importKey(`raw`");
if (idx < 0) idx = c.indexOf('importKey("raw"');
if (idx < 0) idx = c.indexOf("importKey('raw'");
console.log('First importKey at: ' + idx);
if (idx >= 0) {
  // Get 1000 chars before and 3000 chars after
  var start = Math.max(0, idx - 500);
  var end = Math.min(c.length, idx + 3000);
  console.log(c.substring(start, end));
}
