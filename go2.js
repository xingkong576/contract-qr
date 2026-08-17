const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/go2_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

function getPF(popup) {
  var frames = popup.frames();
  for (var i = 0; i < frames.length; i++) {
    try { if (frames[i].url().includes('content.hst360.com/videoPlay')) return frames[i]; } catch (e) {}
  }
  return null;
}

async function studyCourse(p, course) {
  log('\n=== ' + course.courseName + ' (' + course.learnPercent + '%) ===');
  if (parseInt(course.learnPercent) >= 100) { log('SKIP'); return; }

  await p.evaluate(function(o) { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: o.p, platformId: '154', courseId: o.c } }); }, { p: PLAN, c: course.courseId });
  await sl(5000);

  var chapters = await p.evaluate(function() {
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles = document.querySelectorAll('a.titlecolor.text');
    var list = [];
    for (var i = 0; i < btns.length; i++) {
      if (!btns[i].textContent.includes('\u5df2\u5b66\u5b8c')) list.push({ idx: i, name: (titles[i] ? titles[i].textContent.trim() : '?').substring(0, 30) });
    }
    return list;
  });
  if (chapters.length === 0) { log('All done'); return; }
  log('Chaps: ' + chapters.length);
  chapters.forEach(function(c, i) { log('  ' + i + ': ' + c.name); });

  for (var ci = 0; ci < chapters.length; ci++) {
    var ch = chapters[ci];
    log('>> ' + ch.name);

    var popupP = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
    await p.evaluate(function(idx) { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, ch.idx);
    var popup = await popupP;
    try { await popup.waitForLoadState('load', { timeout: 20000 }); } catch (e) {}
    await sl(6000);
    log('Popup');

    // Wait for player iframe
    var pf = null;
    for (var w = 0; w < 20; w++) { pf = getPF(popup); if (pf) break; await sl(1000); }
    if (!pf) { log('NO PF'); try { popup.close(); } catch (e) {} continue; }
    log('PF');

    // Don't call v.play() directly - click DPlayer's play button instead
    // This triggers the normal player flow without detection
    try {
      var pr = await pf.evaluate(function() {
        // Click DPlayer play button (the big center play icon)
        var playBtns = document.querySelectorAll('.dplayer-play-icon, .dplayer-mobile-play, .dplayer-bezel-icon, [class*=dplayer-play]');
        for (var b of playBtns) {
          if (b.offsetParent !== null) { b.click(); return 'clicked play btn'; }
        }
        // Try clicking the video container
        var vw = document.querySelector('.dplayer-video-wrap');
        if (vw) { vw.click(); return 'clicked video wrap'; }
        // Last resort: click actual video
        var v = document.querySelector('video');
        if (v) { v.click(); return 'clicked video'; }
        return 'nothing found';
      });
      log('Play: ' + pr);
    } catch (e) { log('Play err: ' + e.message.substring(0, 60)); }

    // Let the player handle everything - just monitor for video end
    await sl(5000);
    var ok = false;
    for (var mt = 0; mt < 600; mt++) {
      var pf2 = getPF(popup);
      if (!pf2) { log('PF lost' + (ok ? ' (completed?)' : '')); break; }
      try {
        var vs = await pf2.evaluate(function() {
          var v = document.querySelector('video'); if (!v) return null;
          return { pct: Math.round(v.currentTime / v.duration * 100), paused: v.paused, ended: v.ended, cur: Math.floor(v.currentTime) };
        });
        if (!vs) { await sl(5000); continue; }
        if (mt % 4 === 0) log('  ' + vs.pct + '% (' + Math.floor(vs.cur / 60) + 'm)');
        if (vs.ended || vs.pct >= 99) { log('DONE'); await sl(3000); break; }
        ok = true;
      } catch (e) {}
      await sl(30000);
    }

    try { popup.close(); } catch (e) {}
    await sl(2000);
  }
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== GO2 ===');
  var raw = fs.readFileSync(JD, 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);

  var b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null; for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 }); var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_go2.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var li = false; for (var w = 0; w < 30; w++) { if (p.url().includes('v_trainplan_list') || p.url().includes('v_selected_course')) { li = true; break; } await sl(1000); }
  if (!li) { await p.evaluate(function() { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); } log('In');
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el) { return el.textContent.includes('\u53bb\u5b66\u4e60'); }); if (b) b.click(); }); await sl(8000);

  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    await studyCourse(p, c);
    await p.evaluate(function() { document.querySelector('#app').__vue__.$router.push({ path: '/v_selected_course', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154' } }); });
    await sl(5000);
  }

  log('\n=== ALL DONE ===');
})().catch(function(e) { log('FATAL: ' + e.message); });
