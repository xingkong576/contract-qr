const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/run4_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

(async () => {
  fs.writeFileSync(LF, '');
  log('=== FINAL ===');

  var raw = fs.readFileSync(JD, 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);

  var b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null; for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 }); var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_final.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var li = false; for (var w = 0; w < 30; w++) { var url = p.url(); if (url.includes('v_trainplan_list') || url.includes('v_selected_course')) { li = true; break; } await sl(1000); }
  if (!li) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); } log('In');
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); }); await sl(8000);

  // Capture progress API from player iframe
  var progressAPIs = [];

  // Go to course 1, first incomplete chapter
  var course = courses.find(c => parseInt(c.learnPercent) < 100) || courses[0];
  log('Target: ' + course.courseName);
  await p.evaluate(o => { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: o.planId, platformId: '154', courseId: o.courseId } }); }, { planId: 'af7e9b8dce964ebdab00c0647155de76', courseId: course.courseId }); await sl(5000);

  var chTgt = await p.evaluate(() => {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles = document.querySelectorAll('a.titlecolor.text');
    for (var i = 0; i < btns.length; i++) { if (!btns[i].textContent.includes('\u5df2\u5b66\u5b8c')) return { idx: i, name: titles[i] ? titles[i].textContent.trim() : '?' }; }
    return null;
  });
  if (!chTgt) { log('No incomplete chapters'); return; }
  log('Chap: ' + chTgt.name);

  // Click to open popup
  var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
  await p.evaluate(idx => { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, chTgt.idx);
  var popup = await popupP; await popup.waitForLoadState(); await sl(5000); log('Popup opened');

  // Capture ALL network from popup
  popup.on('response', async r => {
    try {
      var u = r.url();
      if (!u.includes('/gp6/') && !u.includes('hst360') && !u.includes('businesslog') && !u.includes('chinahrt')) return;
      if (u.includes('.js') || u.includes('.css') || u.includes('.png') || u.includes('.jpg')) return;
      var txt = await r.text();
      // Focus on progress/study/video APIs
      if (u.includes('study') || u.includes('progress') || u.includes('learn') || u.includes('save') || u.includes('complete') || u.includes('record') || u.includes('business') || u.includes('heart') || u.includes('play')) {
        log('PROGRESS API: ' + u);
        log('  BODY: ' + txt.substring(0, 500));
        progressAPIs.push({ url: u, body: txt.substring(0, 1000) });
      }
    } catch (e) {}
  });

  // Also capture content.hst360.com APIs from player frame
  var playerFrame = null;
  for (var fi = 0; fi < popup.frames().length; fi++) {
    try { if (popup.frames()[fi].url().includes('content.hst360.com/videoPlay')) { playerFrame = popup.frames()[fi]; break; } } catch (e) {}
  }

  if (playerFrame) {
    log('Player frame found, setting up API capture');
    playerFrame.on('response', async r => {
      try {
        var u = r.url();
        if (u.includes('study') || u.includes('progress') || u.includes('learn') || u.includes('save') || u.includes('complete') || u.includes('record') || u.includes('heart') || u.includes('business')) {
          var txt = await r.text();
          log('PLAYER API: ' + u.substring(50, 180));
          log('  BODY: ' + txt.substring(0, 500));
          progressAPIs.push({ url: u, body: txt.substring(0, 1000) });
        }
      } catch (e) {}
    });
  }

  // Play video at normal speed (1x)
  if (playerFrame) {
    try {
      var pr = await playerFrame.evaluate(() => {
        var v = document.querySelector('video');
        if (!v) return 'no video';
        // Check for detection/alert dialog
        var dialog = document.querySelector('.el-dialog, .el-message-box, [class*=dialog]');
        if (dialog) {
          // Click dialog OK/close button
          var dlgBtns = dialog.querySelectorAll('button, .el-button--primary, .el-dialog__headerbtn');
          for (var btn of dlgBtns) { btn.click(); }
          return 'dialog found and closed';
        }
        v.playbackRate = 1; // normal speed
        v.play();
        return 'playing at 1x';
      });
      log('Play: ' + pr);
    } catch (e) { log('Play err: ' + e.message.substring(0, 60)); }
  }

  // Monitor for 2 minutes to catch APIs + ensure video plays
  log('Monitoring 2 min for progress APIs...');
  for (var i = 0; i < 12; i++) {
    await sl(10000);
    var status = 'running';
    try {
      if (playerFrame) {
        status = await playerFrame.evaluate(() => {
          var v = document.querySelector('video');
          if (!v) return 'no video';
          return Math.floor(v.currentTime) + '/' + Math.floor(v.duration) + ' p=' + v.paused;
        });
      }
    } catch (e) { status = 'frame err'; }
    log('  ' + ((i+1)*10) + 's: ' + status + ' | APIs=' + progressAPIs.length);
  }

  // Save captured APIs
  fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/progress_apis.json', JSON.stringify(progressAPIs, null, 2));
  log('Saved progress_apis.json (' + progressAPIs.length + ' APIs)');
  log('=== DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
