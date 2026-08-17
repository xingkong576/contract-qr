const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));
const AUTH_FILE = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';
const LF = 'C:/Users/Administrator/.openclaw/workspace/full_log.txt';
const log = m => { console.log(m); fs.appendFileSync(LF, new Date().toLocaleTimeString() + ' ' + m + '\n'); };

(async function() {
  fs.writeFileSync(LF, '');
  log('=== FULL ===');
  
  var browser = await chromium.launch({ headless: false });
  var ctx = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();
  
  // Navigate directly (auth should work if saved correctly)
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', { waitUntil: 'load', timeout: 30000 }); await sl(5000);
  log('URL: ' + p.url().substring(0, 100));
  if (p.url().indexOf('nosession') >= 0) { log('Auth expired, login needed'); await browser.close(); return; }
  
  // Course details
  await p.evaluate(function() { 
    var app = document.querySelector('#app'); 
    if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154',courseId:'a5b20c83fded44cb96c3e31ec409f8a0'}}); 
  });
  await sl(5000);
  
  // Open popup
  var pp = new Promise(function(r) { p.once('popup', function(pup) { r(pup); }); });
  await p.evaluate(function() {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) { btns[i].click(); return; }
    }
  });
  var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
  if (!popup) { log('No popup'); await browser.close(); return; }
  await sl(8000);
  
  // Find PF
  var pf = null;
  for (var w = 0; w < 15; w++) {
    for (var f of popup.frames()) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  if (!pf) { log('NO PF'); await browser.close(); return; }
  
  // Get FULL scripts - no truncation!
  var scripts = await pf.evaluate(function() {
    var out = [];
    var ss = document.querySelectorAll('script');
    for (var s of ss) {
      var src = s.getAttribute('src') || '';
      var txt = s.textContent || s.innerText;
      if (txt.length > 20) out.push({ src: src, text: txt });
    }
    return out;
  });
  
  log('\n=== FULL SCRIPTS ===');
  scripts.forEach(function(s, i) {
    log('[' + i + '] src=' + s.src + ' len=' + s.text.length);
    log('CONTENT:');
    log(s.text);
    log('--- END SCRIPT ' + i + ' ---\n');
  });
  
  await browser.close();
})();
