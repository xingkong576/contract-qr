var f = require('fs');
var c = f.readFileSync('C:/Users/Administrator/.openclaw/workspace/chplayer_v2.min.js', 'utf8');

// Find M module definition - the object with all members
// M has base64, encode, encodeBytes, secondToTime, etc.
// Search for 'base64:function'
var idx = 0;
var found = [];
while ((idx = c.indexOf('base64:', idx)) >= 0) {
  var ctx = c.substring(Math.max(0, idx-100), idx+200);
  if (ctx.indexOf('function') >= 0 || ctx.indexOf('=>') >= 0) {
    found.push({pos: idx, ctx: ctx.substring(0, 300).replace(/\n/g, '\\n')});
  }
  idx++;
}
console.log('Found ' + found.length + ' base64:');
found.forEach(function(f, i) {
  console.log('\n[' + i + '] at ' + f.pos + ': ' + f.ctx);
});
