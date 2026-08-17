// SUPER simple: just open popup, find DPlayer, set 16x, report what happened
// No full automation - just one video
const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log('[' + new Date().toLocaleTimeString() + '] ' + m);

(async function() {
  var browser = await chromium.launch({ headless: false });
  var p = await browser.newPage();
  
  // Navigate directly to video page  
  log('Navigating...');
  await p.goto('https://gp.hst360.com/index.html#/v_video?sectionId=2026af7e9b8dce964ebdab00c0647155de76_f11815ed-f859-4663-a2f1-2fb351d249eb_0&courseId=f11815ed-f859-4663-a2f1-2fb351d249eb&trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154');
  await sl(10000);
  
  // Wait for iframe
  var pf = null;
  for (var i = 0; i < 30; i++) {
    var frames = p.frames();
    for (var f of frames) {
      try { if (f.url().includes('content.hst360.com/videoPlay')) { pf = f; break; } } catch(e) {}
    }
    if (pf) break;
    await sl(1000);
  }
  
  if (!pf) { log('No PF'); await browser.close(); return; }
  log('PF: ' + pf.url().substring(0, 100));
  
  // Find DPlayer instance
  var diag = await pf.evaluate(function() {
    var v = document.querySelector('video');
    var results = {};
    
    if (!v) { results.error = 'no video'; return results; }
    results.videoExists = true;
    
    // Search ALL window properties for DPlayer instance
    var candidates = [];
    for (var k in window) {
      try {
        var obj = window[k];
        if (obj && typeof obj === 'object' && !(obj instanceof Node) && k !== 'constructor' && k !== '__proto__') {
          if (obj.video === v || (obj.video && obj.video.tagName === 'VIDEO')) {
            candidates.push({ key: k, hasSpeed: typeof obj.speed === 'function', hasStatus: !!obj.status_data, hasTake: !!(obj.options && obj.options.take) });
          }
        }
      } catch(e) {}
    }
    results.candidates = candidates;
    
    // Check container properties
    var container = document.querySelector('.dplayer');
    if (container) {
      var props = [];
      // Check all custom properties 
      for (var k2 in container) {
        if (!k2.startsWith('on') && k2 !== 'constructor' && k2 !== '__proto__') props.push(k2);
      }
      // Also check data attributes
      var dataAttrs = {};
      for (var d of (container.dataset ? Object.keys(container.dataset) : [])) dataAttrs[d] = container.dataset[d];
      results.containerProps = props;
      results.dataset = dataAttrs;
    }
    
    // Check jQuery
    if (window.jQuery) {
      try {
        var $data = window.jQuery(v).data();
        results.jQueryData = Object.keys($data);
      } catch(e) { results.jQueryErr = e.message; }
    }
    
    // Check video element properties (non-standard)
    var vKeys = [];
    for (var vk in v) {
      if (!HTMLVideoElement.prototype.hasOwnProperty(vk) && !HTMLElement.prototype.hasOwnProperty(vk) && !Element.prototype.hasOwnProperty(vk) && !Node.prototype.hasOwnProperty(vk) && !EventTarget.prototype.hasOwnProperty(vk)) {
        vKeys.push(vk);
      }
    }
    results.videoExtraProps = vKeys;
    
    // Try to find player by searching through DPlayer prototype
    if (window.HichinaPlayer && window.HichinaPlayer.prototype) {
      results.hasDPlayerProto = true;
      results.protoKeys = Object.getOwnPropertyNames(window.HichinaPlayer.prototype).join(',');
    }
    
    return results;
  });
  
  log(JSON.stringify(diag, null, 2));
  
  // Now try clicking play
  try {
    var r = await pf.evaluate(function() {
      var v = document.querySelector('video');
      if (!v) return 'no video';
      v.play();
      return 'played';
    });
    log('Play: ' + r);
  } catch(e) { log('Play err: ' + e.message.substring(0,60)); }
  
  await sl(30000);
  log('Check 30s later...');
  
  var diag2 = await pf.evaluate(function() {
    var v = document.querySelector('video');
    if (!v) return { error: 'no video', url: location.href.substring(0,100) };
    return {
      ct: Math.floor(v.currentTime),
      dur: Math.floor(v.duration),
      pct: v.duration ? Math.round(v.currentTime / v.duration * 100) : 0,
      rate: v.playbackRate,
      paused: v.paused,
      url: location.href.substring(0,100)
    };
  });
  log(JSON.stringify(diag2, null, 2));
  
  // Now try 16x - 方法: 设置video.playbackRate同时修补getter
  log('Trying 16x with getter patch...');
  await pf.evaluate(function() {
    var v = document.querySelector('video');
    if (!v) return;
    
    // 1. Save original descriptor
    var origDescriptor = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'playbackRate');
    var actualRate = 16;
    
    // 2. Set actual speed
    origDescriptor.set.call(v, 16);
    
    // 3. Override on THIS element: getter returns fake for DPlayer check
    Object.defineProperty(v, 'playbackRate', {
      get: function() { 
        // Try to find DPlayer's internal speed
        // For now, always return 16 so the check passes
        return 16; 
      },
      set: function(val) {
        // DPlayer calls this to set speed, BUT we always force 16x
        // Store what DPlayer thinks it set
        var internalRate = 16;
        // Actually set native to 16
        origDescriptor.set.call(v, internalRate);
      },
      configurable: true
    });
  });
  
  await sl(60000);
  
  var diag3 = await pf.evaluate(function() {
    var v = document.querySelector('video');
    if (!v) return { error: 'no video', url: location.href.substring(0,100) };
    return {
      ct: Math.floor(v.currentTime),
      dur: Math.floor(v.duration),
      pct: v.duration ? Math.round(v.currentTime / v.duration * 100) : 0,
      rate: v.playbackRate,
      paused: v.paused,
      url: location.href.substring(0,100)
    };
  });
  log(JSON.stringify(diag3, null, 2));
  
  // Check if the page is still alive or redirected
  var diag4 = await p.evaluate(function() { return { url: location.href.substring(0,100), title: document.title }; });
  log('Main page: ' + JSON.stringify(diag4));
  
  await browser.close();
})();
