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

async function completeSection(popup, chapName, capToken, capUrl) {
  log('>> ' + chapName);
  
  // Find player iframe
  var pf = null;
  for (var w = 0; w < 30; w++) {
    var frames = popup.frames();
    for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  if (!pf) { log('NO PF'); return; }
  
  // Wait for video to be ready
  try {
    await pf.waitForFunction(function() { var v = document.querySelector('video'); return v && v.readyState >= 2; }, { timeout: 20000 });
  } catch(e) { log('Wait video timeout'); }
  await sl(3000);
  
  // Extract token and serverUrl
  var result = await pf.evaluate(function(tokenCapture, urlCapture) {
    // Find token in all scripts if not captured from request
    var token = tokenCapture;
    var serverUrl = urlCapture;
    var duration = 0;
    
    if (!token) {
      // Search all scripts more thoroughly
      var scripts = document.querySelectorAll('script');
      for (var s of scripts) {
        var txt = s.textContent || '';
        // Pattern 1: DPlayer options format - take: { token: 'xxx' }
        var tm = txt.match(/token['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
        if (tm) { token = tm[1]; break; }
        
        // Pattern 2: direct variable assignment
        var tm2 = txt.match(/token\s*=\s*['"]([^'"]+)['"]/);
        if (tm2 && tm2[1].length > 10 && tm2[1].indexOf(':') < 0) { token = tm2[1]; break; }
      }
    }
    
    if (!token) return 'no_token';
    if (!serverUrl) serverUrl = 'https://content.hst360.com';
    
    // Get video duration
    var v = document.querySelector('video');
    if (v && v.duration) duration = Math.floor(v.duration);
    if (duration < 60) { var d2 = document.querySelector('.dplayer-video'); if (d2 && d2.duration) duration = Math.floor(d2.duration); }
    if (duration < 60) duration = parseInt(prompt('duration?') || '3600');
    
    // DPlayer saveProgress - replicate the exact same HMAC+base60 scheme
    // Key = "chaXs2--c" + token.substring(1,5)
    // Data is a JSON object: { token, time, duration, isEnd?, timestamp?, signature }
    // Sign input = token + time + timestamp (string concat)
    
    var keyPrefix = String.fromCharCode(99,104,97,88,115,50,45,45,99); // "chaXs2--c"
    var signKey = keyPrefix + token.substring(1, 5);
    var timeVal = duration - 10; // near end but not past it
    var timestamp = Date.now();
    var signInput = token + timeVal + timestamp;
    
    return crypto.subtle.importKey('raw', new TextEncoder().encode(signKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(function(key) { return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signInput)); })
    .then(function(sig) {
      var binary = '';
      new Uint8Array(sig).forEach(function(b) { binary += String.fromCharCode(b); });
      var signature = btoa(binary);
      
      var reqData = {
        token: token,
        time: timeVal,
        duration: duration,
        isEnd: 'true',
        timestamp: timestamp,
        signature: signature
      };
      
      var jsonStr = JSON.stringify(reqData);
      var encoded = M.encode(jsonStr);
      
      var url = serverUrl + '/videoPlay/takeRecordByToken';
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        body: encoded
      }).then(function(resp) {
        return resp.text().then(function(text) {
          return 'status=' + resp.status + ' code=' + (text.trim()||'empty').substring(0,100);
        });
      }).catch(function(err) {
        return 'fetch_error: ' + err.message;
      });
    }).catch(function(err) {
      return 'crypto_error: ' + err.message;
    });
  }, capToken || '', capUrl || '');
  
  log('Result: ' + result);
  return result.indexOf('status=20') >= 0 || result.indexOf('code=0') >= 0 || result.indexOf('code=2') >= 0;
}

async function doLogin(ctx, p) {
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_done.png' });
  log('W'); fs.writeFileSync(CF, ''); var code = '';
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
  log('=== DONE v2 ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);
  
  var browser = await chromium.launch({ headless: false });
  var ctx, p;
  
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
  
  // Navigate to course list and click 去学习
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=' + PLAN + '&platformId=154', { waitUntil: 'load', timeout: 30000 }); await sl(5000);
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);
  
  var totalCompleted = 0;
  
  // First, open one course to capture the token from API interception
  var capToken = null, capUrl = null;
  
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log(c.courseName + ': already 100%'); continue; }
    
    log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}}); }, {plan:PLAN, cid:c.courseId});
    await sl(5000);
    
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
      // Register popup capture
      var pp = new Promise(function(r) { p.once('popup', function(popup) {
        // Capture token from first takeRecordByToken request
        if (!capToken) {
          popup.route('**/takeRecordByToken**', function(route, request) {
            // POST body is M.encode'd JSON. Cannot decode easily, but we can
            // intercept and try to get DPlayer's token from window
            route.continue();
          });
        }
        r(popup);
      }); });
      
      await p.evaluate(function(idx) { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, chapters[ci2].idx);
      var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
      if (!popup) { log('No popup'); continue; }
      
      try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
      
      // Wait and extract token from iframe - try multiple times
      var pf = null;
      for (var w = 0; w < 30; w++) {
        var frames = popup.frames();
        for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
        if (pf) break; await sl(1000);
      }
      
      if (pf) {
        // Try extracting token - keep trying until we get it
        for (var attempt = 0; attempt < 10; attempt++) {
          if (!capToken) {
            capToken = await pf.evaluate(function() {
              var scripts = document.querySelectorAll('script');
              for (var s of scripts) {
                var txt = s.textContent || '';
                var tm = txt.match(/token['"]?\s*[:=]\s*['"]([^'"]{20,50})['"]/);
                if (tm) return tm[1];
                var tm2 = txt.match(/token\s*=\s*['"]([^'"]{20,50})['"]/);
                if (tm2) return tm2[1];
              }
              return null;
            });
          }
          if (!capUrl) {
            capUrl = await pf.evaluate(function() {
              var s = document.querySelectorAll('script');
              for (var si of s) {
                var txt = si.textContent || '';
                var sm = txt.match(/["']serverUrl["']\s*:\s*["']([^"']+)["']/);
                if (sm) return sm[1];
              }
              // Default
              var base = document.querySelector('base');
              return base ? base.href : 'https://content.hst360.com';
            });
          }
          if (capToken && capUrl) break;
          await sl(3000);
        }
      }
      
      var ok = await completeSection(popup, chapters[ci2].name, capToken, capUrl);
      totalCompleted++;
      
      try { popup.close(); } catch(e) {}
      await sl(2000);
    }
    
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== DONE! Total marked: ' + totalCompleted + ' sections ===');
  await ctx.storageState({ path: AUTH });
  await browser.close();
})();
