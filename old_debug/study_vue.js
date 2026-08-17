const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/vue_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('START');

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000});
  await sl(5000);

  var lf = null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  if(!lf){log('NO FRAME');return;}
  log('FRAME OK');

  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_vue.png'});
  log('CAPTCHA?');

  fs.writeFileSync(CF,'');var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);

  await lf.locator('input').nth(2).type(code,{delay:30});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  await sl(12000);
  log('URL: '+p.url());

  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(function(){window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }

  await p.locator('button').filter({hasText:'\u53bb\u5b66\u4e60'}).first().click({timeout:5000,force:true});
  await sl(8000);
  log('COURSE LIST: '+await p.evaluate(function(){return window.location.hash;}));

  // EXTRACT VUE COURSE DATA
  log('--- VUE DATA DUMP ---');
  var vuedata = await p.evaluate(function(){
    var vm = document.querySelector('#app').__vue__;
    var result = {router:null,routes:[],components:[],courseData:null};

    try { result.router = vm.$route.path; result.routes = vm.$router.options.routes.map(function(r){return r.path;}); } catch(e){}

    function findData(vnode, depth){
      if(depth>6||!vnode) return;
      var comp = vnode.componentInstance;
      if(comp && comp._data){
        for(var k in comp._data){
          var v = comp._data[k];
          if(v && Array.isArray(v) && v.length>0 && v[0].name){
            result.courseData = v.map(function(item){
              return {name:item.name,id:item.id,entityId:item.entityId,courseId:item.courseId,studyHours:item.studyHours};
            });
            result.componentKey = k;
            result.componentTag = vnode.tag;
            return;
          }
        }
        if(comp.$options && comp.$options.name){
          result.components.push(comp.$options.name);
        }
      }
      if(vnode.children){for(var ci=0;ci<vnode.children.length;ci++){findData(vnode.children[ci],depth+1);}}
      if(comp && comp.$vnode){findData(comp.$vnode,depth+1);}
    }
    findData(vm._vnode,0);
    return result;
  });
  log('VUE: '+JSON.stringify(vuedata));

  // If Vue data found, navigate directly
  if(vuedata && vuedata.courseData && vuedata.courseData.length>0){
    for(var ci=0;ci<vuedata.courseData.length;ci++){
      var c = vuedata.courseData[ci];
      log('COURSE '+ci+': '+c.name+' id='+c.id+' entityId='+c.entityId);

      // Navigate via Vue router
      await p.evaluate(function(cid, ceid){
        var router = document.querySelector('#app').__vue__.$router;
        router.push({path:'/v_video',query:{courseId:cid,entityId:ceid}});
      }, c.id, c.entityId);
      await sl(5000);
      log('R VIDEO: '+await p.evaluate(function(){return window.location.hash;}));

      // Check for video
      var vf = false;
      for(var fi=0;fi<p.frames().length;fi++){
        try{
          var vi = await p.frames()[fi].evaluate(function(){
            var v=document.querySelector('video');if(!v)return null;
            return {pct:Math.round(v.currentTime/v.duration*100)};
          });
          if(vi){vf=true;log('VIDEO: '+vi.pct+'%');break;}
        }catch(e){}
      }

      if(vf){
        log('MONITORING...');
        for(var ti=0;ti<240;ti++){
          var s=null;
          for(var fi2=0;fi2<p.frames().length;fi2++){
            try{
              var vs=await p.frames()[fi2].evaluate(function(){
                var v=document.querySelector('video');if(!v)return null;
                return {pct:Math.round(v.currentTime/v.duration*100),paused:v.paused,ended:v.ended};
              });
              if(vs){s=vs;break;}
            }catch(e){}
          }
          if(!s){log('LOST');break;}
          if(ti%2===0)log('PCT: '+s.pct+'%');
          if(s.ended||s.pct>=99){log('DONE');await sl(3000);break;}
          if(s.paused){
            for(var fi3=0;fi3<p.frames().length;fi3++){
              try{await p.frames()[fi3].evaluate(function(){var v=document.querySelector('video');if(v)v.play();});}catch(e){}
            }
          }
          await sl(30000);
        }
      } else {
        log('NO VIDEO for '+c.name);
        await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/nv_'+ci+'.png'});
      }

      // Back to course list
      await p.evaluate(function(){window.history.back();});
      await sl(5000);
    }
  }

  log('DONE');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
