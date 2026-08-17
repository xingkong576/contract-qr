const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/p_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== play inspect ===');

  let courses = [];
  p.on('response', async r => {
    try { const u=r.url(); if(u.includes('selected_course')&&!u.includes('noPass')) { const j=JSON.parse(await r.text()); if(j?.data?.courseStudyList) courses=j.data.courseStudyList; } } catch(e) {}
  });
  p.on('frameattached', f => { log('FRAME: '+f.url().substring(0,80)); });
  p.on('framenavigated', f => { if(f.url().includes('gp.hst360.com')||f.url().includes('hst')) log('NAV:'+f.url().substring(0,80)); });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sleep(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sleep(2000);}
  if(!lf){log('ERR: no login frame');return;}
  await lf.waitForSelector('input',{timeout:15000});
  const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_p.png'});
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

  await p.evaluate(o=>{try{document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.planId,platformId:'154',courseId:o.courseId}});}catch(e){}},{courseId:c.courseId,planId:'af7e9b8dce964ebdab00c0647155de76'});
  await sleep(6000);

  // Click continue
  await p.evaluate(()=>{
    var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('继续学'));
    if(b){b.click();return 'clicked';}
    return 'nobtn';
  });
  await sleep(8000);

  // Inspect what appeared
  var insp = await p.evaluate(()=>{
    var r={};
    r.hash=window.location.hash;
    r.frames=document.querySelectorAll('iframe').length;
    r.videos=document.querySelectorAll('video').length;
    // All dialog-like elements
    r.dialogs=[...document.querySelectorAll('.el-dialog,.el-dialog__wrapper')].map(d=>({cls:d.className.substring(0,30),vis:window.getComputedStyle(d).display!=='none'})).slice(0,5);
    // Any hidden/shown containers
    r.allDialogs=[...document.querySelectorAll('[class*="dialog"],[class*="player"],[class*="video"],[class*="modal"],[class*="overlay"]')].map(d=>({cls:d.className.substring(0,30),vis:window.getComputedStyle(d).display,d:w.getComputedStyle(d).visibility})).slice(0,8);
    // NEW iframes
    r.iframeSrcs=[...document.querySelectorAll('iframe')].map(f=>f.src.substring(0,80));
    // Find PLAY button
    r.playBtns=[...document.querySelectorAll('button,span,a,div')].filter(el=>{
      var t=el.textContent.trim();
      return t.includes('播放')||t.includes('▶')||t.includes('▷')||t.includes('play')||t.includes('start');
    }).map(el=>({tag:el.tagName,cls:el.className.substring(0,30),txt:el.textContent.trim().substring(0,15),cursor:window.getComputedStyle(el).cursor})).slice(0,10);
    // Find all elements that appear to be clickable buttons in the page
    r.allBtns=[...document.querySelectorAll('button')].map(b=>({txt:b.textContent.trim().substring(0,15),cls:b.className.substring(0,30)})).slice(0,15);
    // Check what changed in HTML
    r.pageInner=document.querySelector('.details-body') ? document.querySelector('.details-body').innerHTML.substring(0,2000) : document.body.innerHTML.substring(1000,3000);
    return r;
  });

  log('DIALOGS: '+JSON.stringify(insp.dialogs));
  log('ALL DIALOGS: '+JSON.stringify(insp.allDialogs));
  log('IFRAMES: '+JSON.stringify(insp.iframeSrcs));
  log('PLAY BTNS: '+JSON.stringify(insp.playBtns));
  log('ALL BTNS: '+JSON.stringify(insp.allBtns));
  log('PAGE: '+insp.pageInner.substring(0,1500));

  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/after_play.png'});
  
  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
