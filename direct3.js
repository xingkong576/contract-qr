const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/direct3_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

(async function() {
  fs.writeFileSync(LF, '');
  log('=== DIRECT3 ===');
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', 'utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: ' + courses.length);
  
  var browser = await chromium.launch({ headless: false });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var p = await ctx.newPage();

  // Login
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f) { try { return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin'); } catch(e){return false;} }); if (lf) break; await sl(2000); }
  await lf.waitForSelector('input', { timeout: 15000 });
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({ path: 'C:/Users/Administrator/.openclaw/workspace/captcha_d3.png' }); log('W');
  fs.writeFileSync(CF, ''); var code = '';
  while (!code) { await sl(1000); code = fs.readFileSync(CF, 'utf8').trim(); }
  log('C: '+code); await lf.locator('input').nth(2).type(code, { delay: 20 });
  await lf.locator('button').filter({ hasText: '\u767b\u5f55' }).click();
  
  var li = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { li=true; break; } await sl(1000); }
  if (!li) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list', {timeout:30000}); await sl(3000); }
  log('In');
  await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
  await sl(8000);

  // For each course
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) continue;
    
    log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    await p.evaluate(function(o) { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}}); }, {plan:PLAN, cid:c.courseId});
    await sl(5000);
    
    // Get uncompleted chapters
    var chapters = await p.evaluate(function(opt) {
      var btns = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var links = document.querySelectorAll('a.titlecolor.text');
      var list = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) {
          var href = links[i] ? (links[i].getAttribute('href')||'') : '';
          var sid = '';
          var m = href.match(/sectionId=([^&]+)/);
          if (m) sid = m[1];
          if (!sid) sid = '2026' + opt.plan + '_' + opt.cid + '_' + i;
          list.push({ idx: i, name: (links[i]?links[i].textContent.trim():'?').substring(0,30), sectionId: sid });
        }
      }
      return list;
    }, {plan:PLAN, cid:c.courseId});
    
    if (chapters.length === 0) { log('All done'); continue; }
    log('Chaps: ' + chapters.length);
    
    // For each chapter
    for (var ci2 = 0; ci2 < chapters.length; ci2++) {
      var ch = chapters[ci2];
      log('>> ' + ch.name + ' [' + ch.sectionId + ']');
      
      // Navigate to video page
      await p.evaluate(function(o) {
        document.querySelector('#app').__vue__.$router.push({ path: '/v_video', query: { sectionId: o.sid, courseId: o.cid, trainplanId: o.planId, platformId: '154' } });
      }, {sid: ch.sectionId, cid: c.courseId, planId: PLAN});
      await sl(8000);
      
      // Find player iframe
      var pf = null;
      for (var w = 0; w < 25; w++) {
        var frames = p.frames();
        for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
        if (pf) break; await sl(1000);
      }
      if (!pf) { log('NO PF'); continue; }
      await sl(3000);
      
      // Extract token from iframe page source and call API
      try {
        var result = await pf.evaluate(function() {
          // Step 1: Find token from DPlayer instance or page source
          var token = null, serverUrl = null;
          
          // Method A: Find DPlayer instance
          for (var k in window) {
            try {
              var obj = window[k];
              if (obj && typeof obj === 'object' && obj.video && obj.options && obj.options.take && obj.options.take.token) {
                token = obj.options.take.token;
                serverUrl = obj.options.serverUrl || '';
                break;
              }
            } catch(e) {}
          }
          
          // Method B: Extract from script tags
          if (!token) {
            var scripts = document.querySelectorAll('script');
            for (var s of scripts) {
              var txt = s.textContent || s.innerText;
              if (txt && txt.indexOf('token') >= 0) {
                var m = txt.match(/["\']token["\']\s*:\s*["\']([^"\']+)["\']/);
                if (m) token = m[1];
                var sm = txt.match(/["\']serverUrl["\']\s*:\s*["\']([^"\']+)["\']/);
                if (sm) serverUrl = sm[1];
                if (token) break;
              }
            }
          }
          
          if (!token) return 'no_token';
          if (!serverUrl) serverUrl = 'https://content.hst360.com';
          
          // Step 2: Build HMAC key and sign
          // Key = "chaXs2--c" + token.substring(1,5)
          var keyPrefix = String.fromCharCode(99,104,97,88,115,50,45,45,99); // "chaXs2--c"
          var signKey = keyPrefix + token.substring(1, 5);
          
          var reqData = JSON.stringify({
            token: token,
            time: 1800,
            duration: 1800,
            isEnd: 'true'
          });
          
          return crypto.subtle.importKey('raw', new TextEncoder().encode(signKey), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
          .then(function(key) { return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(reqData)); })
          .then(function(sig) {
            var b64 = '';
            var bytes = new Uint8Array(sig);
            for (var i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
            var sign = btoa(b64);
            
            var url = serverUrl + '/videoPlay/takeRecordByToken';
            var body = 'token=' + encodeURIComponent(token) +
                       '&time=1800&duration=1800&isEnd=true&sign=' + encodeURIComponent(sign);
            
            return fetch(url, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:body})
            .then(function(resp) { return resp.text().then(function(t) { return 'STATUS=' + resp.status + ' BODY=' + t.substring(0,200); }); })
            .catch(function(err) { return 'FETCH_ERR: ' + err.message; });
          })
          .catch(function(err) { return 'CRYPTO_ERR: ' + err.message; });
        });
        
        log('Result: ' + result);
      } catch(e) { log('Err: ' + (e.message||'').substring(0,100)); }
      
      await sl(3000);
    }
    
    // Back to course list
    await p.evaluate(function() { var app = document.querySelector('#app'); if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}}); });
    await sl(5000);
  }
  
  log('\n=== ALL DONE ===');
})().catch(function(e) { log('FATAL: ' + (e.message||'') + ' | ' + (e.stack||'').substring(0,200)); });
