const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/s_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== INSPECT ===');

  let courses = [];
  p.on('response', async r => {
    try { const u=r.url(); if(u.includes('selected_course')&&!u.includes('noPass')) { const j=JSON.parse(await r.text()); if(j?.data?.courseStudyList) courses=j.data.courseStudyList; } } catch(e) {}
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sleep(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sleep(2000);}
  if(!lf){log('ERR: no login frame');return;}
  await lf.waitForSelector('input',{timeout:15000});
  const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_s.png'});
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
  log('STUDYING: '+(c.courseName||c.name)+' ('+c.learnPercent+'%)');

  // Go to details
  await p.evaluate(o=>{try{document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.planId,platformId:'154',courseId:o.courseId}});}catch(e){}},{courseId:c.courseId,planId:'af7e9b8dce964ebdab00c0647155de76'});
  await sleep(6000);

  // BEFORE clicking: capture page state
  log('BEFORE CLICK:');
  var before = await p.evaluate(()=>{
    var r={};
    r.frames=document.querySelectorAll('iframe').length;
    r.videos=document.querySelectorAll('video').length;
    r.content=document.body.innerText.substring(0,300);
    r.btns=[...document.querySelectorAll('button')].map(b=>({txt:b.textContent.trim().substring(0,20),cls:b.className.substring(0,30)})).slice(0,8);
    return r;
  });
  log(JSON.stringify(before).substring(0,800));

  // Click "继续学习"
  await p.evaluate(()=>{
    var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('继续学'));
    if(b)b.click();
  });
  await sleep(8000);

  // AFTER clicking: what changed?
  log('AFTER CLICK:');
  var after = await p.evaluate(()=>{
    var r={};
    r.hash=window.location.hash;
    r.frames=document.querySelectorAll('iframe').length;
    r.videos=document.querySelectorAll('video').length;
    r.iframes=[...document.querySelectorAll('iframe')].map(f=>{try{var s=f.src.substring(0,80);return s;}catch(e){return 'cross-origin'}});
    r.newElements=document.querySelectorAll('.el-dialog,.video-player,.play-box,.media-player,video').length;
    r.content=document.body.innerText.substring(0,300);
    // Check if any new sections appeared
    r.visibleWidth=window.innerWidth;
    // Check all sections that might have appeared
    r.sections=[...document.querySelectorAll('.el-main,.el-aside,.mainContent,.study-content,.details-body,.video-box,.vplayer')].map(el=>el.className.substring(0,30)).slice(0,5);
    return r;
  });
  log(JSON.stringify(after).substring(0,800));

  // Take screenshot to see what happened
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/after_click.png'});

  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
