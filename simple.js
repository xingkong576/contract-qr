const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/study_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log(`[${t}] ${m}`); fs.appendFileSync(LF, `[${t}] ${m}\n`); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 800 });
  log('START');

  // API interceptor for course data
  let courses = [];
  p.on('response', async r => {
    try {
      const u = r.url();
      if (u.includes('selected_course') && !u.includes('noPass')) {
        const j = JSON.parse(await r.text());
        if (j?.data?.courseStudyList) {
          courses = j.data.courseStudyList;
          log(`API: ${courses.length} courses`);
        }
      }
    } catch (e) {}
  });

  // LOGIN
  log('Opening gszj...');
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  // Find login iframe
  let lf = null;
  for (let i = 0; i < 20; i++) {
    lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'));
    if (lf) break;
    await sleep(2000);
  }
  if (!lf) { log('ERR: no login frame'); return; }

  await lf.waitForSelector('input', { timeout: 15000 });
  const ins = await lf.locator('input').all();
  await ins[0].fill(U);
  await ins[1].fill(P);

  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha.png' });
  log('WAITING CAPTCHA...');
  fs.writeFileSync(CF, '');
  let code = '';
  while (!code) { await sleep(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log(`CAPTCHA: ${code}`);

  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '登录' }).click();
  await sleep(12000);

  // Ensure on plan list
  if (!p.url().includes('v_trainplan_list')) {
    log('Navigating to plan list...');
    await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; });
    await sleep(5000);
  }

  // Click "去学习"
  log('Clicking 去学习...');
  const clickResult = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(el => el.textContent.includes('去学习'));
    if (b) { b.click(); return 'ok'; }
    // Try any clickable element
    const all = [...document.querySelectorAll('*')];
    for (const el of all) {
      if (el.textContent.includes('去学习')) {
        const s = window.getComputedStyle(el);
        if (s.cursor === 'pointer' || el.tagName === 'BUTTON' || el.tagName === 'A') {
          el.click(); return 'clicked_' + el.tagName;
        }
      }
    }
    return 'not_found';
  });
  log(`Click result: ${clickResult}`);
  await sleep(10000);
  log(`Hash: ${await p.evaluate(() => window.location.hash)}`);

  if (courses.length === 0) { log('ERR: no courses'); return; }

  const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

  for (let ci = 0; ci < courses.length; ci++) {
    const c = courses[ci];
    const cName = c.courseName || c.name || 'unknown';
    const cId = c.courseId;
    const pct = parseInt(c.learnPercent) || 0;

    log(`\n[${ci + 1}/${courses.length}] ${cName} (${pct}%)`);
    if (pct >= 100) { log('  SKIP'); continue; }

    // Go to course details
    log('  -> details page');
    await p.evaluate(o => {
      try {
        document.querySelector('#app').__vue__.$router.push({
          path: '/v_courseDetails',
          query: { trainplanId: o.planId, platformId: '154', courseId: o.courseId }
        });
      } catch (e) {}
    }, { courseId: cId, planId: PLAN });
    await sleep(6000);
    log(`  hash: ${await p.evaluate(() => window.location.hash)}`);

    // Try to enter video from details - search for STUDY-related buttons broadly
    log('  -> finding & clicking study button');
    const btnResult = await p.evaluate(() => {
      // Strategy 1: buttons with study text
      const btns = [...document.querySelectorAll('button')];
      for (const b of btns) {
        const t = b.textContent.trim();
        if (t.includes('继续学') || t.includes('开始学') || t.includes('去学习') || t === '学习') {
          b.click(); return 'button:' + t.substring(0, 10);
        }
      }
      // Strategy 2: anchor tags
      const as = [...document.querySelectorAll('a')];
      for (const a of as) {
        const t = a.textContent.trim();
        if (t.includes('继续学') || t.includes('开始学') || t.includes('进入')) {
          a.click(); return 'a:' + t.substring(0, 10);
        }
      }
      // Strategy 3: any element with cursor:pointer containing study text
      const all = [...document.querySelectorAll('*')];
      for (const el of all) {
        const t = el.textContent.trim();
        if (t.includes('继续学') || t.includes('开始学') || t.includes('再去学')) {
          const s = window.getComputedStyle(el);
          if (s.cursor === 'pointer' || s.cursor === 'hand' || el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SPAN') {
            el.click(); return 'any:' + el.tagName + ':' + t.substring(0, 15);
          }
        }
      }
      // Strategy 4: text node parent chain
      const walker = document.createTreeWalker(document.body, 4, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const v = node.textContent.trim();
        if (v.includes('继续学') || v.includes('开始学')) {
          let p = node.parentElement;
          while (p && p !== document.body) {
            const s = window.getComputedStyle(p);
            if (s.cursor === 'pointer' || p.tagName === 'A' || p.tagName === 'BUTTON' || p.hasAttribute('onclick')) {
              p.click(); return 'tree:' + p.tagName + ':' + p.className.substring(0, 20);
            }
            p = p.parentElement;
          }
        }
      }
      return 'not_found';
    });
    log(`  btnResult: ${btnResult}`);
    await sleep(8000);
    log(`  hash: ${await p.evaluate(() => window.location.hash)}`);

    // Check for video
    let foundVideo = false;
    for (let fi = 0; fi < p.frames().length; fi++) {
      try {
        const v = await p.frames()[fi].evaluate(() => {
          const v = document.querySelector('video');
          if (!v) return null;
          return { pct: Math.round(v.currentTime / v.duration * 100), dur: Math.floor(v.duration) };
        });
        if (v) { foundVideo = true; log(`  VIDEO: ${v.pct}% / ${v.dur}s`); break; }
      } catch (e) {}
    }

    if (foundVideo) {
      log('  MONITORING...');
      for (let t = 0; t < 360; t++) {
        let s = null;
        for (let fi = 0; fi < p.frames().length; fi++) {
          try {
            const vs = await p.frames()[fi].evaluate(() => {
              const v = document.querySelector('video');
              if (!v) return null;
              return { pct: Math.round(v.currentTime / v.duration * 100), paused: v.paused, ended: v.ended };
            });
            if (vs) { s = vs; break; }
          } catch (e) {}
        }
        if (!s) { log('  LOST'); break; }
        if (t % 4 === 0) log(`  ${s.pct}%`);
        if (s.ended || s.pct >= 99) { log('  COMPLETE!'); await sleep(3000); break; }
        if (s.paused) {
          for (let fi = 0; fi < p.frames().length; fi++) {
            try { await p.frames()[fi].evaluate(() => { const v = document.querySelector('video'); if (v) v.play(); }); } catch (e) {}
          }
        }
        await sleep(30000);
      }
    } else {
      log('  NO VIDEO');
      await p.screenshot({ path: `C:/Users/Administrator/.openclaw/workspace/novideo_${ci}.png` });
    }

    // Back to plan list for next course
    log('  -> back to plan list');
    await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; });
    await sleep(4000);
    await p.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find(el => el.textContent.includes('去学习'));
      if (b) b.click();
    });
    await sleep(10000);
  }

  log('\n=== ALL DONE ===');
})().catch(e => { log('ERR: ' + e.message); });
