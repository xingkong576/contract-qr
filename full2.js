const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const AUTH_FILE = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';
const LF = 'C:/Users/Administrator/.openclaw/workspace/full2_log.txt';
const log = m => { console.log(m); fs.appendFileSync(LF, new Date().toLocaleTimeString() + ' ' + m + '\n'); };

(async function() {
  fs.writeFileSync(LF, '');
  log('=== FULL2 ===');
  
  var browser = await chromium.launch({ headless: false });
  var ctx, p;
  
  // Try auth
  if (fs.existsSync(AUTH_FILE)) {
    ctx = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1280, height: 800 } });
    p = await ctx.newPage();
    await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', { waitUntil: 'load', timeout: 30000 }); await sl(5000);
    if (p.url().indexOf('nosession') < 0) { log('Auth OK!'); }
    else { log('Auth expired'); await ctx.close(); ctx = null; }
  }
  
  if (!ctx) {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    p = await ctx.newPage();
    await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
    var lf = null;
    for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
    await lf.waitForSelector('input', { timeout: 15000 });
    var ins = await lf.locator('input').all();
    await ins[0].fill(U); await ins[1].fill(P);
    await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_full.png' }); log('W');
    fs.writeFileSync(CF, ''); var code = '';
    while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
    log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
    await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
    var li = false;
    for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
    if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
    log('In');
    await ctx.storageState({ path: AUTH_FILE }); log('Auth saved');
  }
  
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
  
  // Get ALL scripts
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
  
  log('\n=== SCRIPTS ===');
  scripts.forEach(function(s, i) {
    log('--- SCRIPT [' + i + '] src=' + s.src + ' len=' + s.text.length + ' ---');
    log(s.text);
    log('--- END ---');
  });
  
  // Also try to get businesslog.js content
  try {
    var blScripts = await pf.evaluate(function() {
      var out = [];
      var ss = document.querySelectorAll('script[src]');
      for (var s of ss) {
        var src = s.getAttribute('src') || '';
        if (src.indexOf('business') >= 0 || src.indexOf('chplayer') >= 0) out.push(src);
      }
      return out;
    });
    log('\nExternal scripts: ' + JSON.stringify(blScripts));
  } catch(e) {}
  
  await ctx.storageState({ path: AUTH_FILE });
  await browser.close();
})();
