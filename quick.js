const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/quick_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

(async () => {
  fs.writeFileSync(LF, ''); log('=== QUICK ===');

  var raw = fs.readFileSync(JD, 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  var PLAN = 'af7e9b8dce964ebdab00c0647155de76';

  var b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null; for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 }); var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_quick.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var li = false; for (var w = 0; w < 30; w++) { if (p.url().includes('v_trainplan_list') || p.url().includes('v_selected_course')) { li = true; break; } await sl(1000); }
  if (!li) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); } log('In');
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); }); await sl(8000);

  // First, open one popup to find signId/userName
  var course = courses.find(c => parseInt(c.learnPercent) < 100);
  await p.evaluate(o => { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: o.p, platformId: '154', courseId: o.c } }); }, { p: PLAN, c: course.courseId }); await sl(5000);

  var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
  await p.evaluate(() => { var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (btns[2]) btns[2].click(); });
  var popup = await popupP; await popup.waitForLoadState(); await sl(5000);
  log('Popup opened');

  // Get signId from page
  var signId = await p.evaluate(() => {
    // Try to find user info in page
    try {
      var app = document.querySelector('#app').__vue__;
      if (app.$route) return JSON.stringify(app.$route.query);
      if (app.$store) return 'store:' + typeof app.$store.state;
      return 'no data';
    } catch(e) { return 'err: ' + e.message; }
  });
  log('sign info: ' + signId);

  // Extract the signId from the main page URL
  var url = p.url();
  log('URL: ' + url);
  // signId might be in cookies or localStorage
  var storage = await p.evaluate(() => { return JSON.stringify(localStorage); });
  log('localStorage: ' + storage.substring(0, 300));

  // Check user data
  var user = await p.evaluate(() => {
    // Try common patterns
    return {
      userInfo: typeof window.userInfo !== 'undefined' ? JSON.stringify(window.userInfo).substring(0, 200) : 'undef',
      signId: typeof window.signId !== 'undefined' ? window.signId : 'undef',
      _user: typeof window._user !== 'undefined' ? JSON.stringify(window._user).substring(0, 200) : 'undef',
      cookie: document.cookie.substring(0, 200)
    };
  });
  log('User info: ' + JSON.stringify(user));

  await sl(3000);
  log('=== DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
