const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log2.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function doLogin(p) {
  await p.goto('http://gszj.hsthnet.com/', {waitUntil:'load', timeout:60000}); await sl(3000);
  var lf=null;
  for(var i=0;i<20;i++){lf=p.frames().find(f=>{try{return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');}catch(e){return false;}});if(lf)break;await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all(); await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_p2.png'}); log('W');
  fs.writeFileSync(CF,''); var code='';
  while(!code){await sl(1000);code=fs.readFileSync(CF,'utf8').trim();}
  log('C: '+code); await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  for(var w=0;w<30;w++){var u=p.url();if(u.includes('v_trainplan'))break;await sl(1000);}
  log('In');
}

async function completeChap(popup, pf, chapName) {
  log('>> ' + chapName);
  var saveCount = 0;
  try { popup.route('**/takeRecordByToken**', (route,req)=>{saveCount++;route.continue().catch(()=>{});}); } catch(e) {}
  
  await pf.evaluate(function() {
    try { var el = document.querySelector('.dplayer-play-icon'); if(el) el.click(); } catch(e) {}
    try { var v = document.querySelector('video'); if(v && v.paused) v.play(); } catch(e) {}
  });
  
  for (var w = 0; w < 40; w++) { await sl(1000); if (saveCount >= 2) break; }
  log('Saves: ' + saveCount);
  
  await pf.evaluate(function() {
    try { var v = document.querySelector('video'); if(v) v.dispatchEvent(new Event('ended')); } catch(e) {}
  });
  await sl(10000);
  log('Total saves: ' + saveCount);
}

(async function() {
  fs.writeFileSync(LF,''); log('=== DONE PAGE2 v10 (extract after page click) ===');
  try { require('child_process').execSync('taskkill /f /im chrome.exe 2>nul', {stdio:'ignore'}); } catch(e) {}
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  await doLogin(p);
  
  // Navigate to course list
  await p.evaluate(function(pid) {
    var app = document.querySelector('#app');
    if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course', query:{trainplanId:pid, platformId:'154'}});
  }, PLAN);
  await sl(5000);
  
  // Click page 2 in pagination - this triggers Vue to load page 2 data into listData
  log('Clicking page 2...');
  var p2triggered = await p.evaluate(function() {
    var pages = document.querySelectorAll('.el-pagination li.number');
    for (var i=0; i<pages.length; i++) {
      if (pages[i].textContent.trim() === '2') { pages[i].click(); return true; }
    }
    return false;
  });
  log('Page 2 clicked: ' + p2triggered);
  await sl(3000);
  
  // Now extract page 2 courses from Vue listData (which should now have the page 2 data)
  log('Extracting page 2 course IDs from Vue...');
  var p2Courses = await p.evaluate(function() {
    // Find the Vue component with listData
    var all = document.querySelectorAll('section');
    for (var el of all) {
      try {
        var vm = el.__vue__;
        if (vm && vm.listData) {
          return vm.listData.map(function(c) {
            return { courseId: c.courseId, courseName: c.courseName, learnPercent: c.learnPercent };
          });
        }
        if (vm && vm._data && vm._data.listData) {
          return vm._data.listData.map(function(c) {
            return { courseId: c.courseId, courseName: c.courseName, learnPercent: c.learnPercent };
          });
        }
      } catch(e) {}
    }
    return null;
  });
  
  if (!p2Courses || p2Courses.length === 0) {
    log('No courses found after page click!');
    await sl(5000);
    return;
  }
  
  log('Page 2 courses: ' + p2Courses.length);
  p2Courses.forEach(function(c, i) {
    log('  ' + (i+1) + '. ' + c.courseName + ' (' + c.learnPercent + '%) id=' + c.courseId);
  });
  
  // Process each course
  for (var ci = 0; ci < p2Courses.length; ci++) {
    var c = p2Courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log('Skipping ' + c.courseName + ' (100%)'); continue; }
    
    log('\n=== (' + (ci+1) + '/' + p2Courses.length + ') ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
    await p.evaluate(function(o) {
      var app = document.querySelector('#app');
      if (app && app.__vue__) app.__vue__.$router.push({path:'/v_courseDetails', query:{trainplanId:o.pl, platformId:'154', courseId:o.cd}});
    }, {pl: PLAN, cd: c.courseId});
    await sl(5000);
    
    var chapters = await p.evaluate(function() {
      var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      var l = [];
      for(var i=0;i<b.length;i++) if(b[i].textContent.indexOf('\u5df2\u5b66\u5b8c')===-1) l.push(i);
      return l;
    });
    log('Chaps: ' + chapters.length);
    if (chapters.length === 0) { log('All done'); continue; }
    
    for(var ci2=0;ci2<chapters.length;ci2++){
      var chapName = '';
      try { chapName = await p.locator('a.titlecolor.text').nth(chapters[ci2]).textContent(); } catch(e) {}
      
      var pp = new Promise(function(r){p.once('popup',function(popup){r(popup);});});
      await p.evaluate(function(idx) {
        var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
        if (b[idx]) b[idx].click();
      }, chapters[ci2]);
      await sl(2000);
      
      var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
      if(!popup){log('No popup');continue;}
      try{await popup.waitForLoadState('load',{timeout:15000});}catch(e){}
      
      var pf=null;
      for(var w=0;w<20;w++){
        var frames=popup.frames();
        for(var f of frames){try{if(f.url().includes('content.hst360.com')){pf=f;break;}}catch(e){}}
        if(pf)break;
        await sl(1000);
      }
      if(pf) await completeChap(popup, pf, chapName);
      else log('NO PF');
      
      try{popup.close();}catch(e){}
      await sl(2000);
    }
    
    // Back to course list and navigate to page 2 again
    await p.evaluate(function(pid) {
      var app = document.querySelector('#app');
      if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course', query:{trainplanId:pid, platformId:'154'}});
    }, PLAN);
    await sl(3000);
    
    // Re-click page 2
    await p.evaluate(function() {
      var pages = document.querySelectorAll('.el-pagination li.number');
      for (var i=0; i<pages.length; i++) {
        if (pages[i].textContent.trim() === '2') { pages[i].click(); return; }
      }
    });
    await sl(2000);
  }
  
  log('\n=== ALL DONE - PAGE2 COMPLETE');
  await sl(10000);
})();
