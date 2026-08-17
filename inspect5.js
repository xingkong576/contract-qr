const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246';
const P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/d4_log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== DIALOG ===');

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
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_d4.png'});
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

  // Click continue
  await p.evaluate(()=>{var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('继续学'));if(b)b.click();});
  await sleep(10000);

  // Inspect dialogs
  var di = await p.evaluate(() => {
    var dialogs = document.querySelectorAll('.el-dialog');
    var r = {};
    r.count = dialogs.length;
    r.info = [];
    for(var di2=0;di2<dialogs.length;di2++) {
      var d = dialogs[di2];
      var txt = d.textContent.trim().replace(/\s+/g,' ').substring(0,80);
      var style = window.getComputedStyle(d);
      r.info.push({
        idx:di2, zIndex:d.style.zIndex, vis:style.display,
        txt:txt,
        html:d.innerHTML.substring(0,400)
      });
    }
    // All buttons in visible dialogs
    r.allDialogBtns = [];
    var allBtns = document.querySelectorAll('.el-dialog button, .el-dialog a, .el-dialog [class*="play"], .el-dialog [class*="start"], .el-dialog span, .el-dialog i');
    for(var bi=0;bi<allBtns.length;bi++) {
      var el = allBtns[bi];
      r.allDialogBtns.push({tag:el.tagName, cls:el.className.substring(0,30), txt:(el.textContent||'').trim().substring(0,15), html:el.outerHTML.substring(0,100)});
    }
    // Also check for any new iframes
    r.allIframes = [];
    var allIfs = document.querySelectorAll('iframe');
    for(var fi=0;fi<allIfs.length;fi++) {
      try{ r.allIframes.push({src:allIfs[fi].src.substring(0,80), cls:allIfs[fi].className.substring(0,20), id:allIfs[fi].id}); } catch(e){}
    }
    return r;
  });

  log('DIALOGS: '+JSON.stringify(di.info));
  log('DIALOG BTNS: '+JSON.stringify(di.allDialogBtns));
  log('ALL IFRAMES: '+JSON.stringify(di.allIframes));
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/dialogs.png'});
  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
