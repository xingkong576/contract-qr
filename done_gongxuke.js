const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_gongxu_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t+' '+m); fs.appendFileSync(LF, t+' '+m+'\n'); };
// 公需课30学时考核 planId (from earlier navigation)
const PLAN = 'b24b784434ff40429bfe60dfb590f1f4';

async function doLogin(p) {
  await p.goto('http://gszj.hsthnet.com/', {waitUntil:'load', timeout:60000}); await sl(3000);
  var lf=null;
  for(var i=0;i<20;i++){lf=p.frames().find(f=>{try{return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');}catch(e){return false;}});if(lf)break;await sl(2000);}
  await lf.waitForSelector('input',{timeout:15000});
  var ins=await lf.locator('input').all(); await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_gongxu.png'}); log('W');
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
  fs.writeFileSync(LF,''); log('=== 公需课30学时 ===');
  try { require('child_process').execSync('taskkill /f /im chrome.exe 2>nul', {stdio:'ignore'}); } catch(e) {}
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  await doLogin(p);
  
  // Go to training plan list and click 去学习 for the 公需课 plan
  await p.evaluate(function(pid) {
    var app = document.querySelector('#app');
    if (app && app.__vue__) app.__vue__.$router.push({path:'/v_trainplan_list'});
  });
  await sl(3000);
  
  // Find and click 去学习 for the 公需课 plan
  log('Looking for 公需课 plan...');
  var planInfo = await p.evaluate(function() {
    // Check URL hash for plan info
    var hash = window.location.hash;
    return { hash: hash };
  });
  log('URL: ' + planInfo.hash);
  
  // Try clicking 去学习 button
  await p.evaluate(function() {
    var btns = document.querySelectorAll('button');
    for (var b of btns) {
      if (b.textContent.indexOf('\u53bb\u5b66\u4e60') >= 0) {
        b.click();
        return true;
      }
    }
    return false;
  });
  await sl(5000);
  
  var hash = await p.evaluate(function() { return window.location.hash; });
  log('After click hash: ' + hash);
  
  // If it went to the wrong plan (专业课 instead of 公需课), find the 公需课 plan
  if (hash.indexOf('af7e9b8dce') >= 0) {
    log('Went to 专业课 plan, need to find 公需课 in plan list');
    await p.evaluate(function(pid) {
      var app = document.querySelector('#app');
      if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course', query:{trainplanId:pid, platformId:'154'}});
    }, PLAN);
    await sl(5000);
    hash = await p.evaluate(function() { return window.location.hash; });
    log('After forced nav: ' + hash);
  }
  
  // Extract courses from Vue listData (all courses in this plan)
  var courses = await p.evaluate(function() {
    var all = document.querySelectorAll('section');
    for (var el of all) {
      try {
        var vm = el.__vue__;
        if (vm && vm.listData) {
          return vm.listData.map(function(c) { 
            return { courseId: c.courseId, courseName: c.courseName, learnPercent: c.learnPercent }; 
          });
        }
      } catch(e) {}
    }
    return null;
  });
  
  if (!courses || courses.length === 0) {
    log('No courses found!');
    await sl(5000);
    return;
  }
  
  log('公需课 courses: ' + courses.length);
  courses.forEach(function(c, i) {
    log('  ' + (i+1) + '. ' + c.courseName + ' (' + c.learnPercent + '%) id=' + c.courseId);
  });
  
  // Process each course
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log('Skipping ' + c.courseName + ' (100%)'); continue; }
    
    log('\n=== (' + (ci+1) + '/' + courses.length + ') ' + c.courseName + ' (' + c.learnPercent + '%) ===');
    
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
    
    // Back to plan list for next course
    await p.evaluate(function(pid) {
      var app = document.querySelector('#app');
      if (app && app.__vue__) app.__vue__.$router.push({path:'/v_selected_course', query:{trainplanId:pid, platformId:'154'}});
    }, PLAN);
    await sl(3000);
  }
  
  log('\n=== 公需课全部完成！ ===');
  await sl(10000);
})();
