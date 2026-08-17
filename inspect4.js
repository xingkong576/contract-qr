const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/p3_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== DEEP ===');

  let courses = [];
  p.on('response', async r => {
    try {
      const u=r.url();
      if(u.includes('selected_course')&&!u.includes('noPass')) { const j=JSON.parse(await r.text()); if(j?.data?.courseStudyList) courses=j.data.courseStudyList; }
    } catch(e) {}
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sleep(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sleep(2000);}
  if(!lf){log('ERR: no login frame');return;}
  await lf.waitForSelector('input',{timeout:15000});
  const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_p3.png'});
  log('WAITING CAPTCHA...');
  fs.writeFileSync(CF,'');let code='';
  while(!code){await sleep(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('CAPTCHA: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'登录'}).click();
  await sleep(12000);
  if(!p.url().includes('v_trainplan_list')){await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});await sleep(5000);}

  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('去学习'));if(b)b.click();});
  await sleep(10000);
  if(courses.length===0){log('ERR: no courses');return;}

  const c = courses[0];
  log('FIRST: '+(c.courseName||c.name)+' ('+c.learnPercent+'%)');

  await p.evaluate(o=>{document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.planId,platformId:'154',courseId:o.courseId}});},{courseId:c.courseId,planId:'af7e9b8dce964ebdab00c0647155de76'});
  await sleep(6000);

  // Click continue
  await p.evaluate(()=>{
    var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('继续学'));
    if(b){b.click();return 'clicked';}
    return 'nobtn';
  });

  // Wait for dynamic content
  await sleep(12000);

  // Full inspection
  var after = await p.evaluate(()=>{
    var r = {};
    r.hash = window.location.hash;
    r.iframes = [...document.querySelectorAll('iframe')].map(f=>{
      try{return {src:f.src.substring(0,80),id:f.id,cls:f.className.substring(0,20)};}catch(e){return {src:'?'};}
    });
    r.videos = [...document.querySelectorAll('video')].map(v=>({
      src:(v.src||'').substring(0,60), paused:v.paused, ended:v.ended,
      w:v.videoWidth, h:v.videoHeight,
      rect:JSON.stringify(v.getBoundingClientRect()),
      style:window.getComputedStyle(v).display+','+window.getComputedStyle(v).visibility,
      dur:v.duration, current:v.currentTime
    }));
    // Page dialog elements
    r.dialogs = [...document.querySelectorAll('.el-dialog')].map(d=>({
      cls:d.className.substring(0,30), display:window.getComputedStyle(d).display
    }));
    // Check for any hidden containers
    r.allChildren = [...document.getElementById('app').children].map(c=>c.className.substring(0,50)).slice(0,10);
    r.fullHTML = document.getElementById('app').innerHTML.substring(0,5000);
    r.visibleText = document.body.innerText.substring(0,800);
    r.bodyHTML = document.body.innerHTML.substring(500, 5000);
    return r;
  });

  log('HASH: '+after.hash);
  log('IFRAMES: '+JSON.stringify(after.iframes));
  log('VIDEOS: '+JSON.stringify(after.videos));
  log('DIALOGS: '+JSON.stringify(after.dialogs));
  log('TEXT: '+after.visibleText.substring(0,600));
  log('CHILDREN: '+after.allChildren.join('|'));

  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/after_p3.png'});
  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
