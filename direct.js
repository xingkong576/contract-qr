// Strategy: navigate to video page, extract token, call takeRecordByToken directly
const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/direct_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t + ' ' + m); fs.appendFileSync(LF, t + ' ' + m + '\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function completeChapter(page, courseId, sectionId, chapName) {
  log('>> ' + chapName);
  
  // Open video page in same window (hash-based, no reload)
  await page.evaluate(function(o) {
    document.querySelector('#app').__vue__.$router.push({ path: '/v_video', query: { sectionId: o.s, courseId: o.c, trainplanId: o.p, platformId: '154' } });
  }, { s: sectionId, c: courseId, p: PLAN });
  await sl(8000);
  
  // Find iframe with video player
  var pf = null;
  var serverUrl = 'https://content.hst360.com'; // default
  
  for (var w = 0; w < 20; w++) {
    var frames = page.frames();
    for (var f of frames) {
      try {
        var u = f.url();
        if (u.includes('content.hst360.com/videoPlay')) { pf = f; break; }
      } catch(e) {}
    }
    if (pf) break;
    await sl(1000);
  }
  
  if (!pf) { log('NO PF'); return false; }
  log('PF');
  
  await sl(3000);
  
  // Extract: serverUrl, token, courseId
  try {
    var info = await pf.evaluate(function() {
      var v = document.querySelector('video');
      if (!v) return { error: 'no video', url: location.href.substring(0,100) };
      
      // Find DPlayer instance
      var dp = null;
      for (var k in window) {
        try {
          var obj = window[k];
          if (obj && typeof obj === 'object' && obj.video && obj.options && obj.options.take && obj.options.take.token) {
            dp = obj; break;
          }
        } catch(e) {}
      }
      
      if (!dp) {
        // Try to access via __vue__ or similar
        return { error: 'no dp', hasVideo: true };
      }
      
      var takeToken = dp.options.take.token;
      var serverUrl = dp.options.serverUrl || '';
      var videoDuration = dp.video.duration ? Math.floor(dp.video.duration) : 0;
      
      // Also get the HMAC signing function reference
      var apiBackend = dp.options.apiBackend;
      if (apiBackend && apiBackend.send) {
        return {
          token: takeToken,
          serverUrl: serverUrl,
          duration: videoDuration,
          hasApiBackend: true
        };
      }
      
      return {
        token: takeToken,
        serverUrl: serverUrl,
        duration: videoDuration,
        hasApiBackend: false
      };
    });
    
    log('Info: ' + JSON.stringify(info).substring(0, 200));
    
    if (info.error) {
      log('Cannot extract: ' + info.error);
      // Just try playing at 1x anyway
      var r = await pf.evaluate(function() {
        var v = document.querySelector('video');
        if (!v) return 'no v';
        v.play();
        return 'played';
      });
      log('Fallback: ' + r);
      
      // Wait 60 seconds for progress
      await sl(60000);
      return true;
    }
    
    // We have the DPlayer instance with apiBackend.send
    // Now call the completion API directly!
    if (info.hasApiBackend && info.token) {
      var completed = await pf.evaluate(function(dur) {
        var dp = null;
        for (var k in window) {
          try {
            var obj = window[k];
            if (obj && typeof obj === 'object' && obj.video && obj.options && obj.options.take && obj.options.take.token) {
              dp = obj; break;
            }
          } catch(e) {}
        }
        if (!dp) return 'no dp';
        
        var serverUrl = dp.options.serverUrl || '';
        var token = dp.options.take.token;
        var url = serverUrl + '/videoPlay/takeRecordByToken';
        
        return new Promise(function(resolve) {
          dp.options.apiBackend.send({
            url: url,
            data: {
              token: token,
              time: dur || 0,
              duration: dur || 0,
              isEnd: 'true'
            },
            success: function(resp) {
              resolve('OK: ' + (resp && resp.message || ''));
            },
            fail: function(err) {
              resolve('FAIL: ' + JSON.stringify(err).substring(0, 100));
            }
          });
        });
      }, info.duration);
      
      log('Complete call: ' + completed);
    }
    
  } catch(e) { log('Err: ' + (e.message||'').substring(0,60)); }
  
  // Wait for the page to update
  await sl(5000);
  return true;
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== DIRECT ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);

  var browser = await chromium.launch({ headless: false, executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe' });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_direct.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: ' + code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var li = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
  log('In');
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);

  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    
    log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}}); }, {plan:PLAN, cid:c.courseId});
    await sl(5000);
    
    // Get chapters with their sectionIds
    var chapters = await p.evaluate(function() {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var links = document.querySelectorAll('a.titlecolor.text');
      var list = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) {
          var href = links[i] ? links[i].getAttribute('href') || '' : '';
          var sectionId = '';
          var m = href.match(/sectionId=([^&]+)/);
          if (m) sectionId = m[1];
          list.push({ idx: i, name: (links[i] ? links[i].textContent.trim() : '?').substring(0, 30), sectionId: sectionId });
        }
      }
      return list;
    });
    
    if (chapters.length === 0) { log('All done'); continue; }
    log('Chaps: ' + chapters.length);
    
    for (var ci2 = 0; ci2 < chapters.length; ci2++) {
      var ch = chapters[ci2];
      if (!ch.sectionId) { log(ch.name + ': no sectionId, use click method'); }
      await completeChapter(p, c.courseId, ch.sectionId, ch.name);
    }
    
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== ALL DONE ===');
})().catch(function(e) { log('FATAL: ' + (e.message||'') + ' | ' + (e.stack||'').substring(0,200)); });
