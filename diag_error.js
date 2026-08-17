const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log(m);

(async function() {
  var browser = await chromium.launch({ headless: false });
  var ctx = await browser.newContext();
  var p = await ctx.newPage();
  
  // Set up route interception first
  var apiCalls = [];
  await p.route('**/*', function(route) {
    var u = route.request().url();
    if (u.indexOf('takeRecord') >= 0 || u.indexOf('error') >= 0 || u.indexOf('close') >= 0 || u.indexOf('fast') >= 0) {
      apiCalls.push({ type: 'req', url: u.substring(0, 120), time: Date.now() });
      log('REQ: ' + u.substring(0, 120));
    }
    route.continue().catch(function(){});
  }, { times: 500 });
  
  // Listen for responses too
  p.on('response', function(resp) {
    var u = resp.url();
    if (u.indexOf('takeRecord') >= 0) {
      log('RESP: ' + u.substring(0, 80) + ' status=' + resp.status());
    }
    if (u.indexOf('error') >= 0) {
      log('ERROR PAGE: ' + u.substring(0, 120));
    }
  });
  
  // Navigate to video page directly
  await p.goto('https://gp.hst360.com/index.html#/v_video?sectionId=2026af7e9b8dce964ebdab00c0647155de76_f11815ed-f859-4663-a2f1-2fb351d249eb_0&courseId=f11815ed-f859-4663-a2f1-2fb351d249eb&trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', { waitUntil: 'load', timeout: 30000 });
  await sl(10000);
  
  // Find iframe
  var pf = null;
  for (var i = 0; i < 30; i++) {
    for (var f of p.frames()) { try { if (f.url().includes('content.hst360.com')) pf = f; } catch(e) {} }
    if (pf) break; await sl(1000);
  }
  if (!pf) { log('NO PF'); await sl(30000); log(p.url()); await browser.close(); return; }
  log('PF: ' + pf.url().substring(0, 100));
  
  await sl(3000);
  
  // Install fix
  var result = await pf.evaluate(function() {
    var v = document.querySelector('video');
    if (!v) return 'no video';
    
    var proto = Object.getPrototypeOf(v);
    var desc;
    while (proto) {
      desc = Object.getOwnPropertyDescriptor(proto, 'playbackRate');
      if (desc && desc.set) break;
      proto = Object.getPrototypeOf(proto);
    }
    if (!desc || !desc.set) return 'no desc proto=' + Object.getPrototypeOf(v).constructor.name;
    
    Object.defineProperty(v, 'playbackRate', {
      get: function() { return 1; },
      set: function(val) { desc.set.call(v, 16); },
      configurable: true
    });
    
    desc.set.call(v, 16);
    
    v.play().catch(function(e) { return 'play_error:' + e.message; });
    return 'ok';
  });
  log('Init: ' + result);
  
  // Monitor for 90 seconds
  for (var i = 0; i < 6; i++) {
    await sl(15000);
    try {
      var st = await pf.evaluate(function() {
        var v = document.querySelector('video');
        if (!v) return { err: 'no video', url: location.href.substring(0, 120) };
        return { ct: Math.floor(v.currentTime), dur: Math.floor(v.duration), pct: Math.round(v.currentTime/v.duration*100), url: location.href.substring(0, 120) };
      });
      log('  ' + JSON.stringify(st));
    } catch(e) {
      log('  Eval failed: ' + (e.message || '').substring(0, 60));
      log('  Page URL: ' + p.url().substring(0, 120));
      // Check all frames
      var frames = p.frames();
      log('  Frames: ' + frames.length);
      for (var f of frames) {
        try { log('    ' + f.url().substring(0, 100)); } catch(e) { log('    [error]'); }
      }
      // Check popup windows
      var pages = browser.contexts()[0].pages();
      log('  Pages: ' + pages.length);
      for (var pg of pages) {
        try { log('    ' + pg.url().substring(0, 120)); } catch(e) { log('    [error]'); }
      }
    }
  }
  
  log('\nAll API calls:');
  apiCalls.forEach(function(a) { log('  ' + a.type + ': ' + a.url); });
  
  await browser.close();
})();
