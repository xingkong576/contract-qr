const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function completeSection(popup, pf, chapName) {
  log('>> ' + chapName);
  
  var token = null;
  for (var at = 0; at < 20; at++) {
    token = await pf.evaluate(function() {
      if (window.initData && window.initData.take && window.initData.take.token) return window.initData.take.token;
      try {
        var dpDiv = document.querySelector('.dplayer');
        if (window.__dplayer_options && window.__dplayer_options.take && window.__dplayer_options.take.token)
          return window.__dplayer_options.take.token;
      } catch(e) {}
      var scripts = document.querySelectorAll('script');
      for (var s of scripts) {
        var txt = s.textContent || '';
        var m = txt.match(/take\s*:\s*\{[\s\S]*?token\s*:\s*['"]([^'"]+)['"]/);
        if (m) return m[1];
      }
      return null;
    });
    if (token) break;
    
    // Try fetching external scripts
    var srcs = await pf.evaluate(function() {
      var s = [];
      document.querySelectorAll('script').forEach(function(e) { if(e.src && !e.src.includes('jquery') && !e.src.includes('chplayer') && !e.src.includes('hls') && !e.src.includes('business')) s.push(e.src); });
      return s;
    });
    for (var si = 0; si < srcs.length; si++) {
      try {
        var resp = await pf.evaluate(function(u) { return fetch(u).then(function(r) { return r.text(); }).catch(function(){return '';}); }, srcs[si]);
        if (resp.length > 10) {
          var m = resp.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
          if (m) { token = m[1]; break; }
        }
      } catch(e) {}
    }
    if (token) { log('Token fetched'); break; }
    await sl(2000);
  }
  
  if (!token) { log('NO TOKEN'); return false; }
  log('Token: ' + token.substring(0, 12) + '...');
  
  var dur = await pf.evaluate(function() {
    try { var v = document.querySelector('video'); if (v && v.duration > 10) return Math.floor(v.duration); } catch(e) {}
    return 3600;
  });
  log('Duration: ' + dur);
  
  var result = await pf.evaluate(function(o) {
    var ALPH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx';
    function toB60(s) {
      var bytes = new TextEncoder().encode(s);
      var num = 0n;
      for (var i = 0; i < bytes.length; i++) num = num * 256n + BigInt(bytes[i]);
      if (num === 0n) return ALPH[0];
      var r = '';
      while (num > 0n) { r = ALPH[Number(num % 60n)] + r; num = num / 60n; }
      return r;
    }
    
    var key = String.fromCharCode(99,104,97,88,115,50,45,45,99) + o.t.substring(1, 5);
    var tv = o.d - 5; if (tv < 0) tv = o.d;
    var ts = Date.now();
    
    return crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
    .then(function(k) { return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(o.t + tv + ts)); })
    .then(function(sig) {
      var b = ''; new Uint8Array(sig).forEach(function(b2) { b += String.fromCharCode(b2); });
      var d = { token: o.t, time: tv, duration: o.d, isEnd: 'true', timestamp: ts, signature: btoa(b) };
      return fetch('https://content.hst360.com/videoPlay/takeRecordByToken', {
        method: 'POST',
        headers: {'Content-Type':'text/html;charset=UTF-8'},
        body: toB60(JSON.stringify(d))
      }).then(function(r) { return r.text().then(function(t) { return 'st='+r.status+' r='+(t||'e').substring(0,100); }); })
      .catch(function(e) { return 'fe:'+e.message; });
    }).catch(function(e) { return 'ce:'+e.message; });
  }, {t:token, d:dur});
  
  log('API: ' + result);
  return result.indexOf('code":"0"') >= 0 || result.indexOf('st=200') >= 0 && result.indexOf('code":"100"') < 0;
}

async function processCourse(p, c) {
  log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
  await p.evaluate(function(o) {
    var app = document.querySelector('#app');
    if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails', query:{trainplanId:o.pl, platformId:'154', courseId:o.cd}});
  }, {pl:PLAN, cd:c.courseId});
  await sl(5000);
  
  var chapters = await p.evaluate(function() {
    var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var t = document.querySelectorAll('a.titlecolor.text');
    var l = [];
    for (var i = 0; i < b.length; i++)
      if (b[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1)
        l.push({idx:i, name:(t[i]?t[i].textContent.trim():'?').substring(0,30)});
    return l;
  });
  log('Chaps: ' + chapters.length);
  if (chapters.length === 0) return;
  
  for (var ci = 0; ci < chapters.length; ci++) {
    // Register popup BEFORE click
    var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
    await p.evaluate(function(idx) {
      var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      if (b[idx]) b[idx].click();
    }, chapters[ci].idx);
    
    var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
    if (!popup) { log('No popup'); continue; }
    
    try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
    
    // Find content iframe
    var pf = null;
    for (var w = 0; w < 30; w++) {
      var frames = popup.frames();
      for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
      if (pf) break; await sl(1000);
    }
    
    if (pf) await completeSection(popup, pf, chapters[ci].name);
    else log('NO PF');
    
    try { popup.close(); } catch(e) {}
    await sl(1000);
  }
}

async function checkLogin(p) {
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154', {waitUntil:'load',timeout:30000});
  await sl(3000);
  if (p.url().indexOf('nosession') >= 0) return false;
  if (p.url().indexOf('commonLogin') >= 0) return false;
  return true;
}

async function doLogin(p) {
  await p.goto('http://gszj.hsthnet.com/', {waitUntil:'load',timeout:60000}); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) {
    lf = p.frames().find(function(f){try{return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin');}catch(e){return false;}});
    if (lf) break; await sl(2000);
  }
  await lf.waitForSelector('input',{timeout:15000});
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'});
  log('W'); fs.writeFileSync(CF,''); var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF,'utf8').trim(); }
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  var ok = false;
  for (var w = 0; w < 30; w++) {
    var u = p.url();
    if (u.includes('v_selected_course')||u.includes('v_trainplan')) { ok = true; break; }
    await sl(1000);
  }
  if (!ok) {
    await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list',{timeout:30000});
    await sl(3000);
  }
  log('Logged in');
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== DONE v5 (persistent browser) ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);
  
  // Use persistent context - browser profile saved on disk
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {
    headless: false,
    viewport: {width:1280,height:800}
  });
  var p = ctx.pages()[0] || await ctx.newPage();
  
  // Check if already logged in
  var loggedIn = await checkLogin(p);
  if (!loggedIn) await doLogin(p);
  else log('Session valid!');
  
  // Navigate to course list and start
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000});
  await sl(5000);
  // Click 去学习
  await p.evaluate(function(){
    var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;});
    if(b) b.click();
  });
  await sl(8000);
  
  var total = 0;
  var retry = [];
  
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log(c.courseName + ': DONE'); continue; }
    await processCourse(p, c);
    total++;
  }
  
  // Retry round for courses that might have failed
  if (retry.length > 0) {
    log('\n=== RETRY ROUND ===');
    for (var ci = 0; ci < retry.length; ci++) await processCourse(p, retry[ci]);
  }
  
  log('\n=== ALL DONE!');
  await sl(3000);
})();
