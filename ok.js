const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const PW2 = './web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const USER_DATA = 'C:/Users/Administrator/AppData/Local/Google/Chrome/User Data';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/ok_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

(async function() {
  fs.writeFileSync(LF, '');
  log('=== OK ===');
  
  var browser = await chromium.launch({ headless: false });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();

  var allRequests = [];
  await p.route('**/*', function(route) {
    var u = route.request().url();
    allRequests.push({ u: u.substring(0, 120), t: Date.now() });
    route.continue().catch(function(){});
  });

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_ok.png' }); log('W');
  fs.writeFileSync(CF, '');
  var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var li = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
  log('In');
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);

  // Get first course
  var firstCourseId = 'a5b20c83fded44cb96c3e31ec409f8a0'; // 企业数字化转型
  await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}}); }, {plan:PLAN, cid:firstCourseId});
  await sl(5000);
  
  // Extract ALL chapter links including href
  var chapInfo = await p.evaluate(function() {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var links = document.querySelectorAll('a.titlecolor.text');
    var list = [];
    for (var i = 0; i < btns.length; i++) {
      var href = links[i] ? (links[i].getAttribute('href') || '') : '';
      var onclick = btns[i].getAttribute('onclick') || '';
      list.push({
        idx: i,
        btnText: btns[i].textContent.trim(),
        name: links[i] ? links[i].textContent.trim() : '',
        href: href,
        onclick: onclick.substring(0, 100)
      });
    }
    return list;
  });
  log('Chapters:');
  chapInfo.forEach(function(ch) { log('  [' + ch.btnText + '] ' + ch.name + ' href=' + ch.href); });

  // Find first uncompleted chapter and CLICK the button
  var firstIncomplete = chapInfo.find(function(ch) { return ch.btnText.indexOf('\u5df2\u5b66\u5b8c') === -1; });
  if (!firstIncomplete) { log('All done'); await browser.close(); return; }
  
  log('Clicking: ' + firstIncomplete.name);
  
  // Click the button and capture popup
  var popupP = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
  await p.evaluate(function(idx) {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    if (btns[idx]) btns[idx].click();
  }, firstIncomplete.idx);
  
  var popup = await Promise.race([popupP, sl(30000).then(function(){return null;})]);
  if (!popup) { log('No popup'); await browser.close(); return; }
  
  log('Popup URL: ' + popup.url().substring(0, 150));
  try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
  await sl(5000);
  
  // Extract sectionId from popup URL
  var popupUrl = popup.url();
  var sectionMatch = popupUrl.match(/sectionId=([^&]+)/);
  if (sectionMatch) log('SectionId: ' + sectionMatch[1]);
  else log('No sectionId in URL');
  var courseMatch = popupUrl.match(/courseId=([^&]+)/);
  if (courseMatch) log('CourseId: ' + courseMatch[1]);
  
  // Find player iframe
  var pf = null;
  for (var w = 0; w < 20; w++) {
    var frames = popup.frames();
    for (var f of frames) {
      try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {}
    }
    if (pf) break; await sl(1000);
  }
  
  if (pf) {
    log('PF: ' + pf.url().substring(0, 120));
    
    // Extract everything from iframe
    var info = await pf.evaluate(function() {
      var result = {};
      
      // Page title
      result.title = document.title;
      
      // All scripts
      var scripts = document.querySelectorAll('script');
      result.scriptCount = scripts.length;
      result.dplayerScript = null;
      for (var s of scripts) {
        var src = s.getAttribute('src');
        if (src && (src.indexOf('chplayer') >= 0 || src.indexOf('player') >= 0)) result.dplayerScript = src;
        var txt = s.textContent || '';
        if (txt.indexOf('take') >= 0 && txt.indexOf('token') >= 0) {
          result.initScript = txt.substring(0, 500);
        }
        if (txt.indexOf('serverUrl') >= 0) {
          if (!result.initScript) result.initScript = txt.substring(0, 500);
        }
      }
      
      // Search for player instance
      for (var k in window) {
        try {
          var obj = window[k];
          if (obj && typeof obj === 'object' && obj.video && obj.options && obj.options.take) {
            result.playerKey = k;
            result.token = obj.options.take.token.substring(0, 20) + '...';
            result.serverUrl = obj.options.serverUrl || '';
            result.hasApi = !!(obj.options.apiBackend && obj.options.apiBackend.send);
            break;
          }
        } catch(e) {}
      }
      
      // Video
      var v = document.querySelector('video');
      if (v) {
        result.videoExists = true;
        result.videoReadyState = v.readyState;
        result.videoSrc = (v.src || '').substring(0, 60);
      }
      
      // DPlayer container
      var dpContainer = document.querySelector('.dplayer');
      if (dpContainer) {
        result.dpContainer = true;
        var customProps = [];
        for (var pk in dpContainer) {
          if (!pk.startsWith('on') && pk !== 'constructor' && pk !== 'dataset' && !pk.startsWith('__')) {
            customProps.push(pk);
          }
        }
        result.dpContainerProps = customProps;
        result.dpDataset = JSON.stringify(dpContainer.dataset ? Object.keys(dpContainer.dataset) : []);
      }
      
      return result;
    });
    
    log('Iframe info: ' + JSON.stringify(info, null, 2));
    
    // Try clicking play
    try {
      var r = await pf.evaluate(function() {
        var v = document.querySelector('video');
        if (v) { v.play(); return 'played'; }
        return 'no video';
      });
      log('Play: ' + r);
    } catch(e) { log('Play err: ' + e.message.substring(0,60)); }
    
    // Wait 30 seconds for API calls
    log('Waiting 30s...');
    var beforeCount = allRequests.length;
    await sl(30000);
    var newReqs = allRequests.slice(beforeCount);
    log('New requests: ' + newReqs.length);
    newReqs.forEach(function(req) { log('  ' + req.u.substring(0, 110)); });
    
  } else {
    log('NO PF');
  }
  
  await browser.close();
})();
