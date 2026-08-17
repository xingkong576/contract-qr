const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/s7_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('S7');

  var courses = [];
  p.on('response', async function(resp){
    try {
      var url = resp.url();
      if(url.includes('selected_course')&&!url.includes('noPass')) {
        var t=await resp.text(); var j=JSON.parse(t);
        if(j&&j.data&&j.data.courseStudyList) {courses=j.data.courseStudyList; log('API CAPTURED: '+courses.length);}
      }
    } catch(e) {}
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(5000);

  var lf=null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_s7.png'});
  log('CAPTCHA');
  fs.writeFileSync(CF,'');var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:30});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  await sl(15000);

  // Go to plan list and click "去学习"
  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(function(){window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }
  await p.evaluate(function(){
    var btns=Array.from(document.querySelectorAll('button'));
    var b=btns.find(function(el){return el.textContent.includes('\u53bb\u5b66\u4e60');});
    if(b) {b.click(); return 'clicked';}
    return 'nobtn';
  });
  await sl(10000);
  log('COURSES FROM API: '+courses.length);

  if(courses.length>0){
    var c0 = courses[0];
    log('FIRST: '+(c0.courseName||c0.name||'no-name')+' id='+c0.courseId);
    
    // Go to details - pass single object arg
    await p.evaluate(function(o){
      try{
        document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.planId,platformId:'154',courseId:o.courseId}});
      } catch(e){ console.error(e); }
    }, {courseId:c0.courseId, planId:'af7e9b8dce964ebdab00c0647155de76'});
    await sl(8000);
    log('DET HASH: '+await p.evaluate(function(){return window.location.hash;}));
    
    // DUMP full details page
    var det = await p.evaluate(function(){
      var r = {};
      r.hash = window.location.hash;
      
      // Full HTML structure around the main content
      var interesting = document.querySelector('.details-body') || document.querySelector('.el-main') || document.querySelector('.main') || document.querySelector('#app > div');
      if(interesting) r.html = interesting.outerHTML.substring(0, 6000);
      else r.html = document.getElementById('app').innerHTML.substring(0, 6000);
      
      // Find ALL elements with "继续" text
      var all = document.querySelectorAll('button, a, span, div, p, h1, h2, h3, h4, h5');
      r.continueEls = [];
      for(var i=0;i<all.length;i++){
        var el=all[i];
        var txt=el.textContent.trim().replace(/\s+/g,' ');
        if(txt.includes('\u7ee7\u7eed') && (txt.includes('\u5b66\u4e60') || txt.includes('\u64ad\u653e'))) {
          r.continueEls.push({
            tag:el.tagName, cls:el.className.substring(0,30), id:el.id,
            txt:txt.substring(0,30), outer:el.outerHTML.substring(0,150)
          });
        }
      }
      
      return r;
    });
    
    log('HASH: '+det.hash);
    log('CONTINUE ELEMENTS: '+JSON.stringify(det.continueEls));
    log('HTML: '+det.html.substring(0, 4000));
    
  } else {
    log('NO COURSES');
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/no_courses.png'});
  }

  log('DONE');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
