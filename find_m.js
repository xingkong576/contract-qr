var f = require('fs');
var c = f.readFileSync('C:/Users/Administrator/.openclaw/workspace/chplayer_v2.min.js', 'utf8');

// Find M module - look for base60 alphabet
// The M module should contain a charset/table for base60 encoding
var searches = ['"0123456789', "'0123456789", 'charAt', '60', 'encode', 'decode'];
for (var s of searches) {
  var idx = c.indexOf(s);
  var count = 0;
  while (idx >= 0 && count < 10) {
    var start = Math.max(0, idx - 60);
    var end = Math.min(c.length, idx + s.length + 120);
    console.log('[' + s + ' at ' + idx + ']: ' + c.substring(start, end).replace(/\n/g, '\\n'));
    idx = c.indexOf(s, idx + 1);
    count++;
  }
}
