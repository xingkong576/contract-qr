const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));
const U = '622726198311030246', P = 'abc123';

(async function() {
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/playwright-data', {
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  var p = ctx.pages()[0] || await ctx.newPage();
  
  // Navigate to a course with token
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', {waitUntil:'load',timeout:30000});
  await sl(5000);
  
  // Click 去学习
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(3000);
  
  // Click first uncompleted section
  var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
  await p.evaluate(function() { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); for(var i=0;i<b.length;i++){if(b[i].textContent.indexOf('\u5df2\u5b66\u5b8c')==-1){b[i].click();break;}} });
  var popup = await pp;
  try { await popup.waitForLoadState('load',{timeout:15000}); } catch(e){}
  
  // Wait for iframe to fully load
  await sl(15000);
  
  var pf = null;
  for (var w = 0; w < 30; w++) {
    var frames = popup.frames();
    for (var f of frames) {
      try {
        if (f.url().includes('content.hst360.com')) { pf = f; break; }
      } catch(e){}
    }
    if (pf) break;
    await sl(1000);
  }
  
  if (!pf) { console.log('NO IFRAME FOUND'); process.exit(1); }
  console.log('IFRAME: ' + pf.url());
  
  // Check video element
  var vin = await pf.evaluate(function() {
    var v = document.querySelector('video');
    if (!v) return 'no_video';
    return 'readyState=' + v.readyState + ' duration=' + v.duration + ' src=' + (v.src||'').substring(0,60);
  });
  console.log('VIDEO: ' + vin);
  
  // List all script URLs in iframe
  var scr = await pf.evaluate(function() {
    var s = document.querySelectorAll('script');
    var urls = [];
    for (var i = 0; i < s.length; i++) {
      urls.push((s[i].src||'inline') + ' len=' + (s[i].textContent||'').length);
    }
    return urls;
  });
  console.log('SCRIPTS (' + scr.length + '):');
  scr.forEach(function(s,i) { console.log('  [' + i + '] ' + s); });
  
  // Search every script for token/init variables
  var found = await pf.evaluate(function() {
    var s = document.querySelectorAll('script');
    var results = [];
    for (var i = 0; i < s.length; i++) {
      var txt = s[i].textContent || '';
      // Search for token=
      var tm = txt.match(/token\s*[=:]/gi);
      if (tm) results.push({idx:i, matches:'token x' + tm.length});
      
      // Search for signId
      if (txt.indexOf('signId') >= 0) {
        var si = txt.substring(Math.max(0, txt.indexOf('signId')-100), Math.min(txt.length, txt.indexOf('signId')+200));
        results.push({idx:i, matches:'signId: ' + si});
      }
      
      // Search for recordId
      if (txt.indexOf('recordId') >= 0) {
        var ri = txt.substring(Math.max(0, txt.indexOf('recordId')-50), Math.min(txt.length, txt.indexOf('recordId')+100));
        results.push({idx:i, matches:'recordId: ' + ri});
      }
      
      // Search for take
      if (txt.indexOf('take') >= 0) {
        var ta = txt.substring(Math.max(0, txt.indexOf('take')-50), Math.min(txt.length, txt.indexOf('take')+200));
        results.push({idx:i, matches:'take: ' + ta});
      }
    }
    return { count: results.length, items: results };
  });
  console.log('\nFOUND:');
  found.items.forEach(function(f) { console.log('  [' + f.idx + '] ' + f.matches); });
  
  // Also check window variables
  var winVars = await pf.evaluate(function() {
    var vars = {};
    ['signId', 'recordId', 'studyCode', 'videoId', 'token', 'serverUrl'].forEach(function(k) {
      if (window[k] !== undefined) vars[k] = window[k];
    });
    // Search window for any init-like objects
    for (var k in window) {
      if (k.indexOf('init') >= 0 || k.indexOf('INIT') >= 0 || k.indexOf('config') >= 0) {
        try { vars[k] = typeof window[k]; } catch(e) { vars[k] = 'error'; }
      }
    }
    return vars;
  });
  console.log('\nWINDOW VARS:', JSON.stringify(winVars));
  
  // Check chplayer source
  var srcInfo = await pf.evaluate(function() {
    var s = document.querySelectorAll('script');
    for (var i = 0; i < s.length; i++) {
      if (s[i].src && s[i].src.indexOf('chplayer') >= 0) {
        // Check if full.js or full2.js is already loaded
        return 'chplayer src=' + s[i].src;
      }
    }
    return 'no chplayer';
  });
  console.log('CHPLAYER: ' + srcInfo);
  
  // Look for the init resource (full.js / full2.js)
  var initScripts = await pf.evaluate(function() {
    var s = document.querySelectorAll('script[src*="full"]');
    var list = [];
    for (var i = 0; i < s.length; i++) {
      list.push(s[i].src);
    }
    return list;
  });
  console.log('INIT SCRIPTS:', initScripts);
  
  await sl(100000);
  await ctx.close();
})();
