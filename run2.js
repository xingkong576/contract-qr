const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/run2_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };
const PLAN_ID = 'af7e9b8dce964ebdab00c0647155de76';

function findPlayerFrame(popup) {
  // Frame 1 is always content.hst360.com (the video player)
  var frames = popup.frames();
  for (var i = 0; i < frames.length; i++) {
    try { if (frames[i].url().includes('content.hst360.com')) return frames[i]; } catch (e) {}
  }
  return null;
}

async function studyCourse(p, course, planId) {
  log('\n=== ' + course.courseName + ' (' + course.learnPercent + '%) ===');
  if (parseInt(course.learnPercent) >= 100) { log('SKIP'); return; }

  await p.evaluate(o => { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: o.planId, platformId: '154', courseId: o.courseId } }); }, { planId, courseId: course.courseId });
  await sl(5000);

  var chapters = await p.evaluate(() => {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles = document.querySelectorAll('a.titlecolor.text');
    var list = [];
    for (var i = 0; i < btns.length; i++) {
      var t = btns[i].textContent.trim();
      if (!t.includes('\u5df2\u5b66\u5b8c')) list.push({ idx: i, name: (titles[i] ? titles[i].textContent.trim() : '?').substring(0, 35), status: t });
    }
    return list;
  });
  if (chapters.length === 0) { log('All chaps done'); return; }
  log('Chapters: ' + chapters.length);
  chapters.forEach((c, i) => log('  ' + i + ': ' + c.name + ' [' + c.status + ']'));

  for (var ci = 0; ci < chapters.length; ci++) {
    var ch = chapters[ci];
    log('>> ' + ch.name);

    var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
    await p.evaluate(idx => { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, ch.idx);
    var popup = await popupP;
    try { await popup.waitForLoadState('load', { timeout: 20000 }); } catch (e) {}
    await sl(5000);
    log('Popup opened');

    // Find player iframe
    var pf = findPlayerFrame(popup);
    if (!pf) { log('NO PLAYER FRAME'); try { popup.close(); } catch (e) {} continue; }
    log('Player frame found');

    // Try to play with DPlayer API or direct video
    var playOk = false;
    try {
      // Method 1: Use DPlayer API directly
      var r1 = await pf.evaluate(() => {
        // Try to find DPlayer instance
        var dp = window.dplayer || window.DPlayer;
        // Try chplayer (chinahrt platform)
        var cp = window.chplayer || window.chPlayer || window.dp;
        // Try to get video and observe
        var v = document.querySelector('video');
        if (!v) return 'no video';
        // Use chplayer API if available
        if (typeof cp !== 'undefined' && cp !== null) {
          if (typeof cp.setSpeed === 'function') { cp.setSpeed(8); }
          if (typeof cp.seek === 'function') { /* don't seek */ }
          if (typeof cp.play === 'function') { cp.play(); }
          return 'cp api used';
        }
        // Direct video control
        v.muted = false;
        v.playbackRate = 8;
        try { v.playbackRate = 16; } catch (e) {}
        v.play();
        return 'direct';
      });
      log('Play1: ' + r1);
      playOk = true;
    } catch (e) { log('Play1 err: ' + e.message.substring(0, 60)); }

    // Wait a moment then check
    await sl(3000);

    // Monitor
    var monitored = false;
    for (var mt = 0; mt < 600; mt++) {
      var vs = null;
      try { vs = await pf.evaluate(() => { var v = document.querySelector('video'); if (!v) return null; return { pct: Math.round(v.currentTime / v.duration * 100), paused: v.paused, ended: v.ended, cur: Math.floor(v.currentTime), rate: v.playbackRate }; }); } catch (e) {}
      if (!vs) {
        // Check if popup is still open
        try { await popup.title; } catch (e) { log('Popup closed'); break; }
        // Try to find video again
        pf = findPlayerFrame(popup);
        if (!pf) { log('Frame lost'); break; }
        try {
          var still = await pf.evaluate(() => { return document.querySelector('video') ? 'found' : 'gone'; });
          if (still === 'gone') { log('Video gone'); break; }
        } catch (e) { log('Frame err'); break; }
        continue;
      }
      if (mt % 2 === 0) log('  ' + vs.pct + '% (' + Math.floor(vs.cur / 60) + 'm) rate=' + vs.rate + 'x');
      if (vs.ended || vs.pct >= 99) { log('DONE'); await sl(2000); break; }
      if (vs.paused) {
        try { await pf.evaluate(() => { var v = document.querySelector('video'); if (v && v.paused) v.play(); }); } catch (e) {}
      }
      monitored = true;
      await sl(30000); // check every 30s
    }

    if (!monitored) {
      // Try once more to play
      try {
        var r2 = await pf.evaluate(() => {
          var v = document.querySelector('video');
          if (!v) return 'no video';
          if (v.paused) { v.playbackRate = 8; v.play(); }
          return 'retry ' + v.paused;
        });
        log('Retry: ' + r2);
      } catch (e) {}
    }

    try { popup.close(); } catch (e) {}
    await sl(2000);
  }
}

(async () => {
  fs.writeFileSync(LF, '');
  log('=== START ===');

  var raw = fs.readFileSync(JD, 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);

  var b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_run2.png' });
  log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var loggedIn = false;
  for (var w = 0; w < 30; w++) { var url = p.url(); if (url.includes('v_trainplan_list') || url.includes('v_selected_course')) { loggedIn = true; break; } await sl(1000); }
  if (!loggedIn) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); }
  log('In');
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); });
  await sl(8000);
  log('At courses');

  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    await studyCourse(p, c, PLAN_ID);
    await p.evaluate(() => { document.querySelector('#app').__vue__.$router.push({ path: '/v_selected_course', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154' } }); });
    await sl(5000);
  }

  log('\n=== ALL DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
