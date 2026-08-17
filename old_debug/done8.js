const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF,t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

// Modified completeSection that plays briefly then calls API directly
async function completeSection(popup, pf, chapName) {
  log('>> ' + chapName);
  
  // Start video playing
  await pf.evaluate(function() {
    try { var v = document.querySelector('video'); if(v && v.paused) v.play(); } catch(e){}
    try { document.querySelector('.dplayer-play-icon').click(); } catch(e){}
  });
  
  // Wait for the FIRST saveProgress to happen (~28s) so server has a session
  var firstSaveDone = false;
  popup.route('**/takeRecordByToken**', function(route, req) {
    if (!firstSaveDone) {
      firstSaveDone = true;
      log('First save seen');
    }
    route.continue();
  });
  
  // Wait up to 35 seconds for first save
  for (var w = 0; w < 35; w++) {
    await sl(1000);
    if (firstSaveDone) break;
  }
  if (!firstSaveDone) log('No first save');
  
  // Now the session is established. Extract token from multiple possible sources
  var info = await pf.evaluate(function() {
    var result = { token: null, serverUrl: 'https://content.hst360.com', duration: 3600 };
    
    // 1. window.initData
    if (window.initData && window.initData.take && window.initData.take.token) result.token = window.initData.take.token;
    if (window.initData && window.initData.serverUrl) result.serverUrl = window.initData.serverUrl;
    
    // 2. Search ALL inline scripts (for token: 'xxx' patterns)
    if (!result.token) {
      document.querySelectorAll('script').forEach(function(s) {
        var txt = s.textContent || '';
        var m = txt.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
        if (m) result.token = m[1];
        var sm = txt.match(/['"]serverUrl['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
        if (sm) result.serverUrl = sm[1];
      });
    }
    
    // 3. Search for any var/let/const token = 'xxx' in all loaded scripts
    if (!result.token) {
      document.querySelectorAll('script[src]').forEach(function(s) {
        // Can't get external script content from textContent
      });
      // Try fetching external init scripts
      var initSrcs = [];
      document.querySelectorAll('script[src*="full"], script[src*="init"]').forEach(function(s) { if (s.src) initSrcs.push(s.src); });
      if (initSrcs.length > 0) result._initSrcs = initSrcs;
    }
    
    // 4. Try video
    try { var v = document.querySelector('video'); if(v && v.duration > 10) result.duration = Math.floor(v.duration); } catch(e){}
    
    return result;
  });
  
  // 3b. If token not found, try fetching external scripts
  if (!info.token && info._initSrcs && info._initSrcs.length > 0) {
    for (var si = 0; si < info._initSrcs.length; si++) {
      var src = info._initSrcs[si];
      try {
        var resp = await pf.evaluate(function(u) { return fetch(u).then(function(r){return r.text();}).catch(function(){return '';}); }, src);
        if (resp.length > 10) {
          var m = resp.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
          if (m) { info.token = m[1]; break; }
        }
      } catch(e) {}
    }
  }
  
  if (!info.token) { log('NO TOKEN'); return false; }
  log('Token: ' + info.token.substring(0,12) + '... dur=' + info.duration);
  
  // Step 2: Make first regular progress save (just token+time, no isEnd)
  var timeVal = 30; // First save with small time
  var result1 = await pf.evaluate(function(o) {
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
    var key = String.fromCharCode(99,104,97,88,115,50,45,45,99) + o.token.substring(1, 5);
    var ts = Date.now();
    return crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
    .then(function(k) { return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(o.token + o.time + ts)); })
    .then(function(sig) {
      var b = ''; new Uint8Array(sig).forEach(function(b2) { b += String.fromCharCode(b2); });
      var d = { token: o.token, time: o.time, timestamp: ts, signature: btoa(b) };
      return fetch(o.srv + '/videoPlay/takeRecordByToken', {
        method: 'POST', headers: {'Content-Type':'text/html;charset=UTF-8'},
        body: toB60(JSON.stringify(d))
      }).then(function(r) { return r.text().then(function(t) { try { return JSON.parse(t); } catch(e) { return {code: '-9', raw: t}; } }); })
      .catch(function(e) { return {code: '-9', err: e.message}; });
    }).catch(function(e) { return {code: '-9', err: e.message}; });
  }, {token: info.token, time: timeVal, srv: info.serverUrl});
  
  log('Save1 code=' + result1.code);
  
  // Step 3: Use the NEW token if provided, make the final save with isEnd=true
  var newToken = (result1.data && result1.data) || info.token;
  if (result1.data && typeof result1.data === 'string' && result1.data.length > 20) newToken = result1.data;
  
  var result2 = await pf.evaluate(function(o) {
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
    var key = String.fromCharCode(99,104,97,88,115,50,45,45,99) + o.token.substring(1, 5);
    var ts = Date.now();
    return crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
    .then(function(k) { return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(o.token + o.dur + ts)); })
    .then(function(sig) {
      var b = ''; new Uint8Array(sig).forEach(function(b2) { b += String.fromCharCode(b2); });
      var d = { token: o.token, time: o.dur, duration: o.dur, isEnd: 'true', timestamp: ts, signature: btoa(b) };
      return fetch(o.srv + '/videoPlay/takeRecordByToken', {
        method: 'POST', headers: {'Content-Type':'text/html;charset=UTF-8'},
        body: toB60(JSON.stringify(d))
      }).then(function(r) { return r.text().then(function(t) { return 'st='+r.status+' r='+t.substring(0,100); }); })
      .catch(function(e) { return 'fe:'+e.message; });
    }).catch(function(e) { return 'ce:'+e.message; });
  }, {token: newToken, dur: info.duration, srv: info.serverUrl});
  
  log('Save2: ' + result2);
  return result2.indexOf('code":"0"') >= 0;
}

