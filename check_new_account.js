const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

(async () => {
  try { require('child_process').execSync('taskkill /f /im chrome.exe 2>nul', { stdio: 'ignore' }); } catch(e) {}

  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();

  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Login
  let lf = null;
  for (let i = 0; i < 20; i++) {
    lf = p.frames().find(f => {
      try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); }
      catch(e) { return false; }
    });
    if (lf) break;
    await new Promise(r => setTimeout(r, 1000));
  }

  await lf.waitForSelector('input', { timeout: 15000 });
  const inputs = await lf.locator('input').all();
  await inputs[0].fill('622726198101130230');
  await inputs[1].fill('Wjjdzh123@');
  await p.screenshot({ path: './captcha_new.png' });
  console.log('W');
  
  fs.writeFileSync('./captcha_code.txt', '');
  let code = '';
  while (!code) { await new Promise(r => setTimeout(r, 1000)); code = fs.readFileSync('./captcha_code.txt', 'utf8').trim(); }
  console.log('C: ' + code);
  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '登录' }).click();

  await new Promise(r => setTimeout(r, 8000));
  console.log('URL: ' + p.url());

  // Take screenshot and dump page content
  await p.screenshot({ path: './debug_new_account.png', fullPage: true });

  // Check form content
  const content = await p.evaluate(() => {
    const r = {};
    r.url = window.location.hash;
    r.title = document.title;
    
    // Get form content
    const form = document.querySelector('form');
    if (form) {
      r.formHTML = form.outerHTML.substring(0, 2000);
      r.formAction = form.action;
    }

    // Get all inputs
    const ins = document.querySelectorAll('input, select, button');
    r.inputs = Array.from(ins).map(el => ({
      tag: el.tagName,
      type: el.type || '',
      name: el.name || '',
      placeholder: el.placeholder || '',
      text: el.textContent ? el.textContent.trim().substring(0, 40) : ''
    }));

    r.bodyHTML = document.body.innerText.substring(0, 1000);
    return r;
  });

  console.log('\n=== Page Content ===');
  console.log(JSON.stringify(content, null, 2));

  // Try clicking through / navigating
  console.log('\nTrying to navigate to v_trainplan_list...');
  try {
    await p.evaluate(() => {
      const app = document.querySelector('#app');
      if (app && app.__vue__) {
        app.__vue__.$router.push({ path: '/v_trainplan_list' });
      }
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log('After nav: ' + p.url());
    const content2 = await p.evaluate(() => {
      return { url: window.location.hash, text: document.body.innerText.substring(0, 500) };
    });
    console.log(JSON.stringify(content2, null, 2));
  } catch(e) {
    console.log('Nav err: ' + e.message);
  }

  console.log('\nBrowser stays open for you to inspect');
})();
