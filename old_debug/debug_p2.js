const { chromium } = require('C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js');
const fs = require('fs');

(async function() {
  try { require('child_process').execSync('taskkill /f /im chrome.exe 2>nul', {stdio:'ignore'}); } catch(e) {}
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  // Go to login page directly
  await p.goto('http://gszj.hsthnet.com/', {waitUntil:'load', timeout:60000});
  await new Promise(r => setTimeout(r, 3000));
  console.log('1. gszj URL:', p.url());
  
  // Find login iframe and do login
  var lf = null;
  for (var i=0; i<20; i++) {
    lf = p.frames().find(f => { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e) { return false; } });
    if (lf) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (lf) {
    console.log('2. Login form found');
    await lf.waitForSelector('input', {timeout:15000});
    var ins = await lf.locator('input').all();
    await ins[0].fill('622726198311030246');
    await ins[1].fill('abc123');
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_p2.png'});
    console.log('3. CAPTCHA NEEDED');
    fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/captcha_input.txt', '');
    var code = '';
    while (!code) { await new Promise(r => setTimeout(r, 1000)); code = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/captcha_input.txt', 'utf8').trim(); }
    console.log('4. Code:', code);
    await lf.locator('input').nth(2).type(code, {delay:20});
    await lf.locator('button').filter({hasText:'登录'}).click();
    await new Promise(r => setTimeout(r, 8000));
    console.log('5. After login URL:', p.url());
  } else {
    console.log('2. No login iframe found');
    return;
  }
  
  // Navigate to course list
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', {waitUntil:'load', timeout:30000});
  await new Promise(r => setTimeout(r, 5000));
  console.log('6. Course list URL:', p.url());
  
  // Click 去学习
  try {
    var clickRes = await p.evaluate(function() {
      var b = Array.from(document.querySelectorAll('button')).find(function(el){ return el.textContent.indexOf('去学习') >= 0; });
      if (b) { b.click(); return 'clicked'; }
      return 'not found';
    });
    console.log('7. 去学习:', clickRes);
  } catch(e) { console.log('7. Err:', e.message); }
  await new Promise(r => setTimeout(r, 5000));
  
  // Dump pagination info
  var dump = await p.evaluate(function() {
    var r = {};
    
    // el-pagination
    var ep = document.querySelector('.el-pagination');
    if (ep) {
      r.paginationHTML = ep.outerHTML.substring(0, 500);
      r.numPages = [];
      ep.querySelectorAll('li.number').forEach(function(li) { r.numPages.push(li.textContent.trim()); });
      var next = ep.querySelector('.btn-next');
      r.nextDisabled = next ? next.classList.contains('disabled') : 'no-next-btn';
    } else {
      r.paginationHTML = 'NOT FOUND';
    }
    
    // Course list info
    r.pageHTML = document.body.innerHTML.substring(0, 1000);
    r.courseCards = document.querySelectorAll('.course-list li, .course-list .pr').length;
    r.allLIs = document.querySelectorAll('li').length;
    r.hash = window.location.hash;
    
    return r;
  });
  
  console.log('8. Dump:', JSON.stringify(dump, null, 2));
  
  // Also try API
  try {
    var apiResult = await p.evaluate(function() {
      return fetch('/gp6/lms/stu/trainplanCourseHandle/selected_course?trainplanId=' + encodeURIComponent('af7e9b8dce964ebdab00c0647155de76'))
        .then(function(r){ return r.json(); })
        .then(function(d) {
          return {
            totalCount: d.data ? d.data.totalCount : '?',
            count: d.data && d.data.courseStudyList ? d.data.courseStudyList.length : 0,
            names: d.data && d.data.courseStudyList ? d.data.courseStudyList.map(function(c){return c.courseName;}).join(', ') : 'none',
            finish: d.data ? d.data.finish : '?'
          };
        });
    });
    console.log('9. API:', JSON.stringify(apiResult));
  } catch(e) { console.log('9. API err:', e.message); }
  
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/debug_p2.png', fullPage:true});
  console.log('10. Screenshot saved');
})();
