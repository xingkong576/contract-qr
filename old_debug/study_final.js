const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/study_done.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

/** Find clickable element with text "继续学习" or similar */
function findContinueBtn() {
  var all = document.querySelectorAll('button, a, span, div');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var txt = (el.textContent || '').trim().replace(/\s+/g, '');
    if ((txt.includes('继续学') || txt.includes('开始学') || txt.includes('播放'))) {
      // Only click leaf elements or elements with specific classes
      if (el.tagName === 'BUTTON' || el.tagName === 'A' ||
          el.className.includes('btn') || el.className.includes('button') ||
          el.className.includes('start') || el.className.includes('play')) {
        el.click();
        return 'clicked:' + el.tagName + ':' + el.className.substring(0,30) + ':' + txt.substring(0,15);
      }
    }
  }
  // Fallback: try any element with those texts
  for (var j = 0; j < all.length; j++) {
    var el2 = all[j];
    var txt2 = (el2.textContent || '').trim().replace(/\s+/g, '');
    if (txt2.includes('继续学') || txt2.includes('开始学')) {
      var style = window.getComputedStyle(el2);
      if (style.cursor === 'pointer' || el2.getAttribute('onclick') || el2.getAttribute('ng-click')) {
        el2.click();
        return 'clicked:' + el2.tagName + ':' + el2.className.substring(0,30);
      }
    }
  }
  // Last resort: try clicking parent of the text node
  var walker = document.createTreeWalker(document.body, 4, null, false);
  var node;
  while (node = walker.nextNode()) {
    var v = (node.textContent || '').trim();
    if (v.includes('继续学') || v.includes('开始学')) {
      var parent = node.parentElement;
      if (parent) { parent.click(); return 'clicked parent:' + parent.tagName + ':' + (parent.className||'').substring(0,30); }
    }
  }
  return 'not_found';
}

/** Study one course */
async function studyCourse(p, courseId, planId) {
  log('  -> course details');
  await p.evaluate(function(o){
    try { document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails', query:{trainplanId:o.planId, platformId:'154', courseId:o.courseId}}); } catch(e){}
  }, {courseId:courseId, planId:planId});
  await sl(6000);
  
  // Take screenshot for debugging
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/cur_course.png'});

  // Click "继续学习" with broad search
  log('  -> click continue');
  var clickResult = await p.evaluate(function(){
    // Search all clickable elements
    var all = document.querySelectorAll('button, a, [onclick], [class*="btn"], [class*="button"], [class*="start"], [class*="play"]');
    var found = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (txt.includes('\u7ee7\u7eed\u5b66\u4e60')) {
        found.push({tag:el.tagName, cls:el.className.substring(0,40), txt:txt.substring(0,30)});
        el.click();
        return 'clicked:' + el.tagName + ':' + txt.substring(0,15);
      }
    }
    // Broader search
    var all2 = document.querySelectorAll('*');
    for (var j = 0; j < all2.length; j++) {
      var el2 = all2[j];
      var t = (el2.textContent || '').trim().replace(/\s+/g, ' ');
      if (t.includes('\u7ee7\u7eed') && t.includes('\u5b66\u4e60')) {
        found.push({tag:el2.tagName, cls:el2.className.substring(0,40), txt:t.substring(0,30), cursor:window.getComputedStyle(el2).cursor});
        if (window.getComputedStyle(el2).cursor === 'pointer' || el2.tagName === 'BUTTON' || el2.tagName === 'A') {
          el2.click();
          return 'clicked_leaf:' + el2.tagName + ':' + t.substring(0,15);
        }
      }
    }
    // Try clicking the parent of text nodes
    var walker = document.createTreeWalker(document.body, 4, null, false);
    var node;
    while (node = walker.nextNode()) {
      var v = (node.textContent || '').trim();
      if (v.includes('\u7ee7\u7eed\u5b66\u4e60')) {
        var p2 = node.parentElement;
        while (p2 && p2 !== document.body) {
          p2.click();
          return 'treewalker:' + p2.tagName + ':' + (p2.className||'').substring(0,30);
        }
      }
    }
    return 'not_found (' + JSON.stringify(found.slice(0,3)) + ')';
  });
  log('  CLICK: ' + clickResult);
  await sl(8000);
  log('  HASH: ' + await p.evaluate(function(){return window.location.hash;}));

  // Find video
  for (var fi = 0; fi < p.frames().length; fi++) {
    try {
      var vi = await p.frames()[fi].evaluate(function(){
        var v = document.querySelector('video');
        if (!v) return null;
        return {pct:Math.round(v.currentTime / v.duration * 100), dur:Math.floor(v.duration)};
      });
      if (vi) {
        log('  VIDEO: ' + vi.pct + '% / ' + vi.dur + 's');
        // Monitor
        for (var ti = 0; ti < 360; ti++) {
          var s = null;
          for (var fi2 = 0; fi2 < p.frames().length; fi2++) {
            try {
              var vs = await p.frames()[fi2].evaluate(function(){
                var v = document.querySelector('video');
                if (!v) return null;
                return {pct:Math.round(v.currentTime / v.duration * 100), paused:v.paused, ended:v.ended};
              });
              if (vs) { s = vs; break; }
            } catch(e) {}
          }
          if (!s) { log('  LOST VIDEO'); break; }
          if (ti % 4 === 0) log('  PROGRESS: ' + s.pct + '%');
          if (s.ended || s.pct >= 99) { log('  COMPLETE!'); await sl(3000); return true; }
          if (s.paused) {
            for (var fi3 = 0; fi3 < p.frames().length; fi3++) {
              try { await p.frames()[fi3].evaluate(function(){ var v = document.querySelector('video'); if (v) v.play(); }); } catch(e) {}
            }
          }
          await sl(30000);
        }
        return true;
      }
    } catch(e) {}
  }
  log('  NO VIDEO FOUND');
  return false;
}

