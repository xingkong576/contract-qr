const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/getid_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

(async () => {
  fs.writeFileSync(LF, '');
  log('=== GET USER ID ===');
  var raw = fs.readFileSync(JD, 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  var PLAN = 'af7e9b8dce964ebdab00c0647155de76';

  var b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); var p = await ctx.newPage();

  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null; for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 }); var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_getid2.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var li = false; for (var w = 0; w < 30; w++) { if (p.url().includes('v_trainplan_list') || p.url().includes('v_selected_course')) { li = true; break; } await sl(1000); }
  if (!li) { await p.evaluate(function() { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); } log('In');
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el) { return el.textContent.includes('\u53bb\u5b66\u4e60'); }); if (b) b.click(); }); await sl(8000);

  // Get user info from the page
  var userInfo = await p.evaluate(function() {
    var r = {};
    var keys = Object.keys(window).filter(function(k) { return k.toLowerCase().includes('user') || k.toLowerCase().includes('sign') || k.toLowerCase().includes('account'); });
    r.windowVars = keys.slice(0, 10);
    // Check Vue store
    try {
      var app = document.querySelector('#app');
      if (app && app.__vue__) {
        r.vueKeys = Object.keys(app.__vue__).filter(function(k) { return k.toLowerCase().includes('user') || k.toLowerCase().includes('sign') || k.includes('$'); });
      }
    } catch(e) { r.vueErr = e.message; }
    // Check localStorage for user info
    r.lsKeys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.toLowerCase().includes('user') || key.toLowerCase().includes('account') || key.toLowerCase().includes('sign')) {
        r.lsKeys.push(key + ':' + localStorage.getItem(key).substring(0, 50));
      }
    }
    // Check sessionStorage
    r.ssKeys = [];
    for (var i = 0; i < sessionStorage.length; i++) {
      var key = sessionStorage.key(i);
      if (key.toLowerCase().includes('user') || key.toLowerCase().includes('account') || key.toLowerCase().includes('sign')) {
        r.ssKeys.push(key + ':' + sessionStorage.getItem(key).substring(0, 50));
      }
    }
    // Get some text that might contain username
    var texts = Array.from(document.querySelectorAll('span, div, li, a')).filter(function(el) { return el.textContent.includes('6227') || el.textContent.includes('水洛') || el.textContent.includes('庄浪'); }).map(function(el) { return el.textContent.substring(0, 50); });
    r.userTexts = texts.slice(0, 5);
    return r;
  });
  log('User info:');
  for (var k in userInfo) log('  ' + k + ': ' + JSON.stringify(userInfo[k]));

  // Now go to course 1 and open a chapter to find signId in popup
  var course = courses[0];
  await p.evaluate(function(o) {
    var r = document.querySelector('#app').__vue__.$router;
    r.push({path: '/v_courseDetails', query: {trainplanId: o.p, platformId: '154', courseId: o.c}});
  }, {p: PLAN, c: course.courseId});
  await sl(5000);

  var popupP = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
  await p.evaluate(function() { var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (btns[2]) btns[2].click(); });
  var popup = await popupP; await popup.waitForLoadState(); await sl(5000);
  log('Popup opened');

  // Get signId from popup page
  var popupInfo = await p.evaluate(function() {
    var r = {};
    try {
      var app = document.querySelector('#app').__vue__;
      if (app && app.$route) {
        r.route = app.$route.fullPath;
        r.query = JSON.stringify(app.$route.query);
      }
      // Try to find user info in the Vue instance or store
      for (var key in app) {
        if (typeof app[key] === 'object' && app[key] !== null) {
          var val = JSON.stringify(app[key]).substring(0, 100);
          if (val.includes('622726') || val.includes('signId') || val.includes('userId')) {
            r['vue_' + key] = val.substring(0, 200);
          }
        }
      }
    } catch(e) { r.err = e.message; }
    return r;
  });
  log('Popup info: ' + JSON.stringify(popupInfo));

  // Check popup frames for user identity
  for (var fi = 0; fi < popup.frames().length; fi++) {
    try {
      var furi = popup.frames()[fi].url();
      if (furi.includes('content.hst360.com/videoPlay')) {
        var info = await popup.frames()[fi].evaluate(function() {
          var r = {};
          // Check window for user info
          for (var k in window) {
            if (k.toLowerCase().includes('user') || k.toLowerCase().includes('sign') || k.toLowerCase().includes('account') || k.toLowerCase().includes('name')) {
              r[k] = window[k] !== null && typeof window[k] === 'object' ? JSON.stringify(window[k]).substring(0, 100) : String(window[k]).substring(0, 50);
            }
          }
          return r;
        });
        log('Player frame user: ' + JSON.stringify(info));
        break;
      }
    } catch(e) {}
  }

  // Try calling the progress API with a guess for signId
  var bizUrl = 'https://rxlog.chinahrt.com/06e2364df5b84e1bb25225bb00df2135/0d9e041a2c08456fb5ed770e1f8b72f0';
  log('Biz API URL: ' + bizUrl);

  // Try to make a direct API call using fetch
  var testResult = await p.evaluate(function(url) {
    return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}, body: 'userInfo=test&dataId=test&dataType=5&operateType=3&dataRelationId=test&sourceId=4&stayTime=10&actualLearnTime=10'}).then(function(r) { return r.text(); }).catch(function(e) { return 'err: ' + e.message; });
  }, bizUrl);
  log('Test call: ' + testResult);

  await sl(3000);
  log('=== DONE ===');
})().catch(function(e) { log('FATAL: ' + e.message); });
