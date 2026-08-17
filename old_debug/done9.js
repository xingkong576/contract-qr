const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF,t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function completeChapter(popup, pf, chapIdx) {
  log('>> Chap[' + chapIdx + ']');
  
  // Step 1: Start video playing and intercept first saveProgress response
  await pf.evaluate(function() {
    try { var v = document.querySelector('video'); if(v && v.paused) v.play(); } catch(e){}
    try { document.querySelector('.dplayer-play-icon').click(); } catch(e){}
  });
  
  // Step 2: Set up response interception for the FIRST takeRecordByToken call
  // We'll extract the new token from the response
  var newToken = null;
  var serverUrl = 'https://content.hst360.com';
  var duration = 3600;
  
  // Wait for first save (up to 40s)
  for (var w = 0; w < 40; w++) {
    // Each iteration, check if we can get video info and if token is available
    var info = await pf.evaluate(function() {
      var r = { token: null, srv: null, dur: 3600, ready: false };
      
      // Try video
      try { var v = document.querySelector('video'); if (v) { r.ready = v.readyState >= 2; if (v.duration > 10) r.dur = Math.floor(v.duration); } } catch(e){}
      
      // Try initData (preloaded)
      if (window.initData && window.initData.serverUrl) r.srv = window.initData.serverUrl;
      
      // Try all scripts for token
      document.querySelectorAll('script').forEach(function(s) {
        var txt = s.textContent || '';
        var m = txt.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
        if (m && !r.token) r.token = m[1];
        var sm = txt.match(/['"]serverUrl['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
        if (sm) r.srv = sm[1];
      });
      
      return r;
    });
    
    if (info.token) { newToken = info.token; log('Token from scripts'); }
    if (info.srv) serverUrl = info.srv;
    if (info.dur > 10) duration = info.dur;
    
    if (newToken && info.ready) break;
    await sl(1000);
  }
  
  // Fallback: try fetching external scripts
  if (!newToken) {
    var initSrcs = await pf.evaluate(function() {
      var srcs = [];
      document.querySelectorAll('script[src*="full"], script[src*="init"], script[src*="config"]').forEach(function(s) { if (s.src) srcs.push(s.src); });
      // Also get all non-common scripts
      document.querySelectorAll('script[src]').forEach(function(s) {
        if (s.src.indexOf('content.hst360.com') >= 0 && srcs.indexOf(s.src) < 0) srcs.push(s.src);
      });
      return srcs;
    });
    for (var si = 0; si < initSrcs.length; si++) {
      try {
        var resp = await pf.evaluate(function(u) { return fetch(u).then(function(r){return r.text();}).catch(function(){return '';}); }, initSrcs[si]);
        if (resp.length > 10) {
          var m = resp.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
          if (m) { newToken = m[1]; log('Token fetched'); break; }
        }
      } catch(e) {}
    }
  }
  
  // Step 3: Check server has our session by making a real saveProgress call
  // We let the DPlayer make the first real save, then read the response token
  log('Waiting for first real save...');
  var firstSaveResponse = null;
  popup.route('**/takeRecordByToken**', function(route, request) {
    route.continue().then(function(resp) {
      resp.body().then(function(body) {
        try {
          var text = new TextDecoder().decode(body);
          var parsed = JSON.parse(text);
          if (parsed.code === 0 || parsed.status === 0 || parsed.code === '0' || parsed.status === '0') {
            if (parsed.data && typeof parsed.data === 'string' && parsed.data.length > 20) {
              firstSaveResponse = parsed.data;
              log('Got token from response!');
            }
          }
        } catch(e) {}
      }).catch(function(){});
    });
  });
  
  // Wait up to 60s for first save response
  for (var w = 0; w < 60; w++) {
    await sl(1000);
    if (firstSaveResponse) break;
  }
  
  var tokenToUse = firstSaveResponse || newToken;
  if (!tokenToUse) { log('NO TOKEN after all attempts'); return; }
  log('Token: ' + tokenToUse.substring(0,16) + '...');
  
  // Step 4: Now make the final save with isEnd=true using our own HMAC
  var result = await pf.evaluate(function(o) {
    var ALPH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx';
    function toB60(s) {
      var bytes = new TextEncoder().encode(s);
      var num = 0n;
      for (var i = 0; i < bytes.length; i++) num = num * 256n + BigInt(bytes[i]);
      if (num === 0n) return ALPH[0];
      var r = '';
      while (num > 0n) { r = ALPH[Number(num % 60n)] + r; num = num / 60n; }
      return r;
    }
    
    // Use the token we got from the real response
    var keyPrefix = String.fromCharCode(99,104,97,88,115,50,45,45,99);
    var key = keyPrefix + o.t.substring(1, 5);
    var ts = Date.now();
    
    return crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
    .then(function(k) { return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(o.t + o.d + ts)); })
    .then(function(sig) {
      var b = ''; new Uint8Array(sig).forEach(function(b2) { b += String.fromCharCode(b2); });
      var d = { token: o.t, time: o.d, duration: o.d, isEnd: 'true', timestamp: ts, signature: btoa(b) };
      return fetch(o.srv + '/videoPlay/takeRecordByToken', {
        method: 'POST',
        headers: {'Content-Type':'text/html;charset=UTF-8'},
        body: toB60(JSON.stringify(d))
      }).then(function(r) { return r.text().then(function(t) { return 'st='+r.status+' r='+t.substring(0,150); }); })
      .catch(function(e) { return 'fe:'+e.message; });
    }).catch(function(e) { return 'ce:'+e.message; });
  }, {t: tokenToUse, d: duration, srv: serverUrl});
  
  log('Final: ' + result);
  return result.indexOf('code":"0"') >= 0 || result.indexOf('code":0') >= 0;
}

(async function() {
  fs.writeFileSync(LF,''); log('=== DONE v9 (response token) ===');
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(3000);
  if (p.url().indexOf('nosession')>=0||p.url().indexOf('commonLogin')>=0) {
    await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(3000);
    var lf=null;
    for(var i=0;i<20;i++){lf=p.frames().find(function(f){try{return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');}catch(e){return false;}});if(lf)break;await sl(2000);}
    await lf.waitForSelector('input',{timeout:15000});
    var ins=await lf.locator('input').all();
    await ins[0].fill(U); await ins[1].fill(P);
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'});
    log('W'); fs.writeFileSync(CF,''); var code='';
    while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
    log('C: '+code);
    await lf.locator('input').nth(2).type(code,{delay:20});
    await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
    for(var w=0;w<30;w++){var u=p.url();if(u.includes('v_selected_course')||u.includes('v_trainplan'))break;await sl(1000);}
    log('Logged in');
  } else log('Session OK');
  
  await sl(3000);
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(5000);
  await p.evaluate(function(){var b=Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;});if(b)b.click();});
  await sl(8000);
  
  var raw=fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
  var courses=JSON.parse(raw).data.courseStudyList||[];
  log('Courses: '+courses.length);
  
  for(var ci=0;ci<courses.length;ci++){
    var c=courses[ci];
    log('\n=== ('+(ci+1)+'/'+courses.length+') '+c.courseName+' ('+c.learnPercent+'%) ===');
    
    await p.evaluate(function(o){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.pl,platformId:'154',courseId:o.cd}});},{pl:PLAN,cd:c.courseId});
    await sl(5000);
    
    var chapters=await p.evaluate(function(){
      var b=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var l=[]; for(var i=0;i<b.length;i++) if(b[i].textContent.indexOf('\u5df2\u5b66\u5b8c')===-1) l.push(i);
      return l;
    });
    log('Chaps: '+chapters.length);
    if(chapters.length===0) continue;
    
    for(var ci2=0;ci2<chapters.length;ci2++){
      var pp=new Promise(function(r){p.once('popup',function(popup){r(popup);});});
      await p.evaluate(function(idx){var b=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');if(b[idx])b[idx].click();},chapters[ci2]);
      var popup=await Promise.race([pp,sl(30000).then(function(){return null;})]);
      if(!popup){log('No popup');continue;}
      try{await popup.waitForLoadState('load',{timeout:15000});}catch(e){}
      
      var pf=null;
      for(var w=0;w<20;w++){var frames=popup.frames();for(var f of frames){try{if(f.url().includes('content.hst360.com')){pf=f;break;}}catch(e){}}if(pf)break;await sl(1000);}
      
      if(pf) await completeChapter(popup, pf, chapters[ci2]);
      else log('NO PF');
      
      try{popup.close();}catch(e){}
      await sl(2000);
    }
    
    await p.evaluate(function(){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}});}).catch(function(){});
    await sl(5000);
  }
  
  log('\n=== ALL DONE');
  await sl(3000);
})();
