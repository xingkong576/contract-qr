const PW='C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const {chromium}=require(PW);
const fs=require('fs');
const U='622726198311030246',P='abc123';
const CF='C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF='C:/Users/Administrator/.openclaw/workspace/debug_log.txt';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function log(m){const t=new Date().toLocaleTimeString();console.log('['+t+'] '+m);fs.appendFileSync(LF,'['+t+'] '+m+'\n');}

(async()=>{
  fs.writeFileSync(LF,'');
  const b=await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage();await p.setViewportSize({width:1280,height:800});log('=== DEBUG ===');

  // Capture ALL API calls and responses
  p.on('request', r=>{
    var u=r.url();
    if(u.includes('gp.hst360.com/gp6/')&&!u.includes('.js')&&!u.includes('.css')&&!u.includes('.png')&&!u.includes('.jpg')&&!u.includes('favicon')&&!u.includes('udesk')) {
      log('>> '+r.method()+' '+u.substring(50,130));
    }
  });
  p.on('response', async r=>{
    try{
      var u=r.url();
      if(u.includes('gp.hst360.com/gp6/')&&(u.includes('progress')||u.includes('learn')||u.includes('study')||u.includes('record')||u.includes('video')||u.includes('complete')||u.includes('save'))) {
        var txt=await r.text();
        log('<< '+u.substring(50,120)+' | status='+r.status()+' body='+txt.substring(0,200));
      }
    }catch(e){}
  });

  // Login via iframe
  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});await sl(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sl(2000);}
  if(!lf){log('ERR: no login frame');return;}
  await lf.waitForSelector('input',{timeout:15000});const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_debug.png'});
  log('W');
  fs.writeFileSync(CF,'');let code='';while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'登录'}).click();await sl(12000);

  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }
  await p.evaluate(()=>{
    var b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('去学习'));
    if(b)b.click();
  });
  await sl(8000);
  log('HASH: '+await p.evaluate(()=>window.location.hash));

  // Go to course 1 details
  await p.evaluate((o)=>{
    var r=document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_courseDetails',query:{trainplanId:o.p,platformId:'154',courseId:o.c}});
  },{p:'af7e9b8dce964ebdab00c0647155de76',c:''});
  await sl(6000);
  log('DONE - check debug_log.txt for API calls');
})().catch(e=>{log('ERR: '+e.message);});
