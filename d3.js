const PW='C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const {chromium}=require(PW);
const fs=require('fs');
const U='622726198311030246',P='abc123';
const CF='C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF='C:/Users/Administrator/.openclaw/workspace/d3_log.txt';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function log(m){const t=new Date().toLocaleTimeString();console.log('['+t+'] '+m);fs.appendFileSync(LF,'['+t+'] '+m+'\n');}

(async()=>{
  fs.writeFileSync(LF,'');
  const b=await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage();await p.setViewportSize({width:1280,height:800});
  log('=== START ===\n');

  // Catch selected_course API full response
  var courseData = null;
  p.on('response', async r=>{
    try{
      var u = r.url();
      if(u.includes('selected_course') && !u.includes('noPass') && u.includes('trainplanId')){
        var txt = await r.text();
        courseData = txt;
        fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json', txt);
        log('SAVED course_data.json ('+txt.length+' bytes)');
      }
    }catch(e){}
  });

  // Login via iframe
  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});await sl(5000);
  var lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_d3.png'});
  log('WAIT CAPTCHA');
  fs.writeFileSync(CF,'');var code='';while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();await sl(12000);
  if(!p.url().includes('v_trainplan_list')){await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});await sl(5000);}

  // Click 去学习
  await p.evaluate(()=>{var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('\u53bb\u5b66\u4e60'));if(b)b.click();});
  await sl(10000);
  log('LOGIN DONE\n');

  // Read saved course data
  var courses=[];
  if(fs.existsSync('C:/Users/Administrator/.openclaw/workspace/course_data.json')){
    var raw=fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
    var j=JSON.parse(raw);
    if(j.data.courseStudyList) courses=j.data.courseStudyList;
    log('COURSES: '+courses.length);
    for(var c of courses) log('  '+c.courseId+' | '+c.courseName+' | '+c.learnPercent+'%');
  }

  // Find first incomplete course
  var target=null;
  for(var c of courses){var pct=parseInt(c.learnPercent)||0;if(pct<100){target=c;break;}}
  if(!target){log('All done!');return;}
  log('TARGET: '+target.courseName+' ('+target.learnPercent+'%)');

  // Navigate to course details
  await p.evaluate((o)=>{document.querySelector('#app').__vue__.$router.push({path:'/v_courseDetails',query:{trainplanId:o.p,platformId:'154',courseId:o.c}});},{p:'af7e9b8dce964ebdab00c0647155de76',c:target.courseId});
  await sl(6000);

  // List chapters
  var chs=await p.evaluate(()=>{
    var r=[];var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');var titles=document.querySelectorAll('a.titlecolor.text');
    for(var i=0;i<btns.length;i++) r.push({idx:i,status:btns[i].textContent.trim(),name:titles[i]?titles[i].textContent.trim():'?'});
    return r;
  });
  log('Chapters:');
  for(var ch of chs) log('  ['+ch.idx+'] '+ch.name+' | '+ch.status);

  // Click first uncompleted chapter
  var chTgt=chs.find(c=>!c.status.includes('\u5df2\u5b66\u5b8c'));
  if(!chTgt){log('ALL CH DONE');return;}

  // Capture all popup API calls
  var popupAPIs=[];
  log('CLICKING: '+chTgt.name);

  var popupP=new Promise(r=>{p.once('popup',popup=>r(popup));});
  await p.evaluate((idx)=>{var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');if(btns[idx])btns[idx].click();},chTgt.idx);
  var popup=await popupP;await popup.waitForLoadState();
  log('POPUP: '+popup.url());

  popup.on('response',async r=>{
    try{
      var u=r.url();
      if(!u.includes('/gp6/')) return;
      if(u.includes('.js')||u.includes('.css')||u.includes('.png')||u.includes('.jpg')) return;
      var body=await r.text();
      popupAPIs.push({url:u,status:r.status(),body:body});
      log('POPUP API ['+popupAPIs.length+']: '+u.substring(60,140));
      log('  STATUS: '+r.status());
      log('  BODY: '+body.substring(0,500)+'\n');
    }catch(e){}
  });

  // Wait then look for video
  await sl(6000);
  for(var fi=0;fi<popup.frames().length;fi++){
    try{
      var info=await popup.frames()[fi].evaluate(()=>{
        var v=document.querySelector('video');if(!v)return null;
        v.play();
        return{src:v.querySelector('source')?v.querySelector('source').src:v.src,dur:v.duration,cur:v.currentTime};
      });
      if(info){log('VIDEO FOUND: '+Math.floor(info.cur)+'/'+Math.floor(info.dur)+'s');break;}
    }catch(e){}
  }

  // Monitor for progress APIs (60 seconds)
  log('MONITORING 60s...');
  for(var i=0;i<6;i++){await sl(10000);log('  tick '+(i+1)*10+'s, popupAPIs captured: '+popupAPIs.length);}
  log('\n=== CAPTURED POPUP APIS ===');
  for(var a of popupAPIs){
    log('---');
    log('URL: '+a.url.substring(50,130));
    log('BODY: '+a.body.substring(0,600));
  }
  log('\n=== DONE ===');
})().catch(e=>{log('FATAL: '+e.message);});
