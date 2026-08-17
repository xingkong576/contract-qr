const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/vue2_log.txt';

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
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_vue2.png'});
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

  // DEEP VUE SEARCH - find course data by all possible means
  log('=== DEEP VUE SEARCH ===');
  var result = await p.evaluate(function(){
    var vm = document.querySelector('#app').__vue__;
    var output = {};

    // Method 1: Check all _$children recursively
    function getAllChildren(comp, depth) {
      if(depth > 8 || !comp) return [];
      var arr = [];
      try {
        if(comp._data) {
          var keys = Object.keys(comp._data);
          if(keys.length > 0) arr.push({depth:depth, name:comp.$options.name||'anon', dataKeys:keys.slice(0,15), sample: JSON.stringify(comp._data[keys[0]]).substring(0, 60)});
          // Check each data key for course-like content
          for(var k in comp._data) {
            var v = comp._data[k];
            if(v && Array.isArray(v) && v.length>0 && v[0].name) {
              output.courses = {source:'_data.'+k, courseCount:v.length, first:v[0].name};
            }
          }
        }
        if(comp._watchers) arr[arr.length-1].watchers = comp._watchers.length;
      } catch(e) {}
      if(comp.$children) { for(var j=0;j<comp.$children.length;j++) { arr = arr.concat(getAllChildren(comp.$children[j], depth+1)); } }
      return arr;
    }
    output.components = getAllChildren(vm, 0);

    // Method 2: Check $store
    try { if(vm.$store) output.storeState = JSON.stringify(Object.keys(vm.$store.state)).substring(0,100); } catch(e){}

    // Method 3: Now find the actual course cards and extract their entity IDs
    output.domCourses = Array.from(document.querySelectorAll('.course-list li')).map(function(li){
      var r = li.getBoundingClientRect();
      var h3 = li.querySelector('h3');
      var progress = li.querySelector('.progress-line span, .progress');
      return {
        name: h3 ? h3.textContent.trim().substring(0,20) : '',
        progress: progress ? progress.textContent.trim() : '',
        rect: {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.w), h:Math.round(r.h)}
      };
    });

    // Method 4: Check if each course card has vue data
    var cardData = [];
    Array.from(document.querySelectorAll('.course-list li')).forEach(function(li, idx){
      if(li.__vue__) {
        cardData.push({idx:idx, vue:true});
      } else {
        // Check parent for vue
        var el = li.parentElement;
        while(el && el!==document.body) {
          if(el.__vue__) { cardData.push({idx:idx, parentVue:el.className.substring(0,30)}); break; }
          if(el.__vueParentComponent) { cardData.push({idx:idx, parentVueComp:true}); break; }
          el = el.parentElement;
        }
      }
    });
    output.cardVue = cardData;

    return output;
  });
  log('RESULT: ' + JSON.stringify(result).substring(0, 2000));

  // If DOM courses found, try clicking via the h3 text
  if(result.domCourses && result.domCourses.length>0) {
    for(var ci=0; ci<Math.min(result.domCourses.length, 1); ci++) {
      var c = result.domCourses[ci];
      log('CLICKING: '+c.name);
      await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/before_click.png'});

      // Method A: Click on the li via Playwright
      try {
        await p.locator('.course-list li').nth(ci).click({timeout:3000,force:true});
        await sl(5000);
        log('A route: '+await p.evaluate(function(){return window.location.hash;}));
      } catch(e) { log('A fail: '+e.message); }

      // Method B: Click with Vue $emit on the card
      await p.evaluate(function(idx){
        var items = document.querySelectorAll('.course-list li');
        if(items[idx]) {
          // Try to find and call the Vue component method
          var el = items[idx];
          var evt = document.createEvent('MouseEvents');
          evt.initMouseEvent('click', true, true, window, 0, 0, 0, el.getBoundingClientRect().left+50, el.getBoundingClientRect().top+50, false, false, false, false, 0, null);
          el.dispatchEvent(evt);
        }
      }, ci);
      await sl(5000);
      log('B route: '+await p.evaluate(function(){return window.location.hash;}));
    }
  }

  log('DONE - browser stays');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
