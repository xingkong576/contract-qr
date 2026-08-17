// ============================================
// 国雍教育继续教育 - 全自动刷课脚本
// 账号：622726198101130230
// 密码：Wjjdzh123@
// ============================================
// 需要：npm install playwright
// 运行：node study_all_new_account.js
// ============================================

const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const sl = ms => new Promise(r => setTimeout(r, ms));

// ========== 配置 ==========
const ACCOUNT = {
  username: '622726198101130230',
  password: 'Wjjdzh123@'
};

const PLANS = [
  { name: '专业课60学时', planId: 'af7e9b8dce964ebdab00c0647155de76' },
  { name: '公需课30学时', planId: 'b24b784434ff40429bfe60dfb590f1f4' }
];

const LOG_FILE = './study_log.txt';
const CAPTCHA_FILE = './captcha_code.txt';
const PROFILE_DIR = './pw-profile-new';

function log(msg) {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const line = `[${t}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ========== 登录 ==========
async function login(page) {
  await page.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 });
  await sl(3000);

  // 找到登录 iframe
  let lf = null;
  for (let i = 0; i < 20; i++) {
    lf = page.frames().find(f => {
      try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); }
      catch (e) { return false; }
    });
    if (lf) break;
    await sl(1000);
  }

  if (!lf) {
    log('ERROR: 找不到登录 iframe');
    return false;
  }

  await lf.waitForSelector('input', { timeout: 15000 });
  const inputs = await lf.locator('input').all();
  await inputs[0].fill(ACCOUNT.username);
  await inputs[1].fill(ACCOUNT.password);

  // 保存验证码截图
  await page.screenshot({ path: './captcha_login.png' });
  log('验证码截图已保存到 captcha_login.png');

  // 等待用户输入验证码
  log('请在 captcha_login.png 中查看验证码，将验证码写入 captcha_code.txt');
  fs.writeFileSync(CAPTCHA_FILE, '');
  let code = '';
  while (!code) {
    await sl(1000);
    code = fs.readFileSync(CAPTCHA_FILE, 'utf8').trim();
  }
  log('验证码：' + code);

  await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '登录' }).click();

  // 等待登录完成（可能跳到个人设置页）
  for (let w = 0; w < 30; w++) {
    const url = page.url();
    if (url.includes('v_trainplan') || url.includes('v_selected_course')) {
      log('登录成功');
      return true;
    }
    await sl(1000);
  }

  // 如果跳到了个人设置页 v_user_set，直接导航到培训计划页面
  const currentUrl = page.url();
  if (currentUrl.includes('v_user_set')) {
    log('首次登录跳转到个人设置页，直接导航到培训计划列表');
    try {
      await page.evaluate(() => {
        const app = document.querySelector('#app');
        if (app && app.__vue__) {
          app.__vue__.$router.push({ path: '/v_trainplan_list' });
        }
      });
      await sl(5000);
      log('导航后URL：' + page.url());
      return true;
    } catch (e) {
      log('导航失败：' + e.message);
    }
  }

  log('ERROR: 登录超时，当前URL=' + page.url());
  return false;
}

// ========== 刷完一个章节 ==========
async function completeChapter(page, popup, frame, chapterName) {
  log('  >> ' + chapterName);

  // 统计 save 请求
  let saveCount = 0;
  try {
    await popup.route('**/takeRecordByToken**', (route) => {
      saveCount++;
      route.continue().catch(() => {});
    });
  } catch (e) {}

  // 播放视频
  await frame.evaluate(() => {
    try { const el = document.querySelector('.dplayer-play-icon'); if (el) el.click(); } catch (e) {}
    try { const v = document.querySelector('video'); if (v && v.paused) v.play(); } catch (e) {}
  });

  // 等待 ~40s，让 API 记录至少 2 次
  for (let w = 0; w < 40; w++) {
    await sl(1000);
    if (saveCount >= 2) break;
  }
  log('  Save次数：' + saveCount);

  // 触发 ended 事件完成章节
  await frame.evaluate(() => {
    try {
      const v = document.querySelector('video');
      if (v) v.dispatchEvent(new Event('ended'));
    } catch (e) {}
  });
  await sl(10000);
}

// ========== 处理一个培训计划的所有课程 ==========
async function processPlan(page, plan) {
  log(`\n========== 开始学习：${plan.name} (${plan.planId}) ==========`);

  // 导航到课程列表
  const planParam = encodeURIComponent(plan.planId);
  await page.evaluate((pid) => {
    const app = document.querySelector('#app');
    if (app && app.__vue__) {
      app.__vue__.$router.push({
        path: '/v_selected_course',
        query: { trainplanId: pid, platformId: '154' }
      });
    }
  }, plan.planId);
  await sl(5000);

  // 检查是否有多页
  let totalPages = 0;
  const pageInfo = await page.evaluate(() => {
    const pages = document.querySelectorAll('.el-pagination li.number');
    return { pages: pages.length, texts: Array.from(pages).map(p => p.textContent.trim()) };
  });
  totalPages = pageInfo.pages;
  log(`共 ${totalPages} 页`);

  for (let pn = 1; pn <= totalPages; pn++) {
    log(`\n--- 第 ${pn}/${totalPages} 页 ---`);

    // 点击对应页码
    if (pn > 1) {
      await page.evaluate((pn) => {
        const pages = document.querySelectorAll('.el-pagination li.number');
        for (const p of pages) {
          if (p.textContent.trim() === String(pn)) {
            p.click();
            break;
          }
        }
      }, pn);
      await sl(3000);
    }

    // 从 Vue 数据提取当前页课程（listData 在 <section> 的 __vue__ 上）
    let courses = [];
    let attempts = 0;
    while (courses.length === 0 && attempts < 10) {
      courses = await page.evaluate(() => {
        const sections = document.querySelectorAll('section');
        for (const el of sections) {
          try {
            const vm = el.__vue__;
            if (vm && vm.listData) {
              return vm.listData.map(c => ({
                courseId: c.courseId,
                courseName: c.courseName,
                learnPercent: c.learnPercent
              }));
            }
          } catch (e) {}
        }
        return [];
      });
      if (courses.length === 0) {
        await sl(1000);
        attempts++;
      }
    }

    log(`第${pn}页课程数：${courses.length}`);
    courses.forEach((c, i) => {
      log(`  ${i + 1}. ${c.courseName} (${c.learnPercent}%)`);
    });

    // 逐个处理课程
    for (let ci = 0; ci < courses.length; ci++) {
      const c = courses[ci];
      if (parseInt(c.learnPercent) >= 100) {
        log(`跳过 ${c.courseName}（已完成 100%）`);
        continue;
      }

      log(`\n[${ci + 1}/${courses.length}] ${c.courseName} (${c.learnPercent}%)`);

      // 导航到课程详情页
      await page.evaluate(({ planId, courseId }) => {
        const app = document.querySelector('#app');
        if (app && app.__vue__) {
          app.__vue__.$router.push({
            path: '/v_courseDetails',
            query: { trainplanId: planId, platformId: '154', courseId }
          });
        }
      }, { planId: plan.planId, courseId: c.courseId });
      await sl(5000);

      // 获取未完成的章节
      const chapters = await page.evaluate(() => {
        const btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
        const titles = document.querySelectorAll('a.titlecolor.text');
        const list = [];
        for (let i = 0; i < btns.length; i++) {
          if (btns[i].textContent.indexOf('已学完') === -1) {
            list.push({
              idx: i,
              name: titles[i] ? titles[i].textContent.trim() : '第' + (i + 1) + '节'
            });
          }
        }
        return list;
      });

      log(`  章节：${chapters.length}`);
      if (chapters.length === 0) continue;

      // 逐个刷章节
      for (const chap of chapters) {
        const popupPromise = new Promise(r => page.once('popup', popup => r(popup)));

        // 点击章节按钮（native DOM click，对 Vue 有效）
        await page.evaluate((idx) => {
          const btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
          if (btns[idx]) btns[idx].click();
        }, chap.idx);
        await sl(2000);

        // 等待弹窗出现
        const popup = await Promise.race([
          popupPromise,
          sl(30000).then(() => null)
        ]);

        if (!popup) {
          log('  No popup');
          continue;
        }

        try { await popup.waitForLoadState('load', { timeout: 15000 }); } catch (e) {}

        // 找到视频 iframe
        let videoFrame = null;
        for (let w = 0; w < 20; w++) {
          const frames = popup.frames();
          for (const f of frames) {
            try {
              if (f.url().includes('content.hst360.com')) {
                videoFrame = f;
                break;
              }
            } catch (e) {}
          }
          if (videoFrame) break;
          await sl(1000);
        }

        if (videoFrame) {
          await completeChapter(page, popup, videoFrame, chap.name);
        } else {
          log('  未找到视频 iframe');
        }

        try { await popup.close(); } catch (e) {}
        await sl(2000);
      }

      // 回到课程列表（并保持当前页）
      await page.evaluate((pid) => {
        const app = document.querySelector('#app');
        if (app && app.__vue__) {
          app.__vue__.$router.push({
            path: '/v_selected_course',
            query: { trainplanId: pid, platformId: '154' }
          });
        }
      }, plan.planId);
      await sl(5000);
    }
  }
}

// ========== 主流程 ==========
(async () => {
  fs.writeFileSync(LOG_FILE, '');
  log('========================================');
  log('  国雍教育继续教育 - 全自动刷课');
  log('  账号：' + ACCOUNT.username);
  log('========================================');

  // 启动浏览器
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // 登录
  const loggedIn = await login(page);
  if (!loggedIn) {
    log('登录失败，退出');
    await sl(5000);
    await browser.close();
    return;
  }

  // 逐个处理培训计划
  for (const plan of PLANS) {
    await processPlan(page, plan);
  }

  log('\n========================================');
  log('  全部培训计划学习完成！');
  log('========================================');
  await sl(10000);
  // 不要自动关闭浏览器，方便检查
  // await browser.close();
})();
