const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('=== FINAL ===');

  var courses = [];
  p.on('response', async function(resp){
    var url = resp.url();
    if(url.includes('selected_course')&&!url.includes('noPass')) {
      try {
        var txt = await resp.text();
        var json = JSON.parse(txt);
        if(json && json.data && json.data.courseStudyList) {
          courses = json.data.courseStudyList;
          log('CAPTURED '+courses.length+' courses');
        }
      } catch(e) {}
    }
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});
  await sl(5000);

  var lf = null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'});
  log('CAPTCHA');

  fs.writeFileSync(CF,'');var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:30});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  await sl(12000);
  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(function(){window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }

  await p.locator('button').filter({hasText:'\u53bb\u5b66\u4e60'}).first().click({timeout:8000,force:true});
  await sl(10000);

  log('COURSES FOUND: '+courses.length);
  if(courses.length==0) { log('NO COURSES'); await new Promise(function(){}); return; }

  for(var ci=0;ci<courses.length;ci++) {
    var c = courses[ci];
    log('\n=== '+ci+': '+(c.name||'?')+' ===');
    log('TYPES: '+Object.keys(c).join(', '));
    log('DATA: '+JSON.stringify(c).substring(0, 200));

    // Navigate to video
    var query = {trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'};
    if(c.id) query.courseId = c.id;
    if(c.entityId) query.entityId = c.entityId;
    if(c.courseId) query.courseId = c.courseId;

    log('NAV: '+JSON.stringify(query));
    await p.evaluate(function(q){ try{document.querySelector('#app').__vue__.$router.push({path:'/v_video',query:q});}catch(e){} }, query);
    await sl(6000);
    log('ROUTE: '+await p.evaluate(function(){return window.location.hash;}));

    // Find video
    var vf = false;
    for(var fi=0;fi<p.frames().length;fi++){
      try{var vi=await p.frames()[fi].evaluate(function(){var v=document.querySelector('video');if(!v)return null;return{pct:Math.round(v.currentTime/v.duration*100)};});
      if(vi){vf=true;log('VIDEO: '+vi.pct+'%');break;}}catch(e){}
    }

    if(vf){
      log('MONITOR...');
      for(var ti=0;ti<240;ti++){
        var s=null;
        for(var fi2=0;fi2<p.frames().length;fi2++){
          try{var vs=await p.frames()[fi2].evaluate(function(){var v=document.querySelector('video');if(!v)return null;return{pct:Math.round(v.currentTime/v.duration*100),paused:v.paused,ended:v.ended};});
          if(vs){s=vs;break;}}catch(e){}
        }
        if(!s){log('LOST VID');break;}
        if(ti%2===0||s.pct>0)log('PCT: '+s.pct+'%');
        if(s.ended||s.pct>=99){log('DONE!');await sl(3000);break;}
        if(s.paused){for(var fi3=0;fi3<p.frames().length;fi3++){try{await p.frames()[fi3].evaluate(function(){var v=document.querySelector('video');if(v)v.play();});}catch(e){}}}
        await sl(30000);
      }
    } else {
      log('NO VIDEO');
      await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/nv_'+ci+'.png'});
    }

    // Back
    await page.evaluate(function(){window.history.back();});
    await sl(5000);
  }

  log('\n=== ALL DONE! ===');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
