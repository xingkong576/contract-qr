const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/s5_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('S5');

  var courses = [];
  p.on('response', async function(resp){
    var url = resp.url();
    if(url.includes('selected_course')&&!url.includes('noPass')) {
      try{var t=await resp.text();var j=JSON.parse(t);if(j&&j.data&&j.data.courseStudyList)courses=j.data.courseStudyList;}catch(e){}
    }
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(5000);
  var lf=null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_s5.png'});
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
  await p.evaluate(function(){
    var btns=Array.from(document.querySelectorAll('button'));
    var b=btns.find(function(el){return el.textContent.includes('\u53bb\u5b66\u4e60');});
    if(b)b.click();
  });
  await sl(10000);

  // Go to details for first course
  var c0 = courses[0];
  log('FIRST: '+(c0.courseName||'')+' id='+c0.courseId);
  await p.evaluate(function(o){
    document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.planId,platformId:'154',courseId:o.courseId}});
  }, {courseId:c0.courseId, planId:'af7e9b8dce964ebdab00c0647155de76'});
  await sl(6000);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/details_page.png'});

  // Full button/clickable element analysis
  var ana = await p.evaluate(function(){
    var r = {};
    // Find "继续学习" in any element
    var all = document.querySelectorAll('*');
    var matches = [];
    for(var i=0;i<all.length;i++){
      var el = all[i];
      if(el.children.length > 0) continue; // skip parents with children (the text is in leaf nodes)
      var txt = (el.textContent||'').trim();
      if(txt.includes('\u7ee7\u7eed\u5b66\u4e60') || (txt.includes('\u7ee7\u7eed') && txt.includes('\u5b66\u4e60'))) {
        matches.push({tag:el.tagName, id:el.id, cls:el.className.substring(0,30), txt:txt.substring(0,20), parentTag:el.parentElement.tagName, parentCls:(el.parentElement.className||'').substring(0,30)});
      }
    }
    r.continueLearning = matches;

    // Also check buttons
    r.buttons = Array.from(document.querySelectorAll('button')).map(function(el){return {txt:el.textContent.trim().substring(0,20), cls:el.className.substring(0,30)};});
    
    // Find course-chapter clickable items
    r.anchors = Array.from(document.querySelectorAll('a')).map(function(el){return {txt:el.textContent.trim().substring(0,20), href:el.href.substring(0,40), cls:el.className.substring(0,30)};}).slice(0,15);
    
    // Full page HTML structure around course content area
    var mainArea = document.querySelector('.details-main') || document.querySelector('.shopping-right') || document.querySelector('.details-body') || document.querySelector('.details-shopping');
    if(mainArea) {
      r.mainHTML = mainArea.innerHTML.substring(0, 2000);
    } else {
      r.mainHTML = 'no main area found, body inner HTML first 2000 chars: '+document.body.innerHTML.substring(0,2000);
    }
    
    return r;
  });
  
  log('CONTINUE BTNS: '+JSON.stringify(ana.continueLearning));
  log('BUTTONS: '+JSON.stringify(ana.buttons));
  log('ANCHORS: '+JSON.stringify(ana.anchors.slice(0,10)));
  log('MAIN HTML: '+ana.mainHTML.substring(0, 3000));
  
  log('DONE');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