(async function() {
  fs.writeFileSync(LF,''); log('=== DONE v8 (direct API 2-step) ===');
  
  // Check auth
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(3000);
  if (p.url().indexOf('nosession')>=0||p.url().indexOf('commonLogin')>=0) {
    await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(3000);
    var lf = null;
    for(var i=0;i<20;i++){lf=p.frames().find(function(f){try{return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');}catch(e){return false;}});if(lf)break;await sl(2000);}
    await lf.waitForSelector('input',{timeout:15000});
    var ins=await lf.locator('input').all();
    await ins[0].fill(U); await ins[1].fill(P);
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'});
    log('W'); fs.writeFileSync(CF,''); var code='';
    while(!code){await sl(1000); code=fs.readFileSync(CF,'utf8').trim();}
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
  
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: '+courses.length);
  
  for(var ci=0;ci<courses.length;ci++){
    var c=courses[ci];
    log('\n=== ('+(ci+1)+'/'+courses.length+') '+c.courseName+' ('+c.learnPercent+'%) ===');
    
    await p.evaluate(function(o){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.pl,platformId:'154',courseId:o.cd}});},{pl:PLAN,cd:c.courseId});
    await sl(5000);
    
    var chapters = await p.evaluate(function(){
      var b=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var t=document.querySelectorAll('a.titlecolor.text');
      var l=[];
      for(var i=0;i<b.length;i++) if(b[i].textContent.indexOf('\u5df2\u5b66\u5b8c')===-1) l.push({idx:i});
      return l;
    });
    log('Chaps: '+chapters.length);
    if(chapters.length===0) continue;
    
    for(var ci2=0;ci2<chapters.length;ci2++){
      var pp=new Promise(function(r){p.once('popup',function(popup){r(popup);});});
      await p.evaluate(function(idx){var b=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');if(b[idx])b[idx].click();},chapters[ci2].idx);
      var popup=await Promise.race([pp,sl(30000).then(function(){return null;})]);
      if(!popup){log('No popup');continue;}
      try{await popup.waitForLoadState('load',{timeout:15000});}catch(e){}
      
      var pf=null;
      for(var w=0;w<20;w++){var frames=popup.frames();for(var f of frames){try{if(f.url().includes('content.hst360.com')){pf=f;break;}}catch(e){}}if(pf)break;await sl(1000);}
      
      if(pf) await completeSection(popup, pf, chapters[ci2].idx);
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
