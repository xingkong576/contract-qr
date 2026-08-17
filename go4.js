const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/go4_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function playChap(page, popup, chapName) {
  log('Playing: ' + chapName);

  // Wait for player iframe
  var pf = null;
  for (var w = 0; w < 30; w++) {
    var frames = popup.frames();
    for (var f of frames) {
      try { if (f.url().includes('content.hst360.com/videoPlay')) { pf = f; break; } } catch(e) {}
    }
    if (pf) break;
    await sl(1000);
  }
  if (!pf) { log('NO PF'); return false; }
  log('PF found');
  await sl(3000);

  // Click DPlayer play button
  try {
    var clickResult = await pf.evaluate(function() {
      var btns = document.querySelectorAll('.dplayer-play-icon, .dplayer-mobile-play, .dplayer-bezel-icon, .dplayer-video-wrap, video');
      for (var b of btns) {
        if (b.offsetParent !== null || b.tagName === 'VIDEO') { b.click(); return b.className || b.tagName; }
      }
      return 'nothing';
    });
    log('Clicked: ' + clickResult);
  } catch(e) { log('Click err: ' + (e.message||'').substring(0,60)); }

  await sl(3000);

  // TRY 16x SPEED: find DPlayer instance and set speed on both internal state + video element
  try {
    var speedResult = await pf.evaluate(function() {
      var v = document.querySelector('video');
      if (!v) return 'no video';
      
      // Method 1: Look for DPlayer on window
      var dp = null;
      for (var k of Object.keys(window)) {
        try {
          var obj = window[k];
          if (obj && typeof obj === 'object' && obj.video === v && obj.status_data && obj.speed) {
            dp = obj; break;
          }
        } catch(e) {}
      }
      
      // Method 2: Check __dplayer__ property
      if (!dp) {
        var container = document.querySelector('.dplayer');
        if (container && container.__dplayer__) dp = container.__dplayer__;
      }
      
      if (dp && dp.speed) {
        dp.status_data.playbackRate = 16;
        dp.video.playbackRate = 16;
        // Also call speed function to update UI
        dp.speed(16);
        return 'DP:' + dp.video.playbackRate + '/' + dp.status_data.playbackRate;
      }
      
      // Fallback: Direct video manipulation
      v.playbackRate = 16;
      return 'raw:' + v.playbackRate;
    });
    log('Speed: ' + speedResult);
  } catch(e) { log('Speed err: ' + (e.message||'').substring(0,60)); }

  // Monitor via route interception (reliable!)
  var apiHits = [];
  var routeHandler = function(route) {
    var url = route.request().url();
    var method = route.request().method();
    if (url.indexOf('takeRecordByToken') >= 0) {
      var postData = route.request().postData() || '';
      apiHits.push({ url: url, data: postData.substring(0, 120), time: Date.now() });
      log('API: ' + postData.replace(/token=[^&]+/, 'token=***').substring(0, 100));
      
      // If isEnd=true, video is complete
      if (postData.indexOf('isEnd') >= 0 && postData.indexOf('true') >= 0) {
        log('  VIDEO COMPLETE via API!');
      }
    }
    route.continue();
  };
  
  await page.route('**/takeRecordByToken**', routeHandler);
  
  // Wait for completion: check both API endpoint and popup state
  var videoDuration = 0;
  await sl(10000); // give time for video to start
  
  for (var i = 0; i < 600; i++) {
    await sl(15000);
    
    // Check if API reported completion
    var isComplete = apiHits.some(function(h) { return h.data.indexOf('true') >= 0 && h.data.indexOf('isEnd') >= 0; });
    if (isComplete) { log('DETECTED COMPLETE'); break; }
    
    // Also check video state in iframe
    try {
      var frames = popup.frames();
      var currentPF = null;
      for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { currentPF = f; break; } } catch(e) {} }
      
      if (!currentPF) {
        log('Frame lost - likely completed or page closed');
        break;
      }
      
      var state = await currentPF.evaluate(function() {
        var v = document.querySelector('video');
        if (!v) return null;
        return { ct: Math.floor(v.currentTime), dur: Math.floor(v.duration), pct: Math.round(v.currentTime / v.duration * 100), ended: v.ended, paused: v.paused, rate: v.playbackRate };
      });
      
      if (!state) { log('No video'); continue; }
      videoDuration = state.dur;
      
      if (i % 2 === 0) log('  ' + state.pct + '% (' + state.ct + '/' + state.dur + 's)' + (state.ended ? ' ENDED' : '') + ' @' + state.rate + 'x');
      
      if (state.ended || state.pct >= 99) { log('DONE'); break; }
      
      // At 16x, a 14min video should complete in ~53s
      var expectedEndMin = Math.ceil(state.dur / 16 / 60);
      if (state.pct > 0 && state.ct / state.rate > 0) {
        // Time-based: if 16x, check if video should be done
        var elapsedSinceStart = Math.floor((Date.now() - apiHits.length > 0 ? apiHits[0].time : Date.now()) / 1000);
        var expectedCompleteAt = state.dur / state.rate + 30;
        if (elapsedSinceStart > expectedCompleteAt) {
          log('Timeout: elapsed=' + elapsedSinceStart + 's > expected=' + Math.floor(expectedCompleteAt) + 's');
          break;
        }
      }
      
    } catch(e) {
      log('Eval err: ' + (e.message || '').substring(0, 50));
    }
  }
  
  try { await page.unroute('**/takeRecordByToken**'); } catch(e) {}
  
  var hits = apiHits.length;
  log('API hits: ' + hits);
  
  // Close popup
  try { popup.close(); } catch(e) {}
  return true;
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== GO4 ===');
  
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
    lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e) { return false; } });
    if (lf) break;
    await sl(2000);
  }
  
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_go4.png' });
  log('W');
  fs.writeFileSync(CF, '');
  var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var li = false;
  for (var w = 0; w < 30; w++) { if (p.url().includes('v_selected_course') || p.url().includes('v_trainplan')) { li = true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', { timeout: 30000 }); await sl(3000); }
  log('In');
  
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el) { return el.textContent.indexOf('\u53bb\u5b66\u4e60') >= 0; }); if (b) b.click(); });
  await sl(8000);

  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    
    log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: o.p, platformId: '154', courseId: o.c } }); }, { p: PLAN, c: c.courseId });
    await sl(5000);
    
    var chapters = await p.evaluate(function() {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var titles = document.querySelectorAll('a.titlecolor.text');
      var list = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) list.push({ idx: i, name: (titles[i] ? titles[i].textContent.trim() : '?').substring(0, 30) });
      }
      return list;
    });
    
    if (chapters.length === 0) { log('All done'); continue; }
    log('Chaps: ' + chapters.length);
    
    for (var ci2 = 0; ci2 < chapters.length; ci2++) {
      var ch = chapters[ci2];
      
      var popupP = new Promise(function(r) { p.once('popup', function(pop) { r(pop); }); });
      await p.evaluate(function(idx) { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, ch.idx);
      var popup = await Promise.race([popupP, sl(20000).then(function(){return null;})]);
      if (!popup) { log('No popup'); continue; }
      
      await playChap(p, popup, ch.name);
      await sl(2000);
    }
    
    // Back to course list
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({ path: '/v_selected_course', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154' } }); });
    await sl(5000);
  }
  
  log('\n=== ALL DONE ===');
})().catch(function(e) { log('FATAL: ' + e.message + ' | ' + (e.stack || '').substring(0, 300)); });
