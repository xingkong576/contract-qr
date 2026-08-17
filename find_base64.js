var f = require('fs');
var c = f.readFileSync('C:/Users/Administrator/.openclaw/workspace/chplayer_v2.min.js', 'utf8');

// Find M.base64 implementation
var idx = c.indexOf('M.base64');
console.log('M.base64 at: ' + idx);
if (idx >= 0) {
  var start = Math.max(0, idx - 2000);
  var end = Math.min(c.length, idx + 3000);
  console.log(c.substring(start, end));
}

// Also find M.encode function
var encIdx = c.indexOf('encode:function(e){if(!e)return""');
console.log('\n\nM.encode at: ' + encIdx);
if (encIdx >= 0) {
  var s2 = Math.max(0, encIdx - 500);
  console.log(c.substring(s2, encIdx + 100));
}
