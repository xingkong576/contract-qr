const PW='C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const {chromium}=require(PW);
const fs=require('fs');
const U='622726198311030246',P='abc123';
const CF='C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF='C:/Users/Administrator/.openclaw/workspace/go_log.txt';
const sl=ms=>new Promise(r=>setTimeout(r,ms));
function log(m){const t=new Date().toLocaleTimeString();console.log('['+t+'] '+m);fs.appendFileSync(LF,'['+t+'] '+m+'\n');}

async function studyChapters(p, planId, courseId) {
  await p.evaluate((o)=>{
    var r=document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_courseDetails',query:{trainplanId:o.p,platformId:'154',courseId:o.c}});
  },{p:planId,c:courseId});
  await sl(6000);

  var toStudy = await p.evaluate(()=>{
    var list=[];
    var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var titles=document.querySelectorAll('a.titlecolor.text');
    for(var i=0;i<btns.length;i++){
      var txt=btns[i].textContent.trim();
      if(!txt.includes('\u5df2\u5b66\u5b8c')){ // 已学完
        list.push({idx:i, name:titles[i]?titles[i].textContent.trim().substring(0,25):'?'});
      }
    }
    return list;
  });
  log('  Chaps:'+toStudy.length);
  for(var si=0;si<toStudy.length;si++) log('  '+si+': '+toStudy[si].name);

  for(var chi=0;chi<toStudy.length;chi++){
    var ch=toStudy[chi]; log('  -> '+ch.name);

    var popupP=new Promise(r=>{p.once('popup',popup=>r(popup));});
    await p.evaluate((idx)=>{var btns=document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');if(btns[idx])btns[idx].click();},ch.idx);
    var popup=await popupP; await popup.waitForLoadState('load');
    log('  Popup');
    await sl(6000);

    // Find video and play
    var found=false;
    for(var fi=0;fi<popup.frames().length;fi++){
      try{
        var vr=await popup.frames()[fi].evaluate(()=>{
          var v=document.querySelector('video');
          if(!v) return null;
          v.play();
          return {pct:Math.round(v.currentTime/v.duration*100),dur:Math.floor(v.duration)};
        });
        if(vr){
          found=true;
          log('  VID:'+vr.pct+'%/'+vr.dur+'s');
          for(var mt=0;mt<360;mt++){
            var vs=null;
            for(var fi2=0;fi2<popup.frames().length;fi2++){
              try{
                vs=await popup.frames()[fi2].evaluate(()=>{
                  var v=document.querySelector('video');if(!v)return null;
                  return {pct:Math.round(v.currentTime/v.duration*100),paused:v.paused,ended:v.ended};
                });
                if(vs) break;
              }catch(e){}
            }
            if(!vs){log('  LOST');break;}
            if(mt%4===0)log('  PC:'+vs.pct+'%');
            if(vs.ended||vs.pct>=99){log('  DONE');await sl(3000);break;}
            if(vs.paused){
              for(var fi3=0;fi3<popup.frames().length;fi3++){
                try{await popup.frames()[fi3].evaluate(()=>{var v=document.querySelector('video');if(v&&v.paused)v.play();});}catch(e){}
              }
            }
            await sl(30000);
          }
          break;
        }
      }catch(e){log('  FRAME ERR:'+e.message.substring(0,40));}
    }

    if(!found) log('  NO VID');

    try{await popup.close();}catch(e){}
    await sl(2000);
  }
}

(async()=>{
  fs.writeFileSync(LF,'');
  const b=await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  const p=await b.newPage();await p.setViewportSize({width:1280,height:800});
  log('=== GO ===');

  let courses=[];
  p.on('response',async r=>{
    try{const u=r.url();if(u.includes('selected_course')&&!u.includes('noPass')){const j=JSON.parse(await r.text());if(j?.data?.courseStudyList)courses=j.data.courseStudyList;}}catch(e){}
  });

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});await sl(5000);
  let lf=null;
  for(let i=0;i<20;i++){lf=p.frames().find(f=>f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin'));if(lf)break;await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});const ins=await lf.locator('input').all();
  await ins[0].fill(U);await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_go.png'});
  log('W');
  fs.writeFileSync(CF,'');let code='';while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();await sl(12000);
  if(!p.url().includes('v_trainplan_list')){await p.evaluate(()=>{window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});await sl(5000);}
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent.includes('\u53bb\u5b66\u4e60'));if(b)b.click();});await sl(10000);
  log('Courses:'+courses.length); if(courses.length===0) return;

  var PLANID='af7e9b8dce964ebdab00c0647155de76';
  for(var ci=0;ci<courses.length;ci++){
    var c=courses[ci]; var pct=parseInt(c.learnPercent)||0;
    log('\n--- '+(ci+1)+'/'+courses.length+': '+(c.courseName||c.name||'?')+' ('+pct+'%) ---');
    if(pct>=100){log('SKIP');continue;}
    await studyChapters(p, PLANID, c.courseId);
  }
  log('\n=== ALL DONE ===');
})().catch(e=>{log('ERR: '+e.message);});
