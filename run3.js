const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/run3_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };
const PLAN_ID = 'af7e9b8dce964ebdab00c0647155de76';

function getPF(popup) {
  var frames = popup.frames();
  for (var i = 0; i < frames.length; i++) {
    try { if (frames[i].url().includes('content.hst360.com/videoPlay')) return frames[i]; } catch (e) {}
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
  if (chapters.length === 0) { log('All done'); return; }
  log('Chaps: ' + chapters.length);
  chapters.forEach(c => log('  ' + c.name + ' [' + c.status + ']'));

  for (var ci = 0; ci < chapters.length; ci++) {
    var ch = chapters[ci];
    log('>> ' + ch.name);

    var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
    await p.evaluate(idx => { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (b[idx]) b[idx].click(); }, ch.idx);
    var popup = await popupP;
    try { await popup.waitForLoadState('load', { timeout: 20000 }); } catch (e) {}
    await sl(6000);

    // Look for "继续学习" or "播放" button in popup
    var playBtn = false;
    try {
      var bt = await popup.evaluate(() => {
        var r = [];
        var all = document.querySelectorAll('button, a, span, div');
        for (var el of all) {
          var t = (el.textContent || '').trim();
          if (t.includes('\u7ee7\u7eed') || t.includes('\u64ad\u653e') || t === '\u25b6' || el.className.includes('plainStudy')) {
            r.push({ tag: el.tagName, text: t.substring(0, 15), cls: el.className.substring(0, 40) });
            if (r.length >= 5) break;
          }
        }
        return r;
      });
      log('PlayBtns: ' + JSON.stringify(bt));
      if (bt && bt.length > 0) {
        await popup.evaluate(() => {
          var all = document.querySelectorAll('button, a, span, div');
          for (var el of all) {
            var t = (el.textContent || '').trim();
            if (t.includes('\u7ee7\u7eed') || t.includes('\u64ad\u653e') || el.className.includes('plainStudy')) {
              el.click(); return;
            }
          }
        });
        playBtn = true;
        log('Clicked play btn');
        await sl(5000);
      }
    } catch (e) { log('Btn err: ' + e.message.substring(0, 50)); }

    // Wait for player iframe
    var pf = null;
    for (var w = 0; w < 15; w++) {
      pf = getPF(popup);
      if (pf) break;
      await sl(2000);
    }
    if (!pf) { log('NO PF'); try { popup.close(); } catch (e) {} continue; }
    log('PF found');

    // Play video in player iframe
    try {
      var r = await pf.evaluate(() => {
        // Method 1: Click DPlayer play button
        var icons = document.querySelectorAll('.dplayer-play-icon, [class*=dplayer-play], .dplayer-play');
        for (var icon of icons) { icon.click(); }
        // Method 2: Click video
        var v = document.querySelector('video');
        if (!v) return 'no video';
        v.muted = false;
        v.playbackRate = 8;
        try { v.playbackRate = 16; } catch (e) {}
        v.play();
        return 'playing';
      });
      log('Play: ' + r);
    } catch (e) { log('Play err: ' + e.message.substring(0, 60)); }

    // Monitor
    var monitorOk = false;
    for (var mt = 0; mt < 600; mt++) {
      try {
        var pf2 = getPF(popup);
        if (!pf2) { if (mt > 0) { log('PF lost'); break; } else continue; }
        var vs = await pf2.evaluate(() => {
          var v = document.querySelector('video'); if (!v) return null;
          return { pct: Math.round(v.currentTime / v.duration * 100), paused: v.paused, ended: v.ended, cur: Math.floor(v.currentTime), rate: v.playbackRate };
        });
        if (!vs) { log('No video'); await sl(5000); continue; }
        if (mt % 2 === 0) log('  ' + vs.pct + '% (' + Math.floor(vs.cur / 60) + 'm) ' + vs.rate + 'x');
        if (vs.ended || vs.pct >= 99) { log('DONE'); await sl(2000); break; }
        if (vs.paused) {
          await pf2.evaluate(() => { var v = document.querySelector('video'); if (v && v.paused) { v.playbackRate = 8; v.play(); } });
        }
        monitorOk = true;
      } catch (e) {
        if (mt > 2) { log('Monitor err: ' + e.message.substring(0, 40)); break; }
      }
      await sl(30000);
    }

    if (!monitorOk) {
      log('No monitor, trying basic play');
      try {
        var pf3 = getPF(popup);
        if (pf3) await pf3.evaluate(() => { var v = document.querySelector('video'); if (v) { v.playbackRate = 4; v.play(); } });
        await sl(30000);
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

  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_run3.png' });
  log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  var li = false;
  for (var w = 0; w < 30; w++) { var url = p.url(); if (url.includes('v_trainplan_list') || url.includes('v_selected_course')) { li = true; break; } await sl(1000); }
  if (!li) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); }
  log('In');
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); });
  await sl(8000);
  log('At courses');

  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log('\nSKIP ' + c.courseName); continue; }
    await studyCourse(p, c, PLAN_ID);
    await p.evaluate(() => { document.querySelector('#app').__vue__.$router.push({ path: '/v_selected_course', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154' } }); });
    await sl(5000);
  }

  log('\n=== ALL DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
