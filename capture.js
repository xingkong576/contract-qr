const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const AUTH_FILE = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';
const LF = 'C:/Users/Administrator/.openclaw/workspace/cap_log.txt';
const log = m => { console.log(m); fs.appendFileSync(LF, new Date().toLocaleTimeString() + ' ' + m + '\n'); };

(async function() {
  fs.writeFileSync(LF, '');
  log('=== CAP ===');
  
  var browser = await chromium.launch({ headless: false });
  var ctx, p;
  
  // Try saved auth first
  if (fs.existsSync(AUTH_FILE)) {
    log('Loading saved auth...');
    ctx = await browser.newContext({ storageState: AUTH_FILE, viewport: { width: 1280, height: 800 } });
    p = await ctx.newPage();
    await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', { waitUntil: 'load', timeout: 30000 });
    await sl(5000);
    var url = p.url();
    log('URL: ' + url.substring(0, 100));
    if (url.indexOf('nosession') >= 0 || url.indexOf('login') >= 0) {
      log('Auth expired');
      ctx.close();
      ctx = null;
    } else {
      log('Auth works!');
    }
  }
  
  // If auth didn't work, login fresh
  if (!ctx) {
    log('Fresh login needed');
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    p = await ctx.newPage();
    
    await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
    var lf = null;
    for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
    await lf.waitForSelector('input', { timeout: 15000 });
    var ins = await lf.locator('input').all();
    await ins[0].fill(U); await ins[1].fill(P);
    await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_cap.png' });
    log('W'); fs.writeFileSync(CF, '');
    var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
    log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
    await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
    var li = false;
    for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
    if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
    log('In');
    
    // Save auth
    await ctx.storageState({ path: AUTH_FILE });
    log('Auth saved!');
  }
  
  // Navigate to course 2 (企业数字化转型)
  await p.evaluate(function() { 
    var app = document.querySelector('#app'); 
    if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154',courseId:'a5b20c83fded44cb96c3e31ec409f8a0'}}); 
  });
  await sl(5000);
  log('Course details loaded');
  
  // Click first uncompleted chapter
  var pp = new Promise(function(r) { p.once('popup', function(pup) { r(pup); }); });
  await p.evaluate(function() {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) { btns[i].click(); return; }
    }
  });
  var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
  if (!popup) { log('No popup - URL: ' + p.url().substring(0, 100)); await browser.close(); return; }
  log('Popup opened: ' + popup.url().substring(0, 100));
  try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
  await sl(5000);
  
  // Set up capture on popup
  var apiDetails = [];
  await popup.route('**/*', function(route) {
    try {
      var req = route.request();
      var u = req.url();
      if (u.indexOf('takeRecord') >= 0) {
        var info = {
          url: u.substring(0, 120),
          method: req.method(),
          ct: req.headers()['content-type'] || '',
          pd: req.postData() || ''
        };
        apiDetails.push(info);
        log('API#' + apiDetails.length + ' CT=' + info.ct + ' PD=' + info.pd.substring(0, 200));
      }
    } catch(e) {}
    route.continue().catch(function(){});
  });
  
  // Find PF
  var pf = null;
  for (var w = 0; w < 15; w++) {
    for (var f of popup.frames()) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  
  if (!pf) { log('NO PF'); await browser.close(); return; }
  log('PF found');
  
  // Get all scripts from iframe
  var scripts = await pf.evaluate(function() {
    var out = [];
    var ss = document.querySelectorAll('script');
    for (var s of ss) {
      var src = s.getAttribute('src') || '';
      var txt = s.textContent || s.innerText;
      if (txt.length > 0) {
        out.push({ src: src, text: txt.length > 5000 ? txt.substring(0, 5000) : txt });
      }
    }
    return out;
  });
  
  log('\n=== SCRIPTS (' + scripts.length + ') ===');
  scripts.forEach(function(s, i) {
    log('--- Script #' + i + ' src=' + s.src + ' len=' + s.text.length + ' ---');
    if (s.text.length > 2000) {
      log(s.text.substring(0, 2000));
      log('...(more ' + (s.text.length - 2000) + ' chars)');
    } else {
      log(s.text);
    }
  });
  
  // Click play and wait for API
  await pf.evaluate(function() { var v = document.querySelector('video'); if(v) v.play(); });
  log('Played, waiting 90s...');
  
  for (var i = 0; i < 6; i++) {
    await sl(15000);
    log('Check ' + (i+1) + ': ' + apiDetails.length + ' API calls');
    if (apiDetails.length >= 2) break; // got enough data
  }
  
  log('\n=== API SUMMARY ===');
  apiDetails.forEach(function(d, i) {
    log('#' + (i+1) + ' ' + d.method + ' ' + d.url);
    log('  CT: ' + d.ct);
    log('  PD: ' + d.pd);
  });
  
  await ctx.storageState({ path: AUTH_FILE });
  await browser.close();
})();
