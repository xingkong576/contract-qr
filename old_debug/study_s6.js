const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');

const USER = '622726198311030246';
const PASS = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/s6_log.txt';

function log(m) { var t=new Date().toLocaleTimeString(); var l='['+t+'] '+m; console.log(l); fs.appendFileSync(LF, l+'\n'); }
function sl(ms) { return new Promise(function(r){setTimeout(r,ms);}); }

(async () => {
  fs.writeFileSync(LF, '');
  var b = await chromium.launch({headless:false,executablePath:'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'});
  var p = await b.newPage();
  await p.setViewportSize({width:1280,height:800});
  log('S6');

  await p.goto('http://gszj.hsthnet.com/',{waitUntil:'load',timeout:60000}); await sl(5000);
  var lf=null;
  for(var i=0;i<15;i++){lf=p.frames().find(function(f){return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');});if(lf){break;}await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all();
  await ins[0].fill(USER);await ins[1].fill(PASS);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_s6.png'});
  log('CAPTCHA');
  fs.writeFileSync(CF,'');var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:30});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  await sl(15000);
  
  // Navigate directly to course list page to trigger API
  await p.evaluate(function(){
    var r = document.querySelector('#app').__vue__.$router;
    r.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154',hidePlanEndDate:'false'}});
  });
  await sl(8000);
  log('HASH: '+await p.evaluate(function(){return window.location.hash;}));

  // Now manually extract API data from page
  var courses = await p.evaluate(function(){
    // Try to find course data in Vue component
    var vm = document.querySelector('#app').__vue__;
    var found = null;
    function search(comp, depth) {
      if(depth>10||!comp||found) return;
      if(comp.courseStudyList) {found=comp.courseStudyList; return;}
      if(comp._data && comp._data.courseStudyList) {found=comp._data.courseStudyList; return;}
      if(comp.courses) {found=comp.courses; return;}
      if(comp.$children) {for(var i=0;i<comp.$children.length;i++) search(comp.$children[i], depth+1);}
    }
    search(vm, 0);
    return found ? Array.from(found).map(function(c){return {courseId:c.courseId, courseName:c.courseName||c.name, learnPercent:c.learnPercent};}) : null;
  });
  
  if(courses && courses.length>0){
    log('FOUND '+courses.length+' courses from Vue');
    for(var ci=0;ci<courses.length;ci++){
      log('  '+ci+': '+JSON.stringify(courses[ci]));
    }
    
    // Analyze details page for first course
    if(courses.length>0){
      var cid = courses[0].courseId;
      log('\nFIRST COURSE: '+courses[0].courseName+' id='+cid);
      
      await p.evaluate(function(courseId, planId){
        var r = document.querySelector('#app').__vue__.$router;
        r.push({path:'/v_courseDetails',query:{trainplanId:planId,platformId:'154',courseId:courseId}});
      }, cid, 'af7e9b8dce964ebdab00c0647155de76');
      await sl(6000);
      
      await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/details_s6.png'});
      
      // Deep dive into course details page structure
      var det = await p.evaluate(function(){
        var r = {};
        // Find all clickable elements with study-related text
        var all = document.querySelectorAll('button, a, span[class*="btn"], div[class*="btn"]');
        r.clickables = Array.from(all).map(function(el){
          return {tag:el.tagName, cls:el.className.substring(0,40), txt:el.textContent.trim().substring(0,30), onclick:el.getAttribute('onclick')||'', href:el.getAttribute('href')||'', computedStyle:window.getComputedStyle(el).cursor};
        });
        
        // Find "继续学习" button specifically - check all elements
        var allEls = document.querySelectorAll('*');
        for(var i=0;i<allEls.length;i++){
          var el = allEls[i];
          var txt = el.textContent.trim();
          if(txt.includes('\u7ee7\u7eed\u5b66\u4e60') || txt.includes('\u7ee7\u7eed\u5b66')) {
            var style = window.getComputedStyle(el);
            if(style.cursor==='pointer' || el.tagName==='BUTTON' || el.tagName==='A' || el.className.includes('btn') || el.className.includes('button')) {
              r.continueBtn = {
                tag:el.tagName, cls:el.className.substring(0,40), id:el.id, html:el.outerHTML.substring(0,200),
                parentCls:el.parentElement.className.substring(0,30), cursor:style.cursor, clickable:el.onclick?'yes':'no'
              };
              break;
            }
          }
        }

        // Also try finding the area with study progress text
        var body = document.body;
        var mainContent = document.querySelector('.details-body') || document.querySelector('.shopping-right') || document.querySelector('.mainContent') || document.querySelector('.el-main');
        if(mainContent) {
          r.mainCls = mainContent.className.substring(0,30);
          r.mainHTML = mainContent.innerHTML.substring(0, 4000);
        } else {
          r.mainHTML = body.innerHTML.substring(1000, 4000);
        }
        
        return r;
      });
      
      log('CLICKABLES (btn/a): '+JSON.stringify(det.clickables));
      log('CONTINUE BTN: '+JSON.stringify(det.continueBtn));
      log('MAIN HTML: '+det.mainHTML);
    }
  } else {
    log('NO COURSES FOUND in Vue');
    var dump = await p.evaluate(function(){
      var vm = document.querySelector('#app').__vue__;
      var keys = Object.keys(vm);
      var dataKeys = vm._data ? Object.keys(vm._data).join(',') : 'no_data';
      var childCount = vm.$children ? vm.$children.length : 0;
      return {keys:keys.join(','), dataKeys:dataKeys, children:childCount};
    });
    log('VUE DUMP: '+JSON.stringify(dump));
  }

  log('DONE');
  await new Promise(function(){});
})().catch(function(e){log('ERR: '+e.message);process.exit(1);});
