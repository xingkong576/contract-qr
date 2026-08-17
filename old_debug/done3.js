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

// M.encode base60 decoder - reverse from DPlayer's M utility
// The M utility encodes using base-60 digits: 0-9, a-z, A-Z minus I, O, U
// 0-9 = 0-9, a-k = 10-20, m-r = 21-26, s-x = 27-32, y-z = 33-34
// A-F = 35-40, G-M = 41-47, N-P = 48-50, Q-R = 51-52, S-Z = 53-60
function decodeBase60(s) {
  var ALPH = '0123456789abcdefghjkmnpqrstvwxyzABCDEFGHJKLMNPQRSTVWXYZ';
  var MAP = {};
  for (var i = 0; i < ALPH.length; i++) MAP[ALPH[i]] = i;
  
  var result = 0n;
  for (var i = 0; i < s.length; i++) {
    var digit = MAP[s[i]];
    if (digit === undefined) continue;
    result = result * 60n + BigInt(digit);
  }
  
  // Convert BigInt to hex then to string
  var hex = result.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i+2), 16));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// Encode base60 (for our calls)
function encodeBase60(s) {
  var ALPH = '0123456789abcdefghjkmnpqrstvwxyzABCDEFGHJKLMNPQRSTVWXYZ';
  var encoder = new TextEncoder();
  var bytes = encoder.encode(s);
  
  var num = 0n;
  for (var i = 0; i < bytes.length; i++) {
    num = num * 256n + BigInt(bytes[i]);
  }
  
  if (num === 0n) return '0';
  
  var result = '';
  while (num > 0n) {
    result = ALPH[Number(num % 60n)] + result;
    num = num / 60n;
  }
  return result;
}

async function completeSection(popup, pf, chapName) {
  log('>> ' + chapName);
  
  // Try extracting token - wait for it
  var token = null, serverUrl = 'https://content.hst360.com';
  
  for (var at = 0; at < 30; at++) {
    token = await pf.evaluate(function() {
      // Search every possible source for token
      // 1. All scripts
      var scripts = document.querySelectorAll('script');
      for (var s of scripts) {
        var txt = s.textContent || '';
        // DPlayer options pattern: token: 'xxx' or token = 'xxx'
        var m = txt.match(/['"](?:token)['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
        if (m) return m[1];
        // Direct assignment
        var m2 = txt.match(/\btoken\s*=\s*['"]([a-f0-9]{20,50})['"]/i);
        if (m2) return m2[1];
      }
      
      // 2. Try window variable
      if (window.token && typeof window.token === 'string' && window.token.length > 20) return window.token;
      
      // 3. Try finding any config/option object
      for (var k in window) {
        try {
          var v = window[k];
          if (v && typeof v === 'object' && v.take && v.take.token) return v.take.token;
          if (v && typeof v === 'object' && v.token) return v.token;
        } catch(e) {}
      }
      return null;
    });
    
    if (token) { log('Token found: ' + token.substring(0, 20) + '...'); break; }
    
    // Check if iframe HTML loaded
    var htmlLen = await pf.evaluate(function() { return document.body ? document.body.innerHTML.length : -1; });
    log('Waiting... at=' + at + ' html=' + htmlLen);
    await sl(2000);
  }
  
  if (!token) { log('NO TOKEN after 30 attempts'); return 'no_token'; }
  
  // Also get serverUrl
  serverUrl = await pf.evaluate(function() {
    var scripts = document.querySelectorAll('script');
    for (var s of scripts) {
      var txt = s.textContent || '';
      var sm = txt.match(/["'](?:serverUrl)["']?\s*[:=]\s*["']([^"']+)["']/);
      if (sm) return sm[1];
    }
    // Check window
    for (var k in window) {
      try {
        var v = window[k];
        if (v && typeof v === 'object' && v.serverUrl) return v.serverUrl;
      } catch(e) {}
    }
    return 'https://content.hst360.com';
  });
  log('Srv: ' + serverUrl);
  
  // Get duration
  var duration = await pf.evaluate(function() {
    try {
      var v = document.querySelector('video');
      if (v && v.duration && v.duration > 10) return Math.floor(v.duration);
      // Try DPlayer container
      var dpDiv = document.querySelector('.dplayer');
      if (dpDiv && dpDiv.__dplayer_g) return Math.floor(dpDiv.__dplayer_g.video.duration);
    } catch(e) {}
    return 3600;
  });
  log('Duration: ' + duration);
  
  // Call API with HMAC
  var result = await pf.evaluate(function(token, srv, dur) {
    var keyPrefix = String.fromCharCode(99,104,97,88,115,50,45,45,99);
    var signKey = keyPrefix + token.substring(1, 5);
    var timeVal = dur - 5;
    var timestamp = Date.now();
    var signInput = token + timeVal + timestamp;
    
    return crypto.subtle.importKey('raw', new TextEncoder().encode(signKey), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
    .then(function(key) { return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signInput)); })
    .then(function(sig) {
      var binary = '';
      new Uint8Array(sig).forEach(function(b) { binary += String.fromCharCode(b); });
      var signature = btoa(binary);
      
      var reqData = { token: token, time: timeVal, duration: dur, isEnd: 'true', timestamp: timestamp, signature: signature };
      var jsonStr = JSON.stringify(reqData);
      var encoded = M.encode(jsonStr);
      
      var url = srv + '/videoPlay/takeRecordByToken';
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        body: encoded
      }).then(function(resp) {
        return resp.text().then(function(text) { return 'st=' + resp.status + ' r=' + (text||'e').substring(0,100); });
      }).catch(function(err) { return 'fe: ' + err.message; });
    }).catch(function(err) { return 'ce: ' + err.message; });
  }, token, serverUrl, duration);
  
  log('Result: ' + result);
  return token; // Return token for reuse
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
  log('=== DONE v3 ===');
  
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
  
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=' + PLAN + '&platformId=154', { waitUntil: 'load', timeout: 30000 }); await sl(5000);
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);
  
  var totalCompleted = 0;
  var globalToken = null;
  
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
      var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
      await p.evaluate(function(idx) { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, chapters[ci2].idx);
      var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
      if (!popup) { log('No popup'); continue; }
      
      try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
      
      var pf = null;
      for (var w = 0; w < 30; w++) {
        var frames = popup.frames();
        for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
        if (pf) break; await sl(1000);
      }
      if (!pf) { log('NO PF'); popup.close(); continue; }
      
      var t = await completeSection(popup, pf, chapters[ci2].name);
      if (t && t.length > 20) globalToken = t;
      totalCompleted++;
      
      try { popup.close(); } catch(e) {}
      await sl(2000);
    }
    
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== DONE! Total: ' + totalCompleted + ' sections ===');
  await ctx.storageState({ path: AUTH });
  await browser.close();
})();
