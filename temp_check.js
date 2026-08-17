var all = document.querySelectorAll('*');
var results = [];
for (var i = 0; i < all.length; i++) {
  var t = all[i];
  var txt = t.innerText;
  if (txt && txt.length > 400 && (txt.includes('emoji') || txt.includes('下班') || txt.includes('习惯'))) {
    results.push(t.tagName + '|' + txt.substring(0, 500));
  }
}
results.length > 0 ? results[0] : 'no content found'
