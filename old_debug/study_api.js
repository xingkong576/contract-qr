const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/api_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('START');

  // Intercept API responses
  var capturedApis = [];
  p.on('response', async function(resp){
    var url = resp.url();
    if(url.includes('/gp6/lms') || url.includes('selectedCourse') || url.includes('courseList')) {
      try {
        var txt = await resp.text();
        capturedApis.push({url:url.substring(0,80), status:resp.status(), body: txt.substring(0, 300)});
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
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_api.png'});
  log('CAPTCHA?');

  fs.writeFileSync(CF,'');var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);

  await lf.locator('input').nth(2).type(code,{delay:30});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  await sl(12000);
  log('URL: '+p.url());

  capturedApis = [];
  if(!p.url().includes('v_trainplan_list')){
    await p.evaluate(function(){window.location.href='https://gp.hst360.com/index.html#/v_trainplan_list';});
    await sl(5000);
  }

  await p.locator('button').filter({hasText:'\u53bb\u5b66\u4e60'}).first().click({timeout:5000,force:true});
  await sl(8000);
  log('COURSE LIST: '+await p.evaluate(function(){return window.location.hash;}));
  await sl(2000);

  log('=== CAPTURED APIS ===');
  for(var ai=0;ai<capturedApis.length;ai++){
    log('API '+ai+': '+capturedApis[ai].url);
    log('  STATUS: '+capturedApis[ai].status);
    log('  BODY: '+capturedApis[ai].body);
  }

  // Also get data from Vue $store or component data
  var vueInfo = await p.evaluate(function(){
    var r = {};
    var vm = document.querySelector('#app').__vue__;
    // Check all _$children for data arrays with course info
    function findCourses(comp, depth) {
      if(depth>8||!comp) return;
      if(comp._data) {
        for(var k in comp._data) {
          var v = comp._data[k];
          if(v && typeof v==='object' && v.rows && Array.isArray(v.rows)) {
            r.found = {key:k, rows:v.rows.length, sample:JSON.stringify(v.rows[0]).substring(0,200)};
            return;
          }
          if(v && typeof v==='object' && v.list && Array.isArray(v.list)) {
            r.found = {key:k, list:v.list.length, sample:JSON.stringify(v.list[0]).substring(0,200)};
            return;
          }
        }
      }
      if(comp.$children) { for(var j=0;j<comp.$children.length;j++) { findCourses(comp.$children[j], depth+1); } }
    }
    findCourses(vm, 0);

    // Check $store
    try {
      if(vm.$store) {
        r.storeKeys = Object.keys(vm.$store.state);
        for(var sk in vm.$store.state) {
          var sv = vm.$store.state[sk];
          if(sv && typeof sv==='object' && sv.rows) {
            r.storeCourse = {key:sk, rows:sv.rows.length, sample:JSON.stringify(sv.rows[0]).substring(0,200)};
          }
          if(sv && typeof sv==='object' && sv.list) {
            r.storeCourse2 = {key:sk, list:sv.list.length, sample:JSON.stringify(sv.list[0]).substring(0,200)};
          }
        }
      }
    } catch(e) {}

    // Check DOM data attributes
    r.cardCount = document.querySelectorAll('.course-list li').length;
    var cards = document.querySelectorAll('.course-list li');
    r.sampleAttrs = cards.length>0 ? Array.from(cards[0].attributes).map(function(a){return a.name+'='+a.value;}).slice(0,10) : [];

    return r;
  });
  log('VUE INFO: '+JSON.stringify(vueInfo).substring(0, 500));

  log('DONE');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
