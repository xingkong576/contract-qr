const PLAYWRIGHT = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PLAYWRIGHT);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CAPTCHA_FILE = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LOG_FILE = 'C:/Users/Administrator/.openclaw/workspace/study_log.txt';

function log(m) {
  var t = new Date().toLocaleTimeString();
  var l = '[' + t + '] ' + m;
  console.log(l);
  fs.appendFileSync(LOG_FILE, l + '\n');
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

(async () => {
  fs.writeFileSync(LOG_FILE, '');

  var browser = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  log('START');

  await page.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  await sleep(5000);

  var loginFrame = null;
  for (var i = 0; i < 15; i++) {
    loginFrame = page.frames().find(function(f) { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); });
    if (loginFrame) { log('FRAME: ' + loginFrame.url().substring(0, 60)); break; }
    await sleep(2000);
  }
  if (!loginFrame) { log('NO FRAME'); return; }

  await loginFrame.waitForSelector('input', { timeout: 15000 });
  var inputs = await loginFrame.locator('input').all();
  log('INPUTS: ' + inputs.length);
  await inputs[0].fill(USER);
  await inputs[1].fill(PASS);

  await page.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha.png' });
  log('CAPTCHA NEEDED');

  fs.writeFileSync(CAPTCHA_FILE, '');
  var code = '';
  while (!code) { await sleep(1000); code = fs.readFileSync(CAPTCHA_FILE, 'utf8').trim(); }
  log('CAPTCHA: ' + code);

  await loginFrame.locator('input').nth(2).type(code, { delay: 30 });
  await loginFrame.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  await sleep(12000);
  log('URL: ' + page.url());

  if (!page.url().includes('v_trainplan_list')) {
    await page.evaluate(function() { window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; });
    await sleep(5000);
  }
  await page.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/plans.png' });
  log('PLANS LOADED');

  try { await page.locator('button').filter({ hasText: '\u53bb\u5b66\u4e60' }).first().click({ timeout: 5000, force: true }); }
  catch(e) { log('CLICK FAIL: ' + e.message); }
  await sleep(8000);
  log('COURSES: ' + await page.evaluate(function() { return window.location.hash; }));

  var dump = await page.evaluate(function() {
    return Array.from(document.querySelectorAll('.course-list li')).slice(0, 5).map(function(li) {
      var r = li.getBoundingClientRect();
      return { text: (li.querySelector('h3') ? li.querySelector('h3').textContent : '').trim().substring(0,20), x: r.x, y: r.y, w: r.width, h: r.height };
    });
  });
  log('ITEMS: ' + JSON.stringify(dump));

  if (dump.length > 0) {
    await page.mouse.click(dump[0].x + dump[0].w/2, dump[0].y + dump[0].h/2);
    await sleep(8000);
    log('CLICKED: ' + await page.evaluate(function() { return window.location.hash; }));
    await page.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/click_result.png' });

    for (var ri = 0; ri < 2; ri++) {
      var routes = ['/v_video', '/v_courseDetails'];
      try {
        await page.evaluate(function(r) { document.querySelector('#app').__vue__.$router.push(r); }, routes[ri]);
      } catch(e) {}
      await sleep(5000);
      log('R ' + routes[ri] + ': ' + await page.evaluate(function() { return window.location.hash; }));
      var text = (await page.evaluate(function() { return document.body.innerText.substring(0, 200); }) || '').replace(/\n/g, ' ');
      log('TEXT: ' + text);
    }
  }

  log('DONE');
  await new Promise(function() {});
})().catch(function(e) { log('ERR: ' + e.message); process.exit(1); });
