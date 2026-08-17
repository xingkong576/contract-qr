const PW='C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const {chromium}=require(PW);
const fs=require('fs');
const U='622726198311030246',P='abc123';
const CF='C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF='C:/Users/Administrator/.openclaw/workspace/zz_log.txt';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function log(m){const t=new Date().toLocaleTimeString();console.log('['+t+'] '+m);fs.appendFileSync(LF,'['+t+'] '+m+'\n');}

(async()=>{
  fs.writeFileSync(LF,'');
  const b=await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage();await p.setViewportSize({width:1280,height:800});log('Z');
  let courses=[];
  p.on('response',async r=>{
    try{const u=r.url();if(u.includes('selected_course')&&!u.includes('noPass')){const j=JSON.parse(await r.text());if(j?.data?.courseStudyList)courses=j.data.courseStudyList;}}catch(e){}
  });
  // Capture API responses for chapter clicks
  p.on('response',async r=>{
    var u=r.url();
    if(u.includes('/gp6/lms/')&&!u.includes('favicon')&&!u.includes('selected_course')){
      try{
        var txt=await r.text();
        if(txt.length>10&&txt.length<3000) log('RESP:'+u.substring(0,80)+' | '+txt.substring(0,200));
      }catch(e){}
    }
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});await sl(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_z.png'});
  log('W');
  fs.writeFileSync(CF,'');let code='';while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'登录'}).click();await sl(12000);
  if(!p.url().includes('v_trainplan_list')){await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});await sl(5000);}
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('去学习'));if(b)b.click();});await sl(10000);

  const c=courses[0];log('C1: '+(c.courseName||c.name));
  await p.evaluate((o)=>{
    var r=document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_courseDetails',query:{trainplanId:o.p,platformId:'154',courseId:o.c}});
  },{p:'af7e9b8dce964ebdab00c0647155de76',c:c.courseId});
  await sl(6000);

  // Get chapter hrefs
  var hrefs=await p.evaluate(()=>{
    return [...document.querySelectorAll('a.titlecolor.text')].map(a=>{
      return {txt:a.textContent.trim().substring(0,30),href:a.getAttribute('href')};
    });
  });
  log('CHAPTERS: '+JSON.stringify(hrefs));

  // Click chapter 0
  log('CLICK CHAPTER 0...');
  await p.evaluate(()=>{document.querySelectorAll('a.titlecolor.text')[0].click();});
  await sl(10000);

  // Full dump
  var d=await p.evaluate(()=>{
    var r={};
    r.hash=window.location.hash;
    r.frames=[...document.querySelectorAll('iframe')].map(f=>{try{return{src:f.src.substring(0,100),id:f.id};}catch(e){return{};}});
    r.videos=[...document.querySelectorAll('video')].map(v=>({src:(v.src||'').substring(0,60),paused:v.paused}));
    r.newElems=[...document.querySelectorAll('[class*=\"video\"],[class*=\"play\"],[class*=\"media\"],[class*=\"player\"]')].map(el=>({cls:el.className.substring(0,30),tag:el.tagName,vis:window.getComputedStyle(el).display})).slice(0,10);
    r.btns=[...document.querySelectorAll('button')].map(b=>({txt:(b.textContent||'').trim().substring(0,15),cls:b.className.substring(0,30)})).slice(0,25);
    r.html=document.getElementById('app').innerHTML.substring(500,3000);
    return r;
  });
  log('HASH: '+d.hash);
  log('FRAMES: '+JSON.stringify(d.frames));
  log('VIDEOS: '+JSON.stringify(d.videos));
  log('NEW: '+JSON.stringify(d.newElems));
  log('BTNS: '+JSON.stringify(d.btns));

  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/zz.png'});
  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
