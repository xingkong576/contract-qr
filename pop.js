const PW='C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const {chromium}=require(PW);
const fs=require('fs');
const U='622726198311030246',P='abc123';
const CF='C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF='C:/Users/Administrator/.openclaw/workspace/pop_log.txt';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function log(m){const t=new Date().toLocaleTimeString();console.log('['+t+'] '+m);fs.appendFileSync(LF,'['+t+'] '+m+'\n');}

(async()=>{
  fs.writeFileSync(LF,'');
  const b=await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage();await p.setViewportSize({width:1280,height:800});log('POP');

  // Listen for NEW POPUPS
  b.on('targetcreated', target => {
    log('TARGET: type='+target.type()+' url='+target.url().substring(0,80));
  });
  p.on('popup', popup => {
    log('POPUP: url='+popup.url());
    popup.on('load', ()=>{log('POPUP LOADED: '+popup.url().substring(0,80));});
  });

  let courses=[];
  p.on('response',async r=>{
    try{const u=r.url();if(u.includes('selected_course')&&!u.includes('noPass')){const j=JSON.parse(await r.text());if(j?.data?.courseStudyList)courses=j.data.courseStudyList;}}catch(e){}
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});await sl(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_pop.png'});
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

  // Click chapter 0
  log('CLICK STATUS BTN (not title)...');
  // Try clicking the STATUS button (已学完/学习中/未学习) instead of chapter title
  await p.evaluate(()=>{
    var all=document.querySelectorAll('.button.fr.mt10.border-public.t');
    if(all[0]){all[0].click();return 'clicked status 0';}
    // Fallback to chapter title
    var ch=document.querySelectorAll('a.titlecolor.text');
    if(ch[0]){ch[0].click();return 'clicked chapter 0';}
    return 'nope';
  });
  await sl(12000);

  // Check for popups and new content
  var dp=await p.evaluate(()=>{
    var r={};
    r.hash=window.location.hash;
    // Check ALL iframes including cross-origin
    r.iframes=[...document.querySelectorAll('iframe')].map(f=>{var src='';try{src=f.src;}catch(e){src='cross';}return src.substring(0,80);});
    // Check ALL videos
    r.vids=[...document.querySelectorAll('video')].length;
    // Check entire body for hidden content
    r.bodyLen=document.body.innerText.length;
    // Check for new divs or sections
    r.allClassed=[...document.querySelectorAll('[class]')].filter(el=>{
      var c=el.className;
      return typeof c==='string' && (c.includes('video')||c.includes('play')||c.includes('media')||c.includes('Player')||c.includes('player')||c.includes('dialog')||c.includes('player'));
    }).map(el=>el.className.substring(0,30)).slice(0,15);
    r.btns=[...document.querySelectorAll('button')].map(b=>({txt:(b.textContent||'').trim().substring(0,15),cls:b.className.substring(0,30)})).slice(0,20);
    return r;
  });
  log('HASH: '+dp.hash);
  log('IFRAMES: '+JSON.stringify(dp.iframes));
  log('VIDS: '+dp.vids);
  log('SPECIAL: '+JSON.stringify(dp.allClassed));
  log('BTNS: '+JSON.stringify(dp.btns));

  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/pop.png'});
  log('DONE');
})().catch(e=>{log('ERR: '+e.message);});
