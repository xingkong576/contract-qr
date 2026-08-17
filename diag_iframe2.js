const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const AUTH = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';
const sl = ms => new Promise(r => setTimeout(r, ms));

(async function() {
  var ctx, p;
  if (fs.existsSync(AUTH)) {
    ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-data', { headless: false, viewport: { width: 1280, height: 800 } });
    p = ctx.pages()[0] || await ctx.newPage();
    await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId=af7e9b8dce964ebdab00c0647155de76&platformId=154', { waitUntil: 'load', timeout: 30000 }); await sl(5000);
    await p.evaluate(function() { var b = Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;}); if(b) b.click(); });
    await sl(5000);
    
    var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
    await p.evaluate(function() { var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor'); for(var i=0;i<b.length;i++){if(b[i].textContent.indexOf('\u5df2\u5b66\u5b8c')==-1){b[i].click();break;}} });
    var popup = await pp;
    try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
    
    // Wait for iframe
    var pf = null;
    for (var w = 0; w < 20; w++) {
      var frames = popup.frames();
      for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
      if (pf) break; await sl(1000);
    }
    
    if (pf) {
      console.log('IFRAME URL: ' + pf.url());
      
      // Wait for video element
      await sl(5000);
      
      // Dump all scripts and their content
      var data = await pf.evaluate(function() {
        var s = document.querySelectorAll('script');
        var out = [];
        for (var i = 0; i < s.length; i++) {
          out.push({ idx: i, src: s[i].src || 'INLINE', len: (s[i].textContent||'').length });
        }
        // Also get body HTML first 2000 chars
        var html = document.body ? document.body.innerHTML.substring(0, 3000) : 'no body';
        
        // Check all inline scripts for token patterns
        var tokenFound = null;
        for (var i = 0; i < s.length; i++) {
          var txt = s[i].textContent || '';
          if (txt.length > 100) {
            // Search for any hex token patterns
            var m = txt.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
            if (m) { tokenFound = { type: 'token', value: m[1], idx: i, pos: txt.indexOf(m[0]) }; break; }
            var m2 = txt.match(/['"]take['"]?\s*:\s*\{/);
            if (m2) { tokenFound = { type: 'take_obj', idx: i, pos: txt.indexOf(m2[0]) }; break; }
          }
        }
        
        // Also search for recordId and studyCode in all scripts  
        var recordId = null, studyCode = null, videoId = null, signId = null;
        for (var i = 0; i < s.length; i++) {
          var txt = s[i].textContent || '';
          if (txt.length > 500) {
            var rm = txt.match(/['"]recordId['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
            if (rm) recordId = { val: rm[1], idx: i };
            var sm = txt.match(/['"]studyCode['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
            if (sm) studyCode = { val: sm[1], idx: i };
            var vm = txt.match(/['"]videoId['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
            if (vm) videoId = { val: vm[1], idx: i };
            var sim = txt.match(/['"]signId['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
            if (sim) signId = { val: sim[1], idx: i };
          }
        }
        
        return {
          scriptCount: s.length,
          scripts: out,
          bodyStart: html,
          token: tokenFound,
          recordId: recordId,
          studyCode: studyCode,
          videoId: videoId,
          signId: signId
        };
      });
      
      console.log('\n=== SCRIPTS ===');
      data.scripts.forEach(function(s) { console.log('['+s.idx+'] src=' + s.src.substring(0,80) + ' len=' + s.len); });
      console.log('\n=== BODY START ===');
      console.log(data.bodyStart);
      console.log('\n=== TOKEN ===');
      console.log(JSON.stringify(data.token));
      console.log('\n=== INIT VARS ===');
      console.log('recordId:', JSON.stringify(data.recordId));
      console.log('studyCode:', JSON.stringify(data.studyCode));
      console.log('videoId:', JSON.stringify(data.videoId));
      console.log('signId:', JSON.stringify(data.signId));
      
      // Now dump the full innerHTML to file
      var fullHtml = await pf.evaluate(function() { return document.documentElement.outerHTML; });
      fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/iframe_dump.html', fullHtml);
      console.log('\nSAVED iframe_dump.html (' + fullHtml.length + ' bytes)');
    }
    
    await sl(60000);
    await ctx.close();
  } else {
    console.log('NO AUTH FILE');
  }
})();
