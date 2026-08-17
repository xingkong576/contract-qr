const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/run_log.txt';
const JD = 'C:/Users/Administrator/.openclaw/workspace/course_data.json';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

// 12 courses from the saved JSON
const COURSES = [];
const PLAN_ID = 'af7e9b8dce964ebdab00c0647155de76';
const PLATFORM_ID = '154';

async function studyCourse(p, course) {
  log('\n  === ' + course.courseName + ' (' + course.learnPercent + '%) ===');
  if (parseInt(course.learnPercent) >= 100) { log('  SKIP (100%)'); return; }

  // Navigate to course details
  await p.evaluate(o => {
    document.querySelector('#app').__vue__.$router.push({
      path: '/v_courseDetails',
      query: { trainplanId: o.planId, platformId: '154', courseId: o.courseId }
    });
  }, { planId: PLAN_ID, courseId: course.courseId });
  await sl(5000);

  // Get uncompleted chapters
  var chapters = await p.evaluate(() => {
    var list = [];
    var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles = document.querySelectorAll('a.titlecolor.text');
    for (var i = 0; i < btns.length; i++) {
      var txt = btns[i].textContent.trim();
      if (!txt.includes('\u5df2\u5b66\u5b8c')) { // 已学完
        list.push({ idx: i, name: titles[i] ? titles[i].textContent.trim().substring(0, 30) : '?', status: txt });
      }
    }
    return list;
  });
  if (chapters.length === 0) { log('  All chapters done'); return; }
  log('  Uncompleted chapters: ' + chapters.length);
  chapters.forEach((c, i) => log('    ' + i + ': ' + c.name + ' [' + c.status + ']'));

  for (var chi = 0; chi < chapters.length; chi++) {
    var ch = chapters[chi];
    log('  >> ' + ch.name);

    // Click chapter button → popup
    var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
    await p.evaluate(idx => {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      if (btns[idx]) btns[idx].click();
    }, ch.idx);
    var popup = await popupP;
    try { await popup.waitForLoadState('load', { timeout: 15000 }); } catch (e) { }
    log('    Popup opened');
    await sl(5000);

    // Find video in popup frames
    var played = false;
    for (var fi = 0; fi < popup.frames().length; fi++) {
      try {
        var vi = await popup.frames()[fi].evaluate(() => {
          var v = document.querySelector('video');
          if (!v) return null;
          v.muted = false;
          v.playbackRate = 8; // 8x speed (most browsers max)
          try { v.playbackRate = 16; } catch (e) {} // try 16x
          v.play();
          return { rate: v.playbackRate, dur: Math.floor(v.duration), cur: Math.floor(v.currentTime), src: (v.querySelector('source') || {}).src || '' };
        });
        if (vi) {
          log('    Video: ' + vi.cur + '/' + vi.dur + 's @ ' + vi.rate + 'x');
          played = true;
          // Monitor loop
          for (var mt = 0; mt < 600; mt++) { // up to 600*30s = 5h per chapter
            var vs = null;
            for (var fi2 = 0; fi2 < popup.frames().length; fi2++) {
              try {
                vs = await popup.frames()[fi2].evaluate(() => {
                  var v = document.querySelector('video');
                  if (!v) return null;
                  return { pct: Math.round(v.currentTime / v.duration * 100), paused: v.paused, ended: v.ended, cur: Math.floor(v.currentTime) };
                });
                if (vs) break;
              } catch (e) {}
            }
            if (!vs) { log('    Video lost'); break; }
            if (mt % 2 === 0) log('    ' + vs.pct + '% (' + Math.floor(vs.cur / 60) + 'm)');
            if (vs.ended || vs.pct >= 99) { log('    DONE'); await sl(2000); break; }
            if (vs.paused) {
              // Resume playback
              for (var fi3 = 0; fi3 < popup.frames().length; fi3++) {
                try {
                  await popup.frames()[fi3].evaluate(() => {
                    var v = document.querySelector('video');
                    if (v && v.paused) v.play();
                  });
                } catch (e) {}
              }
            }
            await sl(30000); // check every 30s
          }
          break;
        }
      } catch (e) {}
    }
    if (!played) {
      // Try clicking play button
      log('    No video found, trying play button');
      for (var fi = 0; fi < popup.frames().length; fi++) {
        try {
          var r = await popup.frames()[fi].evaluate(() => {
            var btns = document.querySelectorAll('button, a, .play-btn, .start-btn, [class*=play]');
            for (var b of btns) {
              if (b.textContent.includes('\u64ad\u653e') || b.className.includes('play') || b.className.includes('start')) {
                b.click(); return 'clicked';
              }
            }
            return 'nope';
          });
          if (r === 'clicked') { log('    Play button clicked'); await sl(3000); break; }
        } catch (e) {}
      }
    }

    try { await popup.close(); } catch (e) {}
    await sl(2000);
  }
}

(async () => {
  fs.writeFileSync(LF, '');
  log('=== START RUN ===');

  // Load course data
  var raw = fs.readFileSync(JD, 'utf8');
  var j = JSON.parse(raw);
  var courses = j.data.courseStudyList || [];
  log('Loaded ' + courses.length + ' courses');
  courses.forEach(c => log('  [' + (parseInt(c.learnPercent) || 0) + '%] ' + c.courseName));

  // Launch browser
  var b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();
  log('Browser launched');

  // Login via main site iframe
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null;
  for (var i = 0; i < 20; i++) {
    lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'));
    if (lf) break; await sl(2000);
  }
  if (!lf) { log('ERR: no login frame'); return; }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);

  // Save state for reuse
  await ctx.storageState({ path: 'C:/Users/Administrator/.openclaw/workspace/login_state.json' });

  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_run.png' });
  log('WAIT CAPTCHA');
  fs.writeFileSync(CF, '');
  var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('Captcha: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();

  // Wait for login redirect
  var loggedIn = false;
  for (var w = 0; w < 30; w++) {
    var url = p.url();
    if (url.includes('v_trainplan_list') || url.includes('v_selected_course')) { loggedIn = true; break; }
    await sl(1000);
  }
  if (!loggedIn) {
    log('Login redirect timeout, navigating manually');
    await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; });
    await sl(5000);
  }
  log('Logged in');

  // Click "去学习"
  await p.evaluate(() => {
    var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60'));
    if (b) b.click();
  });
  await sl(8000);
  log('At course list');

  // Study each course
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log('\nSKIP: ' + c.courseName + ' (100%)'); continue; }
    await studyCourse(p, c);
    // Navigate back to course list after each course
    await p.evaluate(() => { document.querySelector('#app').__vue__.$router.push({ path: '/v_selected_course', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154' } }); });
    await sl(5000);
  }

  log('\n=== ALL DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
