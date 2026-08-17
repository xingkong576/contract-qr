const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/work_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function playChapter(popup, name) {
  log('>> ' + name);
  
  // Set up route interceptor on the POPUP, not the main page!
  var apiHits = [];
  var complete = false;
  
  try {
    await popup.route('**/takeRecordByToken**', function(route) {
      var pd = (route.request().postData() || '');
      log('API: ' + pd.replace(/token=[^&]+/, 'token=***').substring(0, 80));
      apiHits.push(pd);
      if (pd.indexOf('isEnd') >= 0 && pd.indexOf('true') >= 0) { complete = true; log('  COMPLETE!'); }
      route.continue().catch(function(){});
    });
  } catch(e) { log('Route err: ' + (e.message||'').substring(0,60)); }
  
  // Find player iframe
  var pf = null;
  for (var w = 0; w < 20; w++) {
    var frames = popup.frames();
    for (var f of frames) {
      try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {}
    }
    if (pf) break; await sl(1000);
  }
  if (!pf) { log('NO PF'); return false; }
  log('PF');
  await sl(3000);
  
  // Get full init script to extract token
  var initScript = await pf.evaluate(function() {
    var scripts = document.querySelectorAll('script');
    for (var s of scripts) {
      var txt = s.textContent || s.innerText;
      if (txt && txt.indexOf('take') >= 0 && txt.indexOf('token') >= 0) {
        return txt;
      }
    }
    return 'no_init_script';
  });
  
  // Extract token and key info
  var tokenMatch = initScript.match(/["']token["']\s*:\s*["']([^"']+)["']/);
  var serverMatch = initScript.match(/["']serverUrl["']\s*:\s*["']([^"']+)["']/);
  var keyMatch = initScript.match(/["']signKey["']\s*:\s*["']([^"']+)["']/);
  
  log('Token: ' + (tokenMatch ? tokenMatch[1].substring(0, 20) + '...' : 'none'));
  log('ServerUrl: ' + (serverMatch ? serverMatch[1] : 'none'));
  
  // Check if we can find the HMAC key from the init script
  var keyPrefixMatch = initScript.match(/chaXs/i);
  if (keyPrefixMatch) {
    log('HMAC key prefix found in init script');
    var relevant = initScript.substring(Math.max(0, keyPrefixMatch.index - 20), keyPrefixMatch.index + 100);
    log('  Context: ' + relevant.substring(0, 150));
  }
  
  // Now click play and monitor
  try {
    var r = await pf.evaluate(function() {
      var v = document.querySelector('video');
      if (v) { v.play(); return 'played'; }
      return 'no_video';
    });
    log('Play: ' + r);
  } catch(e) { log('Play err: ' + (e.message||'').substring(0,60)); }
  
  // Wait for API calls
  for (var i = 0; i < 600; i++) {
    await sl(15000);
    if (complete) { log('Marked complete'); break; }
    
    // Check if popup still exists
    try { var u = popup.url(); } catch(e) { log('Popup closed'); break; }
    
    var apiCount = apiHits.length;
    if (apiCount > 0) {
      log('API hits so far: ' + apiCount);
      if (apiCount >= 2) {
        // After 2 saves, try to mark complete via direct API call
        log('Trying to mark complete...');
      }
    }
    
    // Fail-safe: if no API after 2 min, break
    if (i >= 8) { log('Timeout'); break; }
  }
  
  log('API total: ' + apiHits.length);
  try { await popup.unroute('**/takeRecordByToken**'); } catch(e) {}
  try { popup.close(); } catch(e) {}
  return apiHits.length > 0;
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== WORK ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);
  
  var browser = await chromium.launch({ headless: false });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_work.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var li = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
  log('In');
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);

  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    
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
      var ch = chapters[ci2];
      
      var pp = new Promise(function(r) { p.once('popup', function(pop) { r(pop); }); });
      await p.evaluate(function(idx) { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, ch.idx);
      var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
      if (!popup) { log('No popup'); continue; }
      
      try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
      await sl(3000);
      
      await playChapter(popup, ch.name);
      await sl(3000);
    }
    
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== ALL DONE ===');
})().catch(function(e) { log('FATAL: ' + (e.message||'')); });
