// Reuse existing Chrome to diagnose - no captcha needed
// Finds a launched Playwright Chrome window and diagnoses it
const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log('[' + new Date().toLocaleTimeString() + '] ' + m);

(async function() {
  // Try connecting to existing Chrome via CDP
  // Launch a new one with remote debugging port to check
  log('Checking running Chrome instances...');
  
  // Let's try a different approach: connect to an existing Chrome that has user data
  // First, let's launch a new instance but REUSE login by loading storage state
  
  // Actually, let me just launch fresh, it's faster than debugging
  var browser = await chromium.launch({ 
    headless: false,
    executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'
  });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();
  
  // Capture ALL page errors
  p.on('pageerror', function(err) { log('PAGE_ERROR: ' + err.message.substring(0, 200)); });
  p.on('console', function(msg) { 
    var t = msg.text();
    if (t.indexOf('error') >= 0 || t.indexOf('Error') >= 0 || t.indexOf('Hichina') >= 0 || t.indexOf('player') >= 0 || t.indexOf('play') >= 0)
      log('CONSOLE: ' + t.substring(0, 150)); 
  });
  
  // Navigate directly to video page (will need login)
  await p.goto('https://gp.hst360.com/index.html#/v_video?sectionId=2026af7e9b8dce964ebdab00c0647155de76_f11815ed-f859-4663-a2f1-2fb351d249eb_0&courseId=f11815ed-f859-4663-a2f1-2fb351d249eb&trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', { waitUntil: 'load', timeout: 30000 });
  
  // Check if we're logged in or need to login
  await sl(3000);
  log('URL: ' + p.url().substring(0, 100));
  
  // Check if we see the video page directly
  var isLoggedIn = p.url().includes('v_video');
  log('Logged in: ' + isLoggedIn);
  
  if (!isLoggedIn) {
    log('Need login - checking captcha file');
    // The login captcha might still be in the file from prev run
    var code = require('fs').readFileSync('C:/Users/Administrator/.openclaw/workspace/captcha_input.txt', 'utf8').trim();
    log('Last captcha: ' + code);
  }
  
  await sl(30000);
  log('Final URL: ' + p.url().substring(0, 120));
  log('Frames: ' + p.frames().length);
  for (var f of p.frames()) {
    try { log('  ' + f.url().substring(0, 100)); } catch(e) {}
  }
  
  await browser.close();
})();
