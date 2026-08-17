const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', PWD = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/player_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log('[' + t + '] ' + m); fs.appendFileSync(LF, '[' + t + '] ' + m + '\n'); };

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); log('Browser launched');

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(f => f.url().includes('gp.hst360.com') && f.url().includes('commonLogin')); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(PWD);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_player.png' });
  log('WAIT CAPTCHA');
  fs.writeFileSync(CF, ''); var code = ''; while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  await sl(12000);
  if (!p.url().includes('v_trainplan_list')) { await p.evaluate(() => { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; }); await sl(5000); }
  await p.evaluate(() => { var b = [...document.querySelectorAll('button')].find(el => el.textContent.includes('\u53bb\u5b66\u4e60')); if (b) b.click(); });
  await sl(8000);

  // Open a chapter popup
  await p.evaluate(() => { document.querySelector('#app').__vue__.$router.push({ path: '/v_courseDetails', query: { trainplanId: 'af7e9b8dce964ebdab00c0647155de76', platformId: '154', courseId: 'f11815ed-f859-4663-a2f1-2fb351d249eb' } }); });
  await sl(5000);

  // Click first uncompleted chapter
  var popupP = new Promise(r => { p.once('popup', popup => r(popup)); });
  await p.evaluate(() => { var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); if (btns[2]) btns[2].click(); });
  var popup = await popupP; await popup.waitForLoadState(); log('Popup opened');
  await sl(8000);

  // Scan the popup page for player info
  var info = await popup.evaluate(() => {
    var r = {};
    // Check for global player objects
    r.globalKeys = Object.keys(window).filter(k => k.toLowerCase().includes('player') || k.toLowerCase().includes('ali') || k.toLowerCase().includes('hls') || k.toLowerCase().includes('video')).slice(0, 30);
    // Check all video elements
    var vs = document.querySelectorAll('video');
    r.videoCount = vs.length;
    r.videoInfo = Array.from(vs).map(v => ({ id: v.id, cls: v.className, src: (v.src || '').substring(0, 100), readyState: v.readyState, duration: v.duration, playbackRate: v.playbackRate }));
    // Check for shadow DOM videos
    r.allElements = ['video', 'source', 'iframe', 'embed', 'object'].map(t => document.querySelectorAll(t).length);
    // Check window player objects
    r.windowPlayers = ['aliPlayer', 'AliPlayer', 'player', 'Player', 'hls', 'Hls', 'videojs', 'Videojs', 'jwplayer', 'JWPlayer', 'cyberplayer', 'CyberPlayer', 'ckplayer', 'CkPlayer', 'flowplayer', 'FlowPlayer'].filter(k => window[k] !== undefined);
    // Check script tags for video player libraries
    var scripts = Array.from(document.querySelectorAll('script')).map(s => s.src).filter(s => s.includes('player') || s.includes('Player') || s.includes('hls') || s.includes('aliyun') || s.includes('video'));
    r.playerScripts = scripts;
    // Check data attributes
    r.videoParents = Array.from(document.querySelectorAll('[class*=player], [class*=Player], [data-player], [id*=player]')).map(el => el.id || el.className || el.tagName).slice(0, 10);
    return r;
  });
  log('Player info:');
  for (var k in info) log('  ' + k + ': ' + JSON.stringify(info[k]).substring(0, 500));

  // Try to click the play button if the video isn't playing
  await sl(3000);
  var playResult = await popup.evaluate(() => {
    // Try all common play buttons
    var btns = document.querySelectorAll('button, a, div[class*=play], i[class*=play], span[class*=play]');
    for (var b of btns) {
      var t = b.textContent.trim();
      if (t.includes('\u64ad\u653e') || t.includes('\u7ee7\u7eed') || t === '\u25b6') {
        b.click();
        return 'CLICKED: ' + (t.substring(0, 10));
      }
    }
    return 'NO PLAY BTN FOUND';
  });
  log('Play btn: ' + playResult);

  // Monitor for network activity
  popup.on('response', async r => {
    try { var u = r.url(); if (u.includes('gp6/') || u.includes('hst360') || u.includes('playEncrypt') || u.includes('study') || u.includes('progress') || u.includes('record') || u.includes('save') || u.includes('complete')) { var txt = await r.text(); log('NET: ' + u.substring(50, 150) + ' | ' + txt.substring(0, 200)); } } catch (e) { }
  });

  await sl(15000);
  log('=== DONE ===');
})().catch(e => { log('FATAL: ' + e.message); });
