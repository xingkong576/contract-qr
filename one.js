const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/one_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

(async function() {
  fs.writeFileSync(LF, '');
  log('=== ONE ===');
  
  var browser = await chromium.launch({ headless: false });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();
  var requests = [];

  // Capture ALL network requests
  await p.route('**/*', function(route) {
    var u = route.request().url();
    requests.push({ url: u.substring(0, 120), method: route.request().method(), time: Date.now() });
    if (u.indexOf('playEncrypt') >= 0 || u.indexOf('takeRecord') >= 0 || u.indexOf('getCourseInfo') >= 0 || 
        u.indexOf('stBySection') >= 0 || u.indexOf('businessLog') >= 0 || u.indexOf('rxlog') >= 0) {
      log('NET: ' + u.substring(0, 130));
    }
    route.continue().catch(function(){});
  });

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_one.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var li = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
  log('In');
  
  // Navigate directly to first course -> first chapter video
  var firstCourseId = 'a5b20c83fded44cb96c3e31ec409f8a0'; // 企业数字化转型
  var firstSectionId = '2026af7e9b8dce964ebdab00c0647155de76_' + firstCourseId + '_0';
  
  log('Navigating to video page...');
  await p.goto('https://gp.hst360.com/index.html#/v_video?sectionId=' + firstSectionId + '&courseId=' + firstCourseId + '&trainplanId=' + PLAN + '&platformId=154', { waitUntil: 'load', timeout: 30000 });
  await sl(8000);
  
  log('Page URL: ' + p.url().substring(0, 100));
  log('Frames: ' + p.frames().length);
  for (var f of p.frames()) {
    try { log('  Frame: ' + f.url().substring(0, 100)); } catch(e) { log('  Frame: [error]'); }
  }
  
  // Get iframe and try to work with it
  var pf = null;
  for (var w = 0; w < 25; w++) {
    for (var f of p.frames()) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  
  if (pf) {
    log('PF: ' + pf.url().substring(0, 120));
    
    // Get page source
    var html = await pf.evaluate(function() { return document.documentElement.outerHTML.substring(0, 10000); });
    log('HTML:\n' + html);
    
    // Check window keys for DPlayer
    var keys = await pf.evaluate(function() {
      var result = { windowKeys: [], dplayerFound: false, token: null };
      for (var k in window) {
        try {
          var v = window[k];
          if (v && typeof v === 'object' && v.video && v.options && v.options.take) {
            result.dplayerFound = true;
            result.windowKeys.push(k);
            result.token = v.options.take.token;
            result.serverUrl = v.options.serverUrl || '';
            result.hasApi = !!(v.options.apiBackend && v.options.apiBackend.send);
          }
        } catch(e) {}
      }
      return result;
    });
    log('Keys: ' + JSON.stringify(keys));
    
    // Also check the actual video
    try {
      var vi = await pf.evaluate(function() {
        var v = document.querySelector('video');
        if (!v) return 'no_video';
        // Try to find DPlayer via __vue__ or other framework
        var container = document.querySelector('.dplayer');
        var containerKeys = container ? Object.keys(container).filter(function(k) { return !k.startsWith('on') && k !== 'constructor' && !k.startsWith('__') && k.indexOf('dplayer') >= 0 || k.indexOf('player') >= 0; }) : [];
        return { videoExists: true, containerKeys: containerKeys, playbackRate: v.playbackRate };
      });
      log('Video: ' + JSON.stringify(vi));
    } catch(e) { log('Video err: ' + e.message.substring(0,60)); }
    
    // Try clicking play and capturing the API calls
    log('Clicking play...');
    try {
      var r = await pf.evaluate(function() {
        var v = document.querySelector('video');
        if (v) { v.play(); return 'played'; }
        return 'no_video';
      });
      log('Play: ' + r);
    } catch(e) { log('Play err: ' + e.message.substring(0,60)); }
    
    // Wait 60 seconds for API calls
    log('Waiting 60s for API calls...');
    var beforeCount = requests.length;
    await sl(60000);
    var newReqs = requests.slice(beforeCount);
    log('New requests: ' + newReqs.length);
    newReqs.forEach(function(req) { log('  ' + req.method + ' ' + req.url.substring(0, 110)); });
    
  } else {
    log('NO PF - checking requests so far');
    requests.forEach(function(r) { log('REQ: ' + r.url.substring(0, 130)); });
  }
  
  await browser.close();
})();
