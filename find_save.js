var f = require('fs');
var c = f.readFileSync('C:/Users/Administrator/.openclaw/workspace/chplayer_v2.min.js', 'utf8');

// Find saveProgress function
var idx = c.indexOf('saveProgress');
var count = 0;
while (idx >= 0 && count < 5) {
  var ctx = c.substring(Math.max(0, idx-100), idx+500).replace(/\n/g, '\\n');
  console.log('saveProgress at ' + idx + ': ' + ctx.substring(0, 600));
  console.log('---');
  idx = c.indexOf('saveProgress', idx + 1);
  count++;
}
