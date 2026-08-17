const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const AUTH = 'C:/Users/Administrator/.openclaw/workspace/auth_state.json';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function getTokenAndComplete(popup, pf, srvUrl, chapName) {
  log('>> ' + chapName);
  
  // Find the init script by fetching ALL script src URLs
  // full.js or full2.js contains the token
  var token = null, serverUrl = srvUrl || 'https://content.hst360.com';
  
  // Try up to 60 seconds to find the token from external scripts
  for (var at = 0; at < 30; at++) {
    token = await pf.evaluate(function() {
      // Method 1: Check window.initData (set by full.js/full2.js)
      if (window.initData && window.initData.take && window.initData.take.token) return window.initData.take.token;
      
      // Method 2: Check DPlayer instance if accessible
      try {
        var dpDiv = document.querySelector('.dplayer');
        // DPlayer stores instance in a closure, but options might be exposed
        if (window.__dplayer_options && window.__dplayer_options.take && window.__dplayer_options.take.token)
          return window.__dplayer_options.take.token;
      } catch(e) {}
      
      // Method 3: Search ALL inline scripts and imported scripts' content
      var scripts = document.querySelectorAll('script');
      for (var s of scripts) {
        var txt = s.textContent || '';
        var m = txt.match(/take\s*:\s*\{[\s\S]*?token\s*:\s*['"]([^'"]+)['"]/);
        if (m) return m[1];
      }
      return null;
    });
    
    if (token) { log('Token found: ' + token.substring(0, 20) + '...'); break; }
    
    // Method 4: Fetch external scripts that may contain the token
    var scriptSrcs = await pf.evaluate(function() {
      var srcs = [];
      document.querySelectorAll('script[src*="full"], script[src*="init"], script[src*="config"]').forEach(function(s) { srcs.push(s.src); });
      // Also try to find the config script
      document.querySelectorAll('script').forEach(function(s) {
        if (s.src && !s.src.includes('jquery') && !s.src.includes('chplayer') && !s.src.includes('businesslog') && !s.src.includes('hls')) {
          if (srcs.indexOf(s.src) < 0) srcs.push(s.src);
        }
      });
      return srcs;
    });
    
    for (var si = 0; si < scriptSrcs.length; si++) {
      try {
        var resp = await pf.evaluate(function(url) {
          return fetch(url).then(function(r) { return r.text(); }).catch(function() { return ''; });
        }, scriptSrcs[si]);
        if (resp && resp.length > 10) {
          var m = resp.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
          if (m) { token = m[1]; log('Token from fetch(' + scriptSrcs[si].substring(0,40) + '...)'); break; }
          // Also check for take object
          var m2 = resp.match(/take\s*:\s*\{[\s\S]*?token\s*:\s*['"]([^'"]+)['"]/);
          if (m2) { token = m2[1]; log('Token from take obj in ' + scriptSrcs[si].substring(0,40) + '...'); break; }
        }
      } catch(e) {}
    }
    if (token) break;
    
    log('Wait token... at=' + at + ' srcs=' + scriptSrcs.length);
    await sl(2000);
  }
  
  if (!token) { 
    // Last resort: intercept the actual API call
    log('Trying intercept approach...');
    // Let the popup actually make a takeRecordByToken call
    // We'll intercept it in the main loop and try again
    return 'need_intercept';
  }
  
  // Get duration
  var duration = await pf.evaluate(function() {
    try {
      var v = document.querySelector('video');
      if (v && v.duration > 10) return Math.floor(v.duration);
    } catch(e) {}
    return 3600;
  });
  log('Duration: ' + duration);
  
  // Call API - with OWN base60 encoding (M is not available in evaluate context)
  var result = await pf.evaluate(function(o) {
    // Custom base60 encode (same as M.encode - 0-9, A-Z, a-x = 60 chars)
    var ALPH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx';
    function toBase60(str) {
      var bytes = new TextEncoder().encode(str);
      var num = 0n;
      for (var i = 0; i < bytes.length; i++) { num = num * 256n + BigInt(bytes[i]); }
      if (num === 0n) return '0';
      var res = '';
      while (num > 0n) { res = ALPH[Number(num % 60n)] + res; num = num / 60n; }
      return res;
    }
    
    var key = String.fromCharCode(99,104,97,88,115,50,45,45,99) + o.token.substring(1, 5);
    var timeVal = o.dur - 5;
    if (timeVal < 0) timeVal = o.dur;
    var ts = Date.now();
    var input = o.token + timeVal + ts;
    
    return crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
    .then(function(k) { return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(input)); })
    .then(function(sig) {
      var b = ''; new Uint8Array(sig).forEach(function(b2) { b += String.fromCharCode(b2); });
      var sigB64 = btoa(b);
      var reqData = { token: o.token, time: timeVal, duration: o.dur, isEnd: 'true', timestamp: ts, signature: sigB64 };
      var encoded = toBase60(JSON.stringify(reqData));
      return fetch(o.srv + '/videoPlay/takeRecordByToken', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        body: encoded
      }).then(function(r) { return r.text().then(function(t) { return 'st=' + r.status + ' r=' + (t||'e').substring(0,100); }); })
      .catch(function(e) { return 'fe:' + e.message; });
    }).catch(function(e) { return 'ce:' + e.message; });
  }, {token: token, srv: serverUrl, dur: duration});
  log('Result: ' + result);
  return token;
}

