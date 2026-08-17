const { chromium } = require('C:\\Users\\Administrator\\.openclaw\\workspace\\skills\\web-anti-crawl-fetch\\scripts\\node_modules\\playwright\\index.js');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  });
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  console.log('BROWSER_OK');
  
  await page.goto('http://gszj.hsthnet.com/', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('PAGE_OK');
  
  await page.waitForTimeout(3000);
  
  // Find login iframe
  const frames = page.frames();
  const loginFrame = frames.find(f => f.url().includes('gp.hst360.com'));
  
  if (!loginFrame) {
    console.log('FRAME_ERROR');
    await new Promise(() => {});
    return;
  }
  
  console.log('FRAME_OK');
  
  // Fill credentials
  await loginFrame.fill('input[placeholder="账号"]', '622726198311030246');
  console.log('ACC_OK');
  await loginFrame.fill('input[placeholder="密码"]', 'abc123');
  console.log('PWD_OK');
  
  // Save captcha area screenshot
  await page.screenshot({ path: 'C:\\Users\\Administrator\\.openclaw\\workspace\\captcha.png' });
  console.log('CAPTCHA_OK');
  console.log('WAITING');
  
  // Keep browser alive
  await new Promise(() => {});
})().catch(err => {
  console.error('ERR: ' + err.message);
  process.exit(1);
});
