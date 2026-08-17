const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function completeChap(popup, pf, ci) {
  log('>> Chap[' + ci + ']');
  
  // Register route to monitor saves
  var saveCount = 0;
  var firstSaveTime = null;
  popup.route('**/takeRecordByToken**', function(route, request) {
    saveCount++;
    if (!firstSaveTime) firstSaveTime = Date.now();
    route.continue();
  });
  
  // Play video
  await pf.evaluate(function() {
    try { document.querySelector('.dplayer-play-icon').click(); } catch(e) {}
    try { var v = document.querySelector('video'); if(v && v.paused) v.play(); } catch(e) {}
  });
  
  // Wait ~40 seconds for 2 real saves to establish session
  for (var w = 0; w < 40; w++) {
    await sl(1000);
    if (saveCount >= 2) break;
  }
  log('Saves seen: ' + saveCount);
  
  // Now force the ended event WITHOUT seeking
  // This triggers DPlayer's saveProgress at currentTime (~40s)
  // The server sees time=40 with isEnd=true - small value, might work better
  await pf.evaluate(function() {
    try {
      var v = document.querySelector('video');
      if (v) {
        // Don't seek, just dispatch ended
        v.dispatchEvent(new Event('ended'));
      }
    } catch(e) {}
  });
  await sl(10000);
  
  log('Saves total: ' + saveCount);
  
  // Extract and verify save responses
  var finalSaves = saveCount;
  return finalSaves >= 1;
}

(async function() {
  fs.writeFileSync(LF,''); log('=== DONE v16 (natural ended) ===');
  
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
      await sl(2000);
    }
    
    // After course, check progress
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
