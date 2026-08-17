const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/player2_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); log('START');

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_p2.png' });
  log('W');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  await sl(12000);
  if (!p.url().includes('v_trainplan_list')) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); }
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); });
  await sl(8000);

  // Go to course 1
  await p.evaluate(() => { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154', courseId: 'f11815ed-f859-4663-a2f1-2fb351d249eb' } }); });
  await sl(5000);

  // Open chapter 2 (三、以信息化带动工业化 - already in progress)
  var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
  await p.evaluate(() => { var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (btns[2]) btns[2].click(); });
  var popup = await popupP; await popup.waitForLoadState(); log('Popup opened');
  await sl(8000);

  // Scan popup for iframes
  var iframeSrcs = await popup.evaluate(() => {
    var iframes = document.querySelectorAll('iframe');
    return Array.from(iframes).map(f => ({ src: f.src || '', id: f.id, cls: f.className, width: f.width, height: f.height }));
  });
  log('Iframes in popup: ' + JSON.stringify(iframeSrcs));

  // If there's an iframe, search inside it
  for (var fi = 0; fi < popup.frames().length; fi++) {
    try {
      var fUrl = popup.frames()[fi].url();
      if (!fUrl || fUrl === 'about:blank') continue;
      log('Frame ' + fi + ': ' + fUrl.substring(0, 150));

      var fInfo = await popup.frames()[fi].evaluate(() => {
        var r = {};
        r.url = window.location.href;
        r.videoCount = document.querySelectorAll('video').length;
        if (r.videoCount > 0) {
          var v = document.querySelector('video');
          r.video = { id: v.id, cls: v.className, src: (v.src || '').substring(0, 150), dur: v.duration, rate: v.playbackRate, readyState: v.readyState };
        }
        r.globalKeys = Object.keys(window).filter(k => k.toLowerCase().includes('player') || k.toLowerCase().includes('ali') || k.toLowerCase().includes('hls') || k.toLowerCase().includes('video')).slice(0, 20);
        r.allScripts = Array.from(document.querySelectorAll('script')).map(s => s.src).filter(s => s).slice(0, 20);
        r.innerHTML = document.body.innerHTML.substring(0, 1000);
        return r;
      });
      log('FrameInfo: ' + JSON.stringify(fInfo).substring(0, 2000));
    } catch (e) {
      log('Frame ' + fi + ' err: ' + e.message.substring(0, 100));
    }
  }

  await sl(5000);
  log('=== DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
