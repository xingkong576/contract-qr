const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/final2_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

async function studyVideo(p, cid, planId) {
  // Navigate to course details
  log('-> course details');
  await p.evaluate(function(cid2, pid){
    var r = document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_courseDetails',query:{trainplanId:pid,platformId:'154',courseId:cid2}});
  }, cid, planId);
  await sl(5000);
  
  // Click "继续学习" button
  await p.evaluate(function(){
    var btns = Array.from(document.querySelectorAll('button'));
    var b = btns.find(function(el){return el.textContent.includes('\u7ee7\u7eed\u5b66\u4e60');});
    if(b) { b.click(); return 'clicked'; }
    return 'not found';
  });
  await sl(8000);
  
  // Now on v_video page - find video
  var vf = false;
  for(var fi=0;fi<p.frames().length;fi++){
    try{
      var vi=await p.frames()[fi].evaluate(function(){
        var v=document.querySelector('video');
        if(!v) return null;
        return {pct:Math.round(v.currentTime/v.duration*100), dur:Math.floor(v.duration)};
      });
      if(vi){vf=true;log('VIDEO: '+vi.pct+'% / '+vi.dur+'s');break;}
    }catch(e){}
  }
  
  if(vf){
    log('MONITOR START');
    for(var ti=0;ti<360;ti++){
      var s=null;
      for(var fi2=0;fi2<p.frames().length;fi2++){
        try{
          var vs=await p.frames()[fi2].evaluate(function(){
            var v=document.querySelector('video');
            if(!v) return null;
            return {pct:Math.round(v.currentTime/v.duration*100), paused:v.paused, ended:v.ended};
          });
          if(vs){s=vs;break;}
        }catch(e){}
      }
      if(!s){log('VIDEO LOST, checking page'); await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/vlost.png'}); break;}
      if(ti%6===0)log('PCT: '+s.pct+'%');
      if(s.ended||s.pct>=99){log('DONE!');await sl(3000);break;}
      if(s.paused){
        for(var fi3=0;fi3<p.frames().length;fi3++){
          try{await p.frames()[fi3].evaluate(function(){var v=document.querySelector('video');if(v)v.play();});}catch(e){}
        }
      }
      await sl(30000);
    }
    return true;
  } else {
    log('NO VIDEO on v_video');
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/novideo.png'});
    return false;
  }
}

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== FINAL AUTO STUDY ===');

  var courses = [];
  p.on('response', async function(resp){
    var url = resp.url();
    if(url.includes('selected_course')&&!url.includes('noPass')) {
      try{
        var txt=await resp.text();
        var json=JSON.parse(txt);
        if(json&&json.data&&json.data.courseStudyList) courses=json.data.courseStudyList;
      }catch(e){}
    }
  });

  // LOGIN
  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(5000);
  var lf = null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_f2.png'});
  log('CAPTCHA');
  fs.writeFileSync(CF,'');var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:30});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  await sl(12000);
  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(function(){window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }

  // Enter plan
  await p.evaluate(function(){
    var btns=Array.from(document.querySelectorAll('button'));
    var b=btns.find(function(el){return el.textContent.includes('\u53bb\u5b66\u4e60');});
    if(b)b.click();
  });
  await sl(10000);
  log('COURSES: '+courses.length);
  
  var planId = 'af7e9b8dce964ebdab00c0647155de76';
  
  for(var ci=0;ci<courses.length;ci++){
    var c = courses[ci];
    var cid = c.courseId;
    var progress = parseInt(c.learnPercent)||0;
    log('\n=== '+(ci+1)+'/'+courses.length+': '+(c.courseName||'')+' ('+progress+'%) ===');
    
    if(progress>=100) { log('ALREADY 100%, skip'); continue; }
    
    var ok = await studyVideo(p, cid, planId);
    if(!ok) {
      log('FAILED, trying next course');
    }
    
    // Go back to plan
    await p.evaluate(function(){
      window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';
    });
    await sl(3000);
    await p.evaluate(function(){
      var btns=Array.from(document.querySelectorAll('button'));
      var b=btns.find(function(el){return el.textContent.includes('\u53bb\u5b66\u4e60');});
      if(b)b.click();
    });
    await sl(8000);
  }
  
  log('\n=== ALL COURSES COMPLETE ===');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
