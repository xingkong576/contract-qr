const PW='C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const {chromium}=require(PW);
const fs=require('fs');
const U='622726198311030246',P='abc123';
const CF='C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF='C:/Users/Administrator/.openclaw/workspace/debug2_log.txt';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function log(m){const t=new Date().toLocaleTimeString();console.log('['+t+'] '+m);fs.appendFileSync(LF,'['+t+'] '+m+'\n');}

async function findFrame(page, urlPattern){
  for(var i=0;i<20;i++){
    var f=page.frames().find(f=>f.url().includes(urlPattern));
    if(f) return f;
    await sl(2000);
  }
  return null;
}

(async()=>{
  fs.writeFileSync(LF,'');
  const b=await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage();await p.setViewportSize({width:1280,height:800});log('=== FIND API ===');

  // Track all API calls
  var apiCalls=[];
  p.on('response',async r=>{
    try{
      var u=r.url();
      if(!u.includes('/gp6/')) return;
      if(u.includes('.js')||u.includes('.css')||u.includes('.png')||u.includes('.jpg')||u.includes('favicon')) return;
      var isDone = u.includes('complete')||u.includes('progress')||u.includes('study')||u.includes('record')||u.includes('save')||u.includes('learn');
      if(isDone){
        var txt=await r.text();
        log('PROGRESS: '+u.substring(60,140));
        log('  BODY: '+txt.substring(0,300));
      }
    }catch(e){}
  });

  // Login
  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});await sl(5000);
  var lf = await findFrame(p, 'gp.hst360.com');
  if(!lf){log('ERR: no login frame');return;}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);

  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_debug2.png'});
  log('W');
  fs.writeFileSync(CF,'');var code='';while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();await sl(12000);

  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }

  // Click 去学习
  await p.evaluate(()=>{
    var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('\u53bb\u5b66\u4e60'));
    if(b)b.click();
  });
  await sl(10000);
  log('HASH: '+await p.evaluate(()=>window.location.hash));

  // Get course list from API
  var courses = await p.evaluate(()=>{
    try{
      var app=document.querySelector('#app').__vue__;
      if(app.$data && app.$data.courseStudyList) return app.$data.courseStudyList.map(c=>({courseId:c.courseId,courseName:c.courseName,learnPercent:c.learnPercent}));
      return [];
    }catch(e){return [];}
  });
  log('Courses via Vue: '+JSON.stringify(courses));

  // Go to first incomplete course
  var target = null;
  for(var c of courses){
    var pct=parseInt(c.learnPercent)||0;
    if(pct<100){target=c;break;}
  }
  if(!target){log('No incomplete courses');return;}
  log('Target: '+target.courseName+' ('+target.learnPercent+'%) courseId='+target.courseId);

  // Navigate to course details
  await p.evaluate((o)=>{
    var r=document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_courseDetails',query:{trainplanId:o.p,platformId:'154',courseId:o.c}});
  },{p:'af7e9b8dce964ebdab00c0647155de76',c:target.courseId});
  await sl(6000);

  // Get chapter buttons
  var chapters = await p.evaluate(()=>{
    var list=[];
    var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles=document.querySelectorAll('a.titlecolor.text');
    for(var i=0;i<btns.length;i++){
      list.push({idx:i,text:btns[i].textContent.trim(),title:titles[i]?titles[i].textContent.trim():'?'});
    }
    return list;
  });
  log('Chapters:');
  chapters.forEach(ch=>log('  ['+ch.idx+'] '+ch.title+' | '+ch.text));

  // Find first not-completed chapter
  var chTarget = chapters.find(ch=>!ch.text.includes('\u5df2\u5b66\u5b8c'));
  if(!chTarget){log('All completed');return;}
  log('Clicking: '+chTarget.title+' ('+chTarget.text+')');

  // Capture popup, click chapter button, intercept all API
  var popupP=new Promise(r=>{p.once('popup',popup=>r(popup));});
  await p.evaluate((idx)=>{
    var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    if(btns[idx]) btns[idx].click();
  },chTarget.idx);
  var popup=await popupP; await popup.waitForLoadState();
  log('Popup URL: '+popup.url());
  await sl(8000);

  // Intercept popup APIs
  popup.on('response',async r=>{
    try{
      var u=r.url();
      if(!u.includes('/gp6/')) return;
      if(u.includes('.js')||u.includes('.css')||u.includes('.png')||u.includes('.jpg')) return;
      var txt=await r.text();
      log('POPUP API: '+u.substring(60,140));
      log('  BODY: '+txt.substring(0,500)+'\n');
    }catch(e){}
  });

  // Find video in popup
  for(var fi=0;fi<popup.frames().length;fi++){
    try{
      var info = await popup.frames()[fi].evaluate(()=>{
        var v=document.querySelector('video');
        if(!v) return null;
        v.play();
        var src = v.querySelector('source') ? v.querySelector('source').src : v.src;
        return {src:src||'', dur:v.duration, cur:v.currentTime};
      });
      if(info){
        log('VIDEO: dur='+info.dur+'s cur='+info.cur+'s');
        log('SRC: '+info.src);
        break;
      }
    }catch(e){}
  }

  // Monitor for a bit to catch progress APIs
  log('Monitoring progress APIs for 30 seconds...');
  for(var i=0;i<3;i++){
    await sl(10000);
    log('Watching... '+(i+1)*10+'s');
  }
  log('=== DONE ===');
})().catch(e=>{log('ERR: '+e.message);});