(async () => {
  fs.writeFileSync(LF, '');
  var browser = await chromium.launch({headless:false, executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var page = await browser.newPage();
  await page.setViewportSize({width:1280, height:800});
  log('=== AUTO STUDY START ===');

  // API interception
  var allCourses = [];
  page.on('response', async function(resp){
    try {
      var url = resp.url();
      if (url.includes('selected_course') && !url.includes('noPass')) {
        var txt = await resp.text();
        var json = JSON.parse(txt);
        if (json && json.data && json.data.courseStudyList) {
          allCourses = json.data.courseStudyList;
          log('API: captured ' + allCourses.length + ' courses');
        }
      }
    } catch(e) {}
  });

  // LOGIN
  log('Opening...');
  await page.goto('http://gszj.hsthnet.com/', {waitUntil:'load', timeout:60000});
  await sl(5000);

  var loginFrame = null;
  for (var i = 0; i < 15; i++) {
    loginFrame = page.frames().find(function(f){
      return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin');
    });
    if (loginFrame) break;
    await sl(2000);
  }
  if (!loginFrame) { log('ERR: no login frame'); process.exit(1); }
  await loginFrame.waitForSelector('input', {timeout:15000});
  var inputs = await loginFrame.locator('input').all();
  await inputs[0].fill(USER);
  await inputs[1].fill(PASS);

  await page.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha.png'});
  log('Enter captcha...');
  fs.writeFileSync(CF, '');
  var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('CAPTCHA: ' + code);
  await loginFrame.locator('input').nth(2).type(code, {delay:30});
  await loginFrame.locator('button').filter({hasText:'登录'}).click();
  await sl(12000);

  // Ensure on plan list
  if (!page.url().includes('v_trainplan_list')) {
    await page.evaluate(function(){ window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list'; });
    await sl(5000);
  }

  // Click "去学习"
  await page.evaluate(function(){
    var btns = Array.from(document.querySelectorAll('button'));
    var b = btns.find(function(el){ return el.textContent.includes('去学习'); });
    if (b) { b.click(); return 'clicked'; }
    return 'not found';
  });
  await sl(12000);

  if (allCourses.length === 0) {
    log('ERR: no courses captured from API');
    process.exit(1);
  }

  var PLAN_ID = 'af7e9b8dce964ebdab00c0647155de76';

  for (var ci = 0; ci < allCourses.length; ci++) {
    var c = allCourses[ci];
    var cName = c.courseName || c.name || 'unknown';
    var cId = c.courseId;
    var progress = parseInt(c.learnPercent) || 0;
    log('\n--- Course ' + (ci+1) + '/' + allCourses.length + ': ' + cName + ' (' + progress + '%) ---');
    if (progress >= 100) { log('SKIP (completed)'); continue; }

    var ok = await studyCourse(page, cId, PLAN_ID);
    if (!ok) {
      log('FAILED on: ' + cName);
      // Try going back
      await page.evaluate(function(){ window.history.back(); });
      await sl(4000);
      continue;
    }

    // Go back to course list for next course
    log('Back to course list...');
    await page.evaluate(function(){
      window.location.href = 'https://gp.hst360.com/index.html#/v_trainplan_list';
    });
    await sl(4000);
    await page.evaluate(function(){
      var btns = Array.from(document.querySelectorAll('button'));
      var b = btns.find(function(el){ return el.textContent.includes('去学习'); });
      if (b) b.click();
    });
    await sl(10000);
  }

  log('\n=== ALL COURSES DONE ===');
  // Keep alive
  await new Promise(function(){});
})().catch(function(e){ log('FATAL: ' + e.message); process.exit(1); });
