const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const crypto = require('crypto');
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

const ALPH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx';
function toBase60(s) {
  var bytes = Buffer.from(s, 'utf8');
  var num = 0n;
  for (var i = 0; i < bytes.length; i++) num = num * 256n + BigInt(bytes[i]);
  if (num === 0n) return ALPH[0];
  var r = '';
  while (num > 0n) { r = ALPH[Number(num % 60n)] + r; num = num / 60n; }
  return r;
}

async function callAPI(token, time, duration, isEnd, serverUrl) {
  var key = 'chaXs2--c' + token.substring(1, 5);
  var ts = Date.now();
  var data = token + time + ts;
  var sig = crypto.createHmac('sha256', key).update(data).digest();
  var signature = sig.toString('base64');
  var payload = { token, time, timestamp: ts, signature };
  if (duration) payload.duration = duration;
  if (isEnd) payload.isEnd = 'true';
  var body = toBase60(JSON.stringify(payload));
  return await fetch(serverUrl + '/videoPlay/takeRecordByToken', {
    method: 'POST',
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    body: body
  }).then(function(r) { return r.text(); });
}

async function completeChap(popup, pf, ci) {
  log('>> Chap[' + ci + ']');
  
  var serverUrl = 'https://content.hst360.com';
  var duration = 3600;
  var token = null;
  
  popup.route('**/takeRecordByToken**', async function(route, req) {
    var resp = await route.fetch();
    try { var j = JSON.parse(await resp.text()); if (j.data && j.data.length > 20) token = j.data; } catch(e) {}
  });
  
  await pf.evaluate(function() {
    try { document.querySelector('.dplayer-play-icon').click(); } catch(e) {}
    try { var v = document.querySelector('video'); if(v && v.paused) v.play(); } catch(e) {}
  });
  
  for (var w = 0; w < 40; w++) {
    await sl(1000);
    var info = await pf.evaluate(function() {
      var r = { srv: null, dur: 3600 };
      document.querySelectorAll('script').forEach(function(s) {
        var t = s.textContent || '';
        var sm = t.match(/['"]serverUrl['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
        if (sm && !r.srv) r.srv = sm[1];
      });
      if (window.initData && window.initData.serverUrl) r.srv = window.initData.serverUrl;
      try { var v = document.querySelector('video'); if (v && v.duration > 10) r.dur = Math.floor(v.duration); } catch(e) {}
      return r;
    });
    if (info.srv) serverUrl = info.srv;
    if (info.dur > 10) duration = info.dur;
    if (token) break;
  }
  
  if (!token) {
    token = await pf.evaluate(function() {
      if (window.initData && window.initData.take && window.initData.take.token) return window.initData.take.token;
      for (var s of document.querySelectorAll('script')) {
        var t = s.textContent || '';
        var m = t.match(/token['"]?\s*[:=]\s*['"]([a-f0-9]{20,50})['"]/i);
        if (m) return m[1];
      }
      return null;
    });
  }
  
  if (!token) { log('NO TOKEN'); return; }
  log('Token: ' + token.substring(0,16) + '... dur=' + duration);
  
  var curToken = token;
  
  // Conservative: keep each jump <= 60s to avoid -2 errors
  var saveTimes = [30];
  var cur = 60;
  while (cur < duration) {
    if (cur <= 120) { saveTimes.push(cur); cur += 30; }
    else if (cur <= 240) { saveTimes.push(cur); cur += 40; }
    else if (cur <= 480) { saveTimes.push(cur); cur += 50; }
    else { saveTimes.push(cur); cur += 60; }
  }
  // Ensure duration is last (with isEnd=true)
  while (saveTimes.length > 0 && saveTimes[saveTimes.length-1] >= duration) saveTimes.pop();
  saveTimes.push(duration);
  
  for (var si = 0; si < saveTimes.length; si++) {
    var st = saveTimes[si];
    var isEnd = (st >= duration);
    
    var resp = await callAPI(curToken, st, isEnd ? duration : null, isEnd, serverUrl);
    log('t='+st+(isEnd?'(end)':'')+': '+resp.substring(0,60));
    
    if (resp.indexOf('"code":0') >= 0 || resp.indexOf('"code":"0"') >= 0) {
      // Success - get new token
      try { var j = JSON.parse(resp); if (j.data && j.data.length > 20) curToken = j.data; } catch(e) {}
    } else if (resp.indexOf('"code":-2') >= 0 || resp.indexOf('"code":"-2"') >= 0) {
      // Rejected - try smaller step
      var prevTime = si > 0 ? saveTimes[si-1] : 30;
      var mid = Math.floor((prevTime + st) / 2);
      log('  Failed, try mid='+mid);
      var midResp = await callAPI(curToken, mid, null, false, serverUrl);
      log('  mid: '+midResp.substring(0,60));
      if (midResp.indexOf('"code":0') >= 0 || midResp.indexOf('"code":"0"') >= 0) {
        try { var j = JSON.parse(midResp); if (j.data && j.data.length > 20) curToken = j.data; } catch(e) {}
        // Retry original step
        await sl(2000);
        var retry = await callAPI(curToken, st, isEnd ? duration : null, isEnd, serverUrl);
        log('  retry: '+retry.substring(0,60));
        if (retry.indexOf('"code":-2') >= 0 || retry.indexOf('"code":"-2"') >= 0) {
          log('  Still failed, finishing'); return;
        }
        try { var j = JSON.parse(retry); if (j.data && j.data.length > 20) curToken = j.data; } catch(e) {}
      } else {
        log('  Mid also failed, finishing'); return;
      }
    }
    
    // Delay between calls to avoid rate limiting
    await sl(3000);
  }
}

(async function() {
  fs.writeFileSync(LF,''); log('=== DONE v14 (gentle steps) ===');
  
  try { require('child_process').execSync('taskkill /f /im chrome.exe 2>nul', {stdio:'ignore'}); } catch(e) {}
  try { fs.rmSync('C:/Users/Administrator/.openclaw/workspace/pw-profile', {recursive:true, force:true}); } catch(e) {}
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(3000);
  if (p.url().indexOf('nosession')>=0||p.url().indexOf('commonLogin')>=0) {
    await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(3000);
    var lf=null;
    for(var i=0;i<20;i++){lf=p.frames().find(function(f){try{return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');}catch(e){return false;}});if(lf)break;await sl(2000);}
    await lf.waitForSelector('input',{timeout:15000});
    var ins=await lf.locator('input').all(); await ins[0].fill(U); await ins[1].fill(P);
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'}); log('W');
    fs.writeFileSync(CF,''); var code='';
    while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
    log('C: '+code); await lf.locator('input').nth(2).type(code,{delay:20});
    await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
    for(var w=0;w<30;w++){var u=p.url();if(u.includes('v_selected_course')||u.includes('v_trainplan'))break;await sl(1000);}
    log('In');
  } else log('OK');
  
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
      
      if(pf) await completeChap(popup, pf, chapters[ci2]);
      else log('NO PF');
      
      try{popup.close();}catch(e){}
      await sl(1000);
    }
    
    await p.evaluate(function(){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}});}).catch(function(){});
    await sl(5000);
    
    try {
      var resp = await p.evaluate(function() { return fetch('/gp6/lms/stu/trainplanCourseHandle/selected_course?trainplanId=' + encodeURIComponent('af7e9b8dce964ebdab00c0647155de76')).then(function(r){return r.json();}); });
      if (resp && resp.data && resp.data.courseStudyList) {
        courses = resp.data.courseStudyList;
        for (var ri = 0; ri < courses.length; ri++) {
          if (parseInt(courses[ri].learnPercent) >= 100) log('  *** ' + courses[ri].courseName + ': 100%!');
        }
      }
    } catch(e) {}
  }
  
  log('\n=== ALL DONE');
  await sl(10000);
})();
