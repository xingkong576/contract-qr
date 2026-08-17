const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/diag_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

(async () => {
  fs.writeFileSync(LF, ''); log('=== DIAG ===');
  const b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();

  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null; for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 }); var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_diag.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  await sl(12000);
  if (!p.url().includes('v_trainplan_list')) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); }
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); }); await sl(8000);

  // Go to course 1
  await p.evaluate(() => { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154', courseId: 'f11815ed-f859-4663-a2f1-2fb351d249eb' } }); }); await sl(5000);

  // Open chapter
  var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
  await p.evaluate(() => { var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (btns[2]) btns[2].click(); }); // chapter 三
  var popup = await popupP; await popup.waitForLoadState(); log('Popup opened');
  await sl(5000);

  // Look for "继续学习" button EXACTLY
  var btns = await popup.evaluate(() => {
    var all = document.querySelectorAll('button, a, span, div');
    var r = {exact:[], classMatch:[], all:[], videoState:''};
    all.forEach(el => {
      var t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      r.all.push(t.substring(0, 30));
      if (t.includes('\u7ee7\u7eed\u5b66\u4e60')) r.exact.push({tag:el.tagName,txt:t.substring(0,30),cls:el.className.substring(0,60)});
      if (el.className.includes('plainStudy')) r.classMatch.push({tag:el.tagName,txt:t.substring(0,30),cls:el.className.substring(0,60)});
    });
    r.all = r.all.filter((v,i,a)=>a.indexOf(v)===i).slice(0,30);
    return r;
  });
  log('Exact continue btns: ' + JSON.stringify(btns.exact));
  log('Class plainStudy: ' + JSON.stringify(btns.classMatch));
  log('Unique texts: ' + JSON.stringify(btns.all));
  log('Video state: ' + btns.videoState);

  // Check if there's a dedicated iframe for the player
  var frameCheck = await popup.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => f.src || f.id || '?');
  });
  log('Iframes now: ' + JSON.stringify(frameCheck));

  // Check popup visibility over time
  log('Waiting 60s checking popup state...');
  for (var i = 0; i < 6; i++) {
    await sl(10000);
    try {
      var title = await popup.title();
      var frames = popup.frames().length;
      var pfExists = popup.frames().find(f => { try { return f.url().includes('content.hst360.com'); } catch(e){} return false; });
      log('  ' + ((i+1)*10) + 's: title="' + (title||'').substring(0,20) + '" frames=' + frames + ' pf=' + (pfExists?'yes':'no'));
    } catch(e) {
      log('  ' + ((i+1)*10) + 's: POPUP CLOSED');
      break;
    }
  }

  log('=== DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
