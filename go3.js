const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/go3_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

function findPF(page) {
  var frames = page.frames();
  for (var i = 0; i < frames.length; i++) {
    try {
      var u = frames[i].url();
      if (u.includes('content.hst360.com/videoPlay')) return { frame: frames[i], url: u };
    } catch (e) {}
  }
  return null;
}

async function playChap(popup, name) {
  log('Playing: ' + name);
  
  // Wait for player iframe
  var pfData = null;
  for (var w = 0; w < 30; w++) {
    pfData = findPF(popup);
    if (pfData) break;
    await sl(1000);
  }
  if (!pfData) { log('NO PF'); return false; }
  log('PF: ' + pfData.url.substring(0, 100));
  
  await sl(3000);
  
  // CLICK the DPlayer play button
  try {
    var result = await pfData.frame.evaluate(function() {
      // Method 1: DPlayer play icon
      var icons = document.querySelectorAll('.dplayer-play-icon, [class*=dplayer-play], .dplayer-bezel-icon, .dplayer-mobile-play');
      for (var b of icons) {
        if (b.offsetParent !== null) { b.click(); return 'icon';
        }
      }
      // Method 2: Just click the video
      var v = document.querySelector('video');
      if (v) { v.play(); return 'vplay'; }
      // Method 3: Try the container
      var vw = document.querySelector('.dplayer-video-wrap');
      if (vw) { vw.click(); return 'wrap'; }
      return 'none';
    });
    log('Play: ' + result);
  } catch (e) { log('Play err: ' + (e.message || '').substring(0, 80)); }
  
  // Monitor progress
  await sl(10000);
  
  var lastPct = 0, staleCount = 0;
  var pfCheck = findPF(popup);
  if (!pfCheck) { log('PF lost before monitoring'); return false; }
  pfData = pfCheck;
  
  for (var i = 0; i < 600; i++) {
    await sl(30000);
    
    // Re-check PF - the URL might change
    pfCheck = findPF(popup);
    if (!pfCheck) {
      // Try to find any pending video element in the popup
      try {
        var anyVideo = await popup.evaluate(function() {
          var ifr = document.querySelector('iframe');
          if (!ifr) return 'noiframe';
          try { var cd = ifr.contentDocument; return cd ? 'ok' : 'cross'; } catch(e) { return 'cross-origin'; }
        });
        log('PF lost, popup state: ' + anyVideo);
      } catch(e) { log('Popup gone'); }
      break;
    }
    pfData = pfCheck;
    
    try {
      var state = await pfData.frame.evaluate(function() {
        var v = document.querySelector('video');
        if (!v) return null;
        var ct = Math.floor(v.currentTime);
        var dur = Math.floor(v.duration);
        var pct = dur > 0 ? Math.round(ct / dur * 100) : 0;
        return { ct: ct, dur: dur, pct: pct, ended: v.ended, paused: v.paused, src: v.src ? v.src.substring(0, 60) : 'none' };
      });
      
      if (!state) { log('No video element'); staleCount++; if (staleCount > 3) break; continue; }
      
      staleCount = 0;
      log('  ' + state.pct + '% (' + state.ct + '/' + state.dur + ')' + (state.paused ? ' PAUSED' : ''));
      
      if (state.ended || state.pct >= 99) { log('  COMPLETED'); await sl(3000); return true; }
      
      // Check if video is playing properly
      if (state.pct === lastPct && state.ct > 5) { staleCount++; if (staleCount > 6) { log('Stuck'); break; } }
      else { lastPct = state.pct; staleCount = 0; }
      
    } catch (e) {
      log('Eval err: ' + (e.message || '').substring(0, 60));
      staleCount++; if (staleCount > 3) break;
    }
  }
  
  return true; // assume ok
}

async function processCourse(p, course) {
  log('\n=== ' + course.courseName + ' (' + course.learnPercent + '%) ===');
  if (parseInt(course.learnPercent) >= 100) { log('SKIP'); return; }
  
  // Navigate to course details
  await p.evaluate(function(o) {
    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      app.__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: o.plan, platformId: '154', courseId: o.cid } });
    }
  }, { plan: PLAN, cid: course.courseId });
  await sl(5000);
  
  // Get uncompleted chapters
  var chapters = await p.evaluate(function() {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles = document.querySelectorAll('a.titlecolor.text');
    var list = [];
    for (var i = 0; i < btns.length; i++) {
      var btnText = btns[i].textContent.trim();
      if (btnText.indexOf('\u5df2\u5b66\u5b8c') === -1) {
        list.push({ idx: i, name: (titles[i] ? titles[i].textContent.trim() : '?'), btnText: btnText });
      }
    }
    return list;
  });
  
  if (chapters.length === 0) { log('All chapters done'); return; }
  log('Chapters: ' + chapters.length);
  chapters.forEach(function(c, i) { log('  ' + i + ': ' + c.name + ' [' + c.btnText + ']'); });
  
  for (var ci = 0; ci < chapters.length; ci++) {
    var ch = chapters[ci];
    log('>> ' + ch.name);
    
    var popupP = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
    await p.evaluate(function(idx) {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      if (btns[idx]) btns[idx].click();
    }, ch.idx);
    
    var popup = await Promise.race([
      popupP,
      sl(20000).then(function() { return null; })
    ]);
    if (!popup) { log('No popup'); continue; }
    
    await sl(8000); // wait for player load
    
    var ok = await playChap(popup, ch.name);
    log('Result: ' + (ok ? 'OK' : 'FAIL'));
    
    try { popup.close(); } catch(e) {}
    await sl(3000);
  }
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== GO3 ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);
  
  var browser = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();
  
  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  await sl(3000);
  
  var lf = null;
  for (var i = 0; i < 20; i++) {
    lf = p.frames().find(function(f) {
      try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e) { return false; }
    });
    if (lf) break;
    await sl(2000);
  }
  
  await lf.waitForSelector('input', { timeout: 15000 });
  var inputs = await lf.locator('input').all();
  await inputs[0].fill(U);
  await inputs[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_go3.png' });
  log('Waiting captcha');
  fs.writeFileSync(CF, '');
  
  var code = '';
  while (!code) {
    await sl(1000);
    code = fs.readFileSync(CF, 'utf8').trim();
  }
  log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var loggedIn = false;
  for (var w = 0; w < 30; w++) {
    var url = p.url();
    if (url.includes('v_trainplan_list') || url.includes('v_selected_course')) { loggedIn = true; break; }
    await sl(1000);
  }
  if (!loggedIn) {
    await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', { waitUntil: 'load', timeout: 30000 });
    await sl(3000);
  }
  log('Logged in');
  
  // Click "去学习"
  await p.evaluate(function() {
    var btns = Array.from(document.querySelectorAll('button'));
    var learnBtn = btns.find(function(el) { return el.textContent.indexOf('\u53bb\u5b66\u4e60') >= 0; });
    if (learnBtn) learnBtn.click();
  });
  await sl(8000);
  
  // Process each course
  for (var ci = 0; ci < courses.length; ci++) {
    await processCourse(p, courses[ci]);
    
    // Navigate back to course list
    await p.evaluate(function() {
      var app = document.querySelector('#app');
      if (app && app.__vue__) {
        app.__vue__.$router.push({ path: '/v_selected_course', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154' } });
      }
    });
    await sl(5000);
  }
  
  log('\n=== ALL DONE ===');
})().catch(function(e) { log('FATAL: ' + e.message + ' | ' + (e.stack || '').substring(0, 200)); });
