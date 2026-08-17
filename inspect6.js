const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/d5_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== CHAPTER ===');

  let courses = [];
  p.on('response', async r => {
    try {
      const u=r.url();
      if(u.includes('selected_course')&&!u.includes('noPass')) {
        const j=JSON.parse(await r.text());
        if(j?.data?.courseStudyList) courses=j.data.courseStudyList;
      }
    } catch(e) {}
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sleep(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sleep(2000);}
  if(!lf){log('ERR: no login frame');return;}
  await lf.waitForSelector('input',{timeout:15000});
  const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_d5.png'});
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
  log('FIRST: '+(c.courseName||c.name));

  await p.evaluate(o=>{
    var r=document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_courseDetails',query:{trainplanId:o.planId,platformId:'154',courseId:o.courseId}});
  },{courseId:c.courseId,planId:'af7e9b8dce964ebdab00c0647155de76'});
  await sleep(6000);

  // Find ALL clickable chapter-like elements
  var links = await p.evaluate(() => {
    var all = document.querySelectorAll('li, a, span, div, p, h1, h2, h3, h4, h5, h6, i, em, strong');
    var result = [];
    for(var i=0;i<all.length;i++){
      var el = all[i];
      var txt = (el.textContent||'').trim().replace(/\s+/g,' ');
      if(txt.length > 3 && txt.length < 60) {
        var style = window.getComputedStyle(el);
        if(style.cursor === 'pointer' || el.tagName === 'A') {
          result.push({tag:el.tagName, cls:el.className.substring(0,30), txt:txt.substring(0,40)});
        }
      }
    }
    return result.slice(0,25);
  });
  log('CLICKABLES: '+JSON.stringify(links));

  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
