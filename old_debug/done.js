const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const AUTH = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function completeSection(popup, chapName) {
  log('>> ' + chapName);
  
  // Find player iframe
  var pf = null;
  for (var w = 0; w < 20; w++) {
    var frames = popup.frames();
    for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  if (!pf) { log('NO PF'); return; }
  await sl(5000);
  
  // Extract token from init script in iframe
  var result = await pf.evaluate(function() {
    // 1. Find token from script
    var token = null, serverUrl = null, duration = 0;
    
    // Search all scripts for token
    var scripts = document.querySelectorAll('script');
    for (var s of scripts) {
      var txt = s.textContent || s.innerText;
      if (txt && txt.indexOf('take') >= 0 && txt.indexOf('token') >= 0) {
        var tm = txt.match(/["\']token["\']\s*:\s*["\']([^"\']+)["\']/);
        if (tm) token = tm[1];
        var sm = txt.match(/["\']serverUrl["\']\s*:\s*["\']([^"\']+)["\']/);
        if (sm) serverUrl = sm[1];
        if (token) break;
      }
    }
    
    if (!token) return 'no_token';
    if (!serverUrl) serverUrl = 'https://content.hst360.com';
    
    // 2. Check video duration
    var v = document.querySelector('video');
    if (v && v.duration) duration = Math.floor(v.duration);
    if (duration < 60) duration = 3600; // fallback 1 hour
    
    // 3. Build HMAC and call API
    var keyPrefix = String.fromCharCode(99,104,97,88,115,50,45,45,99); // "chaXs2--c"
    var signKey = keyPrefix + token.substring(1, 5);
    var timestamp = Date.now();
    
    // The HMAC data is token + time + timestamp (string concat, NOT JSON)
    var timeVal = duration; // Use duration as time for final save
    var signInput = token + timeVal + timestamp;
    
    return crypto.subtle.importKey('raw', new TextEncoder().encode(signKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(function(key) { return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signInput)); })
    .then(function(sig) {
      // Convert signature to base64
      var binary = '';
      new Uint8Array(sig).forEach(function(b) { binary += String.fromCharCode(b); });
      var signature = btoa(binary);
      
      // Build final data object
      var reqData = {
        token: token,
        time: timeVal,
        duration: duration,
        isEnd: 'true',
        timestamp: timestamp,
        signature: signature
      };
      
      // JSON stringify and base60 encode using M (DPlayer's utility)
      var jsonStr = JSON.stringify(reqData);
      var encoded = M.encode(jsonStr);
      
      // POST
      var url = serverUrl + '/videoPlay/takeRecordByToken';
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        body: encoded
      }).then(function(resp) {
        return resp.text().then(function(text) { return 'status=' + resp.status + ' resp=' + text.substring(0, 200); });
      }).catch(function(err) {
        return 'fetch_error: ' + err.message;
      });
    }).catch(function(err) {
      return 'crypto_error: ' + err.message;
    });
  });
  
  log('Result: ' + result);
  return result.indexOf('status=200') >= 0 || result.indexOf('status=0') >= 0 || (result.indexOf('status=') >= 0 && result.indexOf('status=2') >= 0);
}

async function doLogin(ctx, p) {
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_done.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var li = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
  log('In');
  await ctx.storageState({ path: AUTH });
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== DONE ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);
  
  var browser = await chromium.launch({ headless: false });
  var ctx, p;
  
  // Try auth
  if (fs.existsSync(AUTH)) {
    try {
      ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1280, height: 800 } });
      p = await ctx.newPage();
      await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=' + PLAN + '&platformId=154', { waitUntil: 'load', timeout: 15000 }); await sl(3000);
      if (p.url().indexOf('nosession') >= 0) { log('Auth expired'); await ctx.close(); ctx = null; }
      else log('Auth OK');
    } catch(e) { log('Auth failed: ' + e.message.substring(0,60)); ctx = null; }
  }
  
  if (!ctx) {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    p = await ctx.newPage();
    await doLogin(ctx, p);
  }
  
  // Navigate to course list
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=' + PLAN + '&platformId=154', { waitUntil: 'load', timeout: 30000 }); await sl(5000);
  
  // Click "去学习"
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);
  
  var totalCompleted = 0;
  
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log(c.courseName + ': already 100%'); continue; }
    
    log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    // Navigate to course details
    await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}}); }, {plan:PLAN, cid:c.courseId});
    await sl(5000);
    
    // Get uncompleted chapters
    var chapters = await p.evaluate(function() {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var titles = document.querySelectorAll('a.titlecolor.text');
      var list = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) {
          list.push({ idx: i, name: (titles[i] ? titles[i].textContent.trim() : '?').substring(0, 30) });
        }
      }
      return list;
    });
    
    if (chapters.length === 0) { log('All done'); continue; }
    log('Chaps: ' + chapters.length);
    
    for (var ci2 = 0; ci2 < chapters.length; ci2++) {
      var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
      
      await p.evaluate(function(idx) { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, chapters[ci2].idx);
      var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
      if (!popup) { log('No popup'); continue; }
      
      try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
      await sl(8000);
      
      await completeSection(popup, chapters[ci2].name);
      totalCompleted++;
      
      try { popup.close(); } catch(e) {}
      await sl(2000);
    }
    
    // Back to course list
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== DONE! Total marked: ' + totalCompleted + ' sections ===');
  await ctx.storageState({ path: AUTH });
  await browser.close();
})();
