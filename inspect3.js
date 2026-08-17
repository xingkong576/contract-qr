const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/p2_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== FIXED ===');

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
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_p2.png'});
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
  await sleep(8000);

  // FULL page dump after clicking continue
  var insp = await p.evaluate(()=>{
    var r = {};
    r.hash = window.location.hash;
    
    // All iframes
    r.iframeSrcs = [...document.querySelectorAll('iframe')].map(f=>{try{return f.src.substring(0,100);}catch(e){return 'no-src';}});
    
    // All video elements
    r.videos = [...document.querySelectorAll('video')].map(v=>({src:(v.src||'').substring(0,80),paused:v.paused,w:v.videoWidth,h:v.videoHeight}));
    
    // Any element with "播放" or "play" in text
    r.playBtns = [...document.querySelectorAll('button, a, span, div')].filter(el=>{
      var t = (el.textContent||'').trim();
      return t.includes('播放') || t === '▶' || t === '▷' || t === '|>' || t.toLowerCase().includes('play');
    }).slice(0,10).map(el=>({tag:el.tagName, cls:el.className.substring(0,30), txt:(el.textContent||'').trim().substring(0,15), displayed:window.getComputedStyle(el).display!=='none'}));

    // Buttons on page
    r.allBtns = [...document.querySelectorAll('button')].map(b=>({txt:(b.textContent||'').trim().substring(0,15), cls:b.className.substring(0,30)})).slice(0,12);

    // Look for video-related HTML
    var details = document.querySelector('.details-body') || document.querySelector('.el-main') || document.querySelector('.study-content') || document.querySelector('.video-box');
    var html = details ? details.innerHTML : document.body.innerHTML.substring(500, 3000);
    r.html = html.substring(0, 3000);
    
    return r;
  });

  log('IFRAMES: '+JSON.stringify(insp.iframeSrcs));
  log('VIDEOS: '+JSON.stringify(insp.videos));
  log('PLAY BTNS: '+JSON.stringify(insp.playBtns));
  log('ALL BTNS: '+JSON.stringify(insp.allBtns));
  log('HTML: '+insp.html.substring(0,2500));

  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/after_p2.png'});
  
  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
