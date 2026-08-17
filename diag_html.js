const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log('[' + new Date().toLocaleTimeString() + '] ' + m);

(async function() {
  var browser = await chromium.launch({ headless: false });
  var p = await browser.newPage();
  
  // Just need the iframe HTML - navigate directly to a known video page
  // Using the sectionId from the first chapter of course 2
  var sectionId = '2026af7e9b8dce964ebdab00c0647155de76_a5b20c83fded44cb96c3e31ec409f8a0_0';
  var courseId = 'a5b20c83fded44cb96c3e31ec409f8a0';
  
  await p.goto('https://gp.hst360.com/index.html#/v_video?sectionId='+sectionId+'&courseId='+courseId+'&trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', {waitUntil:'load',timeout:30000});
  await sl(10000);
  
  // Find iframe
  var pf = null;
  for (var i = 0; i < 30; i++) {
    for (var f of p.frames()) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  
  if (!pf) { log('No PF - need login'); var u = p.url(); log('URL: '+u); await sl(60000); log('After wait URL: '+p.url()); await browser.close(); return; }
  
  log('PF URL: ' + pf.url().substring(0, 120));
  
  // Get page source HTML
  var html = await pf.evaluate(function() { return document.documentElement.outerHTML.substring(0, 5000); });
  log('HTML (first 5000 chars):\n' + html);
  
  // Try to find token via various methods
  var tokenInfo = await pf.evaluate(function() {
    var results = {};
    
    // 1. Check if there's a script with HichinaPlayer init
    var scripts = document.querySelectorAll('script');
    results.scriptCount = scripts.length;
    results.tokenInScripts = [];
    for (var s of scripts) {
      var txt = s.textContent || '';
      if (txt.length > 50 && (txt.indexOf('token') >= 0 || txt.indexOf('take') >= 0)) {
        results.tokenInScripts.push(txt.substring(0, 300));
      }
    }
    
    // 2. Check URL params
    results.urlParams = {};
    var url = new URL(location.href);
    url.searchParams.forEach(function(v, k) { results.urlParams[k] = v; });
    
    // 3. Check localStorage
    results.lsKeys = Object.keys(localStorage);
    
    // 4. Check sessionStorage  
    results.ssKeys = Object.keys(sessionStorage);
    
    // 5. Check all window keys for DPlayer related stuff
    results.windowKeysWithVideo = [];
    for (var k in window) {
      try {
        var obj = window[k];
        if (obj && typeof obj === 'object' && !(obj instanceof Node) && k[0] !== '$') {
          var keys = Object.keys(obj);
          if (keys.indexOf('video') >= 0 && keys.indexOf('options') >= 0) {
            results.windowKeysWithVideo.push(k);
            if (obj.options && obj.options.take) results['token_' + k] = obj.options.take.token;
          }
        }
      } catch(e) {}
    }
    
    // 6. Get all script src attributes
    results.scriptSrcs = [];
    for (var s of document.querySelectorAll('script[src]')) {
      results.scriptSrcs.push(s.getAttribute('src'));
    }
    
    return results;
  });
  
  log('\nToken info: ' + JSON.stringify(tokenInfo, null, 2));
  
  // Try to get video element info
  try {
    var videoInfo = await pf.evaluate(function() {
      var v = document.querySelector('video');
      if (!v) return 'no video';
      return {
        exists: true,
        readyState: v.readyState,
        networkState: v.networkState,
        error: v.error ? v.error.message : null,
        duration: v.duration,
        currentTime: v.currentTime,
        src: (v.src || '').substring(0, 80),
        playbackRate: v.playbackRate
      };
    });
    log('\nVideo: ' + JSON.stringify(videoInfo));
  } catch(e) { log('Video err: ' + e.message.substring(0,60)); }
  
  await browser.close();
})();
