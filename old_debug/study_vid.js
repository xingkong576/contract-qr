const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/vid_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('START');

  var courses = [];
  p.on('response', async function(resp){
    var url = resp.url();
    if(url.includes('selected_course')&&!url.includes('noPass')) {
      try {
        var txt = await resp.text();
        var json = JSON.parse(txt);
        if(json && json.data && json.data.courseStudyList) {
          courses = json.data.courseStudyList;
          log('GOT '+courses.length+' courses');
        }
      } catch(e) {}
    }
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});
  await sl(5000);

  var lf = null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_v.png'});
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
    var btns = Array.from(document.querySelectorAll('button'));
    var b = btns.find(function(el){return el.textContent.includes('\u53bb\u5b66\u4e60');});
    if(b) b.click();
  });
  await sl(10000);

  if(courses.length>0){
    var c0 = courses[0];
    var cid = c0.courseId;
    log('FIRST COURSE: '+(c0.courseName||'no-name')+' ID: '+cid);

    await p.evaluate(function(cid){
      var router = document.querySelector('#app').__vue__.$router;
      router.push({path:'/v_video',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154',courseId:cid}});
    }, cid);
    await sl(8000);
    log('R: '+await p.evaluate(function(){return window.location.hash;}));
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/v_page.png'});

    // DUMP PAGE CONTENT
    var pageInfo = await p.evaluate(function(){
      var r = {};
      r.hash = window.location.hash;
      r.text = document.body.innerText.substring(0, 600);
      r.videoCount = document.querySelectorAll('video').length;
      r.iframeCount = document.querySelectorAll('iframe').length;
      r.buttonTexts = Array.from(document.querySelectorAll('button, a')).slice(0,10).map(function(el){return el.textContent.trim().substring(0,20);});
      r.h3s = Array.from(document.querySelectorAll('h3,h2,h4')).slice(0,5).map(function(el){return el.textContent.trim().substring(0,30);});
      return r;
    });
    log('PAGE INFO: '+JSON.stringify(pageInfo).substring(0, 2000));

    // Also check Vue route params
    var routeInfo = await p.evaluate(function(){
      try{
        var r = document.querySelector('#app').__vue__.$route;
        return {path:r.path, query:JSON.stringify(r.query), params:JSON.stringify(r.params)};
      }catch(e){return {err:e.message};}
    });
    log('ROUTE: '+JSON.stringify(routeInfo));

    // Try navigating to course details
    await p.evaluate(function(cid){
      var router = document.querySelector('#app').__vue__.$router;
      router.push({path:'/v_courseDetails',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154',courseId:cid}});
    }, cid);
    await sl(8000);
    log('DETAILS R: '+await p.evaluate(function(){return window.location.hash;}));
    var detInfo = await p.evaluate(function(){
      return {text:document.body.innerText.substring(0,300), buttons:Array.from(document.querySelectorAll('button,a')).slice(0,5).map(function(el){return el.textContent.trim().substring(0,20);})};
    });
    log('DETAILS: '+JSON.stringify(detInfo).substring(0, 1000));
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/d_page.png'});
  }

  log('DONE');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
