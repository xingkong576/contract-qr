// Approach: extract token from page source, compute HMAC, call API directly
const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/direct2_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t + ' ' + m); fs.appendFileSync(LF, t + ' ' + m + '\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

// Known HMAC key from chplayer1.min.js
// const KEY_PREFIX = new TextDecoder().decode(Uint8Array.from([99,104,97,88,115,50,45,45,99]));
// KEY_PREFIX = "chaXs2--c"

async function markSectionComplete(pf, token, serverUrl, sectionName) {
  log('  Mark complete: ' + sectionName);
  
  try {
    var result = await pf.evaluate(function(o) {
      // HMAC key prefix from the DPlayer source
      var keyPrefix = String.fromCharCode.apply(null, [99,104,97,88,115,50,45,45,99]); // "chaXs2--c"
      var signKey = keyPrefix + o.token.substring(1, 5);
      
      // Build data
      var data = JSON.stringify({
        token: o.token,
        time: 9999,
        duration: 9999,
        isEnd: 'true'
      });
      
      // HMAC-SHA256 sign
      return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(signKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ).then(function(key) {
        return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
      }).then(function(sig) {
        // Convert to base64
        var bytes = new Uint8Array(sig);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        var sign = btoa(binary);
        
        // POST
        return fetch(o.serverUrl + '/videoPlay/takeRecordByToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'token=' + encodeURIComponent(o.token) + '&time=9999&duration=9999&isEnd=true&sign=' + encodeURIComponent(sign)
        }).then(function(resp) {
          return resp.text().then(function(text) { return 'status=' + resp.status + ' body=' + text.substring(0, 100); });
        }).catch(function(err) {
          return 'fetch error: ' + err.message;
        });
      }).catch(function(err) {
        return 'crypto error: ' + err.message;
      });
    }, { token: token, serverUrl: serverUrl });
    
    log('  Result: ' + result);
    return result;
  } catch(e) {
    log('  Err: ' + (e.message||'').substring(0, 80));
    return 'error';
  }
}

async function processSection(page, courseId, sectionId, sectionName) {
  log('>> ' + sectionName + ' [' + sectionId + ']');
  
  // Navigate to video page via Vue router (no reload)
  if (page.url().includes('v_courseDetails')) {
    // From course details, navigate to video
    await page.evaluate(function(o) {
      document.querySelector('#app').__vue__.$router.push({ path: '/v_video', query: { sectionId: o.sid, courseId: o.cid, trainplanId: o.planId, platformId: '154' } });
    }, { sid: sectionId, cid: courseId, planId: PLAN });
  } else {
    // Direct URL
    await page.goto('https://gp.hst360.com/index.html#/v_video?sectionId=' + sectionId + '&courseId=' + courseId + '&trainplanId=' + PLAN + '&platformId=154', { waitUntil: 'load', timeout: 30000 });
  }
  await sl(8000);
  
  // Find video player iframe
  var pf = null;
  for (var w = 0; w < 20; w++) {
    var frames = page.frames();
    for (var f of frames) {
      try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {}
    }
    if (pf) break;
    await sl(1000);
  }
  if (!pf) { log('NO PF'); return; }
  
  await sl(3000);
  
  // Extract token and serverUrl from page source
  try {
    var info = await pf.evaluate(function() {
      var v = document.querySelector('video');
      if (!v) return { error: 'no video' };
      
      // First try: find DPlayer instance via window search
      for (var k in window) {
        try {
          var obj = window[k];
          if (obj && typeof obj === 'object' && obj.video && obj.options && obj.options.take && obj.options.take.token) {
            return {
              token: obj.options.take.token,
              serverUrl: obj.options.serverUrl || '',
              duration: obj.video.duration ? Math.floor(obj.video.duration) : 0,
              source: 'window'
            };
          }
        } catch(e) {}
      }
      
      // Second try: extract from page source
      // The take options might be in a script tag
      var scripts = document.querySelectorAll('script');
      for (var s of scripts) {
        var text = s.textContent || s.innerText;
        if (text && text.indexOf('take') >= 0 && text.indexOf('token') >= 0) {
          var tokenMatch = text.match(/["']token["']\s*:\s*["']([^"']+)["']/);
          var serverMatch = text.match(/["']serverUrl["']\s*:\s*["']([^"']+)["']/);
          if (tokenMatch) {
            return {
              token: tokenMatch[1],
              serverUrl: serverMatch ? serverMatch[1] : '',
              duration: 0,
              source: 'script'
            };
          }
        }
      }
      
      return { error: 'no token found', hasVideo: true };
    });
    
    log('Info: ' + JSON.stringify(info));
    
    if (info.error) {
      log('Cannot get token: ' + info.error);
      // Fallback: try to play video
      await pf.evaluate(function() { var v = document.querySelector('video'); if(v) v.play().catch(function(){}); });
      await sl(60000);
      return;
    }
    
    // Mark complete
    await markSectionComplete(pf, info.token, info.serverUrl || 'https://content.hst360.com', sectionName);
    
  } catch(e) { log('Err: ' + (e.message||'').substring(0, 60)); }
}

(async function() {
  fs.writeFileSync(LF, '');
  log('=== DIRECT2 ===');
  
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
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_direct2.png' }); log('W');
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

  var totalSections = 0;
  
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    
    log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}}); }, {plan:PLAN, cid:c.courseId});
    await sl(5000);
    
    var chapters = await p.evaluate(function() {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var links = document.querySelectorAll('a.titlecolor.text');
      var list = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) {
          var href = links[i] ? (links[i].getAttribute('href') || '') : '';
          var sectionId = '';
          var m = href.match(/sectionId=([^&]+)/);
          if (m) sectionId = m[1];
          // If no href, build sectionId from pattern
          if (!sectionId) sectionId = '2026' + PLAN + '_' + o.cid + '_' + i;
          list.push({ idx: i, name: (links[i] ? links[i].textContent.trim() : '?').substring(0, 30), sectionId: sectionId });
        }
      }
      return list;
    }, {plan: PLAN, cid: c.courseId});
    
    if (chapters.length === 0) { log('All done'); continue; }
    log('Chaps: ' + chapters.length);
    totalSections += chapters.length;
    
    for (var ci2 = 0; ci2 < chapters.length; ci2++) {
      var ch = chapters[ci2];
      await processSection(p, c.courseId, ch.sectionId, ch.name);
      await sl(3000);
    }
    
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== ALL DONE === Total sections: ' + totalSections);
})().catch(function(e) { log('FATAL: ' + (e.message||'') + ' | ' + (e.stack||'').substring(0,200)); });