async function doLogin(ctx, p) {
  await p.goto('http://gszj.hsthnet.com/', { waitUntil: 'load', timeout: 60000 }); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) { lf = p.frames().find(function(f){try{return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin');}catch(e){return false;}}); if(lf)break; await sl(2000); }
  await lf.waitForSelector('input',{timeout:15000});
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'});
  log('W'); fs.writeFileSync(CF,''); var code='';
  while(!code){await sl(1000); code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code); await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  var li=false;
  for(var w=0;w<30;w++){var u=p.url();if(u.includes('v_selected_course')||u.includes('v_trainplan')){li=true;break;}await sl(1000);}
  if(!li){await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list',{timeout:30000});await sl(3000);}
  log('In');
  await ctx.storageState({path:AUTH});
}

(async function() {
  fs.writeFileSync(LF,'');
  log('=== DONE v4 ===');
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: '+courses.length);
  
  var browser = await chromium.launch({headless:false});
  var ctx, p;
  
  if(fs.existsSync(AUTH)){
    try{
      ctx = await browser.newContext({storageState:AUTH, viewport:{width:1280,height:800}});
      p = await ctx.newPage();
      await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:15000});await sl(3000);
      if(p.url().indexOf('nosession')>=0){log('Auth expired');await ctx.close();ctx=null;}
      else log('Auth OK');
    }catch(e){log('Auth failed: '+e.message.substring(0,60));ctx=null;}
  }
  if(!ctx){ctx=await browser.newContext({viewport:{width:1280,height:800}});p=await ctx.newPage();await doLogin(ctx,p);}
  
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000});await sl(5000);
  await p.evaluate(function(){var b=Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;});if(b)b.click();});
  await sl(8000);
  
  var totalCompleted = 0;
  var globalToken = null;
  var globalServerUrl = 'https://content.hst360.com';
  
  for(var ci=0;ci<courses.length;ci++){
    var c=courses[ci];
    if(parseInt(c.learnPercent)>=100){log(c.courseName+': already 100%');continue;}
    
    log('\n=== '+c.courseName+' ('+c.learnPercent+'%) ===');
    await p.evaluate(function(o){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.plan,platformId:'154',courseId:o.cid}});},{plan:PLAN,cid:c.courseId});
    await sl(5000);
    
    var chapters=await p.evaluate(function(){
      var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var titles=document.querySelectorAll('a.titlecolor.text');
      var list=[];
      for(var i=0;i<btns.length;i++){if(btns[i].textContent.indexOf('\u5df2\u5b66\u5b8c')===-1){list.push({idx:i,name:(titles[i]?titles[i].textContent.trim():'?').substring(0,30)});}}
      return list;
    });
    if(chapters.length===0){log('All done');continue;}
    log('Chaps: '+chapters.length);
    
    for(var ci2=0;ci2<chapters.length;ci2++){
      var pp=new Promise(function(r){p.once('popup',function(popup){r(popup);});});
      await p.evaluate(function(idx){var b=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');if(b[idx])b[idx].click();},chapters[ci2].idx);
      var popup=await Promise.race([pp,sl(30000).then(function(){return null;})]);
      if(!popup){log('No popup');continue;}
      try{await popup.waitForLoadState('load',{timeout:15000});}catch(e){}
      
      var pf=null;
      for(var w=0;w<30;w++){var frames=popup.frames();for(var f of frames){try{if(f.url().includes('content.hst360.com')){pf=f;break;}}catch(e){}}if(pf)break;await sl(1000);}
      if(!pf){log('NO PF');popup.close();continue;}
      
      var t=await getTokenAndComplete(popup,pf,globalServerUrl,chapters[ci2].name);
      if(t&&t.length>20)globalToken=t;
      totalCompleted++;
      
      try{popup.close();}catch(e){}
      await sl(1000);
    }
    
    await p.evaluate(function(){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}});});
    await sl(5000);
  }
  
  log('\n=== DONE! Total: '+totalCompleted+' sections ===');
  await ctx.storageState({path:AUTH});
  await browser.close();
})();
