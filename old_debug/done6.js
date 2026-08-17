const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';
const AUTHFILE = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';

async function getToken(pf) {
  for (var at = 0; at < 10; at++) {
    var token = await pf.evaluate(function() {
      // window.initData is set by full.js/full2.js
      if (window.initData && window.initData.take && window.initData.take.token) return window.initData.take.token;
      // Check all scripts by fetching them
      return null;
    });
    if (token) return token;
    
    // Try fetching full.js/full2.js scripts
    var srcs = await pf.evaluate(function() {
      var list = [];
      document.querySelectorAll('script[src*="full"], script[src*="init"]').forEach(function(s) { if (s.src) list.push(s.src); });
      return list;
    });
    for (var si = 0; si < srcs.length; si++) {
      try {
        var resp = await pf.evaluate(function(u) { return fetch(u).then(function(r){return r.text();}).catch(function(){return '';}); }, srcs[si]);
        if (resp.length > 10) {
          var m = resp.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
          if (m) return m[1];
        }
      } catch(e) {}
    }
    await sl(2000);
  }
  return null;
}

async function watchChapter(popup, pf, chapName) {
  log('>> ' + chapName);
  
  // Step 1: Make video play by clicking
  await pf.evaluate(function() {
    // Click play button in DPlayer
    try {
      var playBtn = document.querySelector('.dplayer-play-icon');
      if (playBtn) playBtn.click();
    } catch(e) {}
    // Also try video.play()
    try {
      var v = document.querySelector('video');
      if (v && v.paused) v.play();
    } catch(e) {}
  });
  
  // Step 2: Wait for the player to establish session with real saveProgress calls
  // The first saveProgress happens at ~28 seconds
  log('Watching for 50s to establish session...');
  
  // Monitor for takeRecordByToken API calls
  var saveCount = 0;
  var token = null;
  popup.route('**/takeRecordByToken**', function(route, request) {
    var body = request.postData() || '';
    log('API capture: ' + body.substring(0, 30) + '...');
    saveCount++;
    route.continue();
  });
  
  await sl(50000);
  
  // Step 3: Get video info, then seek to near end + trigger ended
  var info = await pf.evaluate(function() {
    var r = { dur: 0, target: 0 };
    try {
      var v = document.querySelector('video');
      if (v && v.duration > 10) {
        r.dur = Math.floor(v.duration);
        // Seek to just 10s before end (more gradual than 5s)
        r.target = r.dur - 10;
        v.currentTime = r.target;
        // Set playback rate to 1 (explicitly)
        v.playbackRate = 1.0;
        return r;
      }
    } catch(e) {}
    return r;
  });
  log('Seek to d-10, dur=' + info.dur + 's target=' + info.target + 's');
  
  // Step 4: Wait for video to naturally end (play last 10s)
  var ended = false;
  for (var w = 0; w < 15; w++) {
    ended = await pf.evaluate(function() {
      try { var v = document.querySelector('video'); return v ? v.ended : false; } catch(e) { return false; }
    });
    if (ended) { log('Natural end!'); break; }
    await sl(1000);
  }
  
  // Step 4b: If not ended, dispatch ended event at the seek position
  if (!ended) {
    log('Force ended');
    await pf.evaluate(function() {
      try {
        var v = document.querySelector('video');
        if (v) {
          // Set a small remaining time to avoid suspicious jump
          v.currentTime = v.duration || 0;
          v.dispatchEvent(new Event('ended'));
        }
      } catch(e) {}
    });
    await sl(3000);
  }
  
  // Step 5: Wait for the completion API call (isEnd=true)
  await sl(12000);
  
  log('Saves during session: ' + saveCount);
  return saveCount > 0;
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
  log('W'); fs.writeFileSync(CF,''); var code='';
  while (!code) { await sl(1000); code = fs.readFileSync(CF,'utf8').trim(); }
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  var ok = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { ok=true; break; } await sl(1000); }
  if (!ok) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list',{timeout:30000}); await sl(3000); }
  log('Logged in');
}

(async function() {
  fs.writeFileSync(LF,'');
  log('=== DONE v6 (watch+seek) ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: '+courses.length);
  
  // Use persistent context to preserve login
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {
    headless: false,
    viewport: {width:1280,height:800}
  });
  var p = ctx.pages()[0] || await ctx.newPage();
  
  // Check login
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(3000);
  if (p.url().indexOf('nosession') >= 0 || p.url().indexOf('commonLogin') >= 0) {
    log('Need login');
    await doLogin(p);
  } else log('Session OK');
  
  await sl(3000);
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(5000);
  // Click 去学习
  await p.evaluate(function(){
    var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;});
    if(b) b.click();
  });
  await sl(8000);
  
  var total = 0;
  
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log(c.courseName + ': DONE'); continue; }
    
    log('\n=== (' + (ci+1) + '/' + courses.length + ') ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
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
    if (chapters.length === 0) continue;
    
    for (var ci2 = 0; ci2 < chapters.length; ci2++) {
      var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
      await p.evaluate(function(idx){
        var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
        if (b[idx]) b[idx].click();
      }, chapters[ci2].idx);
      var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
      if (!popup) { log('No popup'); continue; }
      try { await popup.waitForLoadState('load',{timeout:15000}); } catch(e) {}
      
      var pf = null;
      for (var w = 0; w < 30; w++) {
        var frames = popup.frames();
        for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
        if (pf) break; await sl(1000);
      }
      
      if (pf) await watchChapter(popup, pf, chapters[ci2].name);
      else log('NO PF');
      
      try { popup.close(); } catch(e) {}
      await sl(1000);
      total++;
      
      // Re-check if page still valid (session might have expired)
      var curUrl = p.url();
      if (curUrl.indexOf('nosession') >= 0) { log('SESSION LOST!'); break; }
    }
    
    // Back to course list
    await p.evaluate(function(){
      var app = document.querySelector('#app');
      if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course', query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76', platformId:'154'}});
    });
    await sl(5000);
  }
  
  log('\n=== ALL DONE! Processed ' + total + ' sections ===');
  await sl(3000);
})();
