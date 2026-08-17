const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/autolog.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(m) { const t = new Date().toLocaleTimeString(); console.log('['+t+'] '+m); fs.appendFileSync(LF, '['+t+'] '+m+'\n'); }

(async () => {
  fs.writeFileSync(LF, '');
  const b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('START');

  // Get courses from API
  let courses = [];
  p.on('response', async r => {
    try {
      const u = r.url();
      if (u.includes('selected_course') && !u.includes('noPass')) {
        const j = JSON.parse(await r.text());
        if (j?.data?.courseStudyList) courses = j.data.courseStudyList;
      }
    } catch(e) {}
  });

  // Login
  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sleep(5000);
  let lf = null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sleep(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  const ins = await lf.locator('input').all();
  await ins[0].fill(USER); await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha.png'});
  log('CAPTCHA');
  fs.writeFileSync(CF,''); let code='';
  while(!code){await sleep(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'登录'}).click();
  await sleep(12000);
  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sleep(5000);
  }

  // Click "去学习"
  await p.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('去学习'));
    if(b)b.click();
  });
  await sleep(10000);
  log('Courses: '+courses.length);
  if(courses.length===0) return;

  for(let ci=0;ci<courses.length;ci++){
    const c = courses[ci];
    const cName = c.courseName||c.name||'?';
    const cId = c.courseId;
    const pct = parseInt(c.learnPercent)||0;
    log('\n--- '+(ci+1)+'/'+courses.length+': '+cName+' ('+pct+'%) ---');
    if(pct>=100){log('SKIP');continue;}

    // Go to course details
    await p.evaluate(o=>{
      try{document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.p,platformId:'154',courseId:o.c}});}catch(e){}
    },{p:'af7e9b8dce964ebdab00c0647155de76',c:cId});
    await sleep(6000);

    // Find all unstudied chapters and click them
    var chapters = await p.evaluate(()=>{
      var all = document.querySelectorAll('a.titlecolor.text');
      var list = [];
      for(var i=0;i<all.length;i++){
        list.push({txt:all[i].textContent.trim().substring(0,40)});
      }
      return list;
    });
    log('Chapters: '+chapters.length);

    for(let chi=0;chi<chapters.length;chi++){
      // Click this chapter
      await p.evaluate((idx)=>{
        var all = document.querySelectorAll('a.titlecolor.text');
        if(all[idx]){ all[idx].click(); return 'ok'; }
        return 'nope';
      }, chi);
      await sleep(8000);

      // Check for video in all frames
      var found = false;
      for(let fi=0;fi<p.frames().length;fi++){
        try{
          var vi = await p.frames()[fi].evaluate(()=>{
            var v = document.querySelector('video');
            var ifs = document.querySelectorAll('iframe');
            return {video:v?Math.round(v.currentTime/v.duration*100):-1, iframes:[...ifs].map(f=>{try{return f.src.substring(0,60);}catch(e){return '?';}}).join(',')};
          });
          if(vi && vi.video>=0){
            found=true;
            log('VIDEO: '+vi.video+'%');
            // Monitor
            for(let t=0;t<360;t++){
              var s = null;
              for(let fi2=0;fi2<p.frames().length;fi2++){
                try{
                  var vs = await p.frames()[fi2].evaluate(()=>{
                    var v = document.querySelector('video');
                    if(!v) return null;
                    return {pct:Math.round(v.currentTime/v.duration*100),paused:v.paused,ended:v.ended};
                  });
                  if(vs){s=vs;break;}
                }catch(e){}
              }
              if(!s){log('  LOST');break;}
              if(t%4===0)log('  PCT: '+s.pct+'%');
              if(s.ended||s.pct>=99){log('  DONE');await sleep(3000);break;}
              if(s.paused){
                for(let fi3=0;fi3<p.frames().length;fi3++){
                  try{await p.frames()[fi3].evaluate(()=>{var v=document.querySelector('video');if(v&&v.paused)v.play();});}catch(e){}
                }
              }
              await sleep(30000);
            }
            break; // done with this chapter
          }
        }catch(e){}
      }

      if(!found){
        log('  NO VIDEO for chapter '+chi);
        // Close any dialogs that might have opened
        await p.evaluate(()=>{
          var closeBtns = document.querySelectorAll('.el-dialog__headerbtn');
          for(var i=0;i<closeBtns.length;i++) closeBtns[i].click();
        });
        await sleep(2000);
      } else {
        break; // finished this course
      }
    }

    // Back to plan list for next course
    await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sleep(4000);
    await p.evaluate(()=>{
      const b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('去学习'));
      if(b)b.click();
    });
    await sleep(10000);
  }

  log('\n=== ALL DONE ===');
})().catch(e=>{log('ERR: '+e.message);});
