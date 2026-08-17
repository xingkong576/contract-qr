const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';
const LF = 'C:/Users/Administrator/.openclaw/workspace/done_log.txt';
const sl = ms => new Promise(r => setTimeout(r, ms));
const log = m => { const t = new Date().toLocaleTimeString(); console.log(t + ' ' + m); fs.appendFileSync(LF, t + ' ' + m + '\n'); };
const PLAN = 'af7e9b8dce964ebdab00c0647155de76';

async function watchChapter(popup, pf, chapName) {
  log('>> ' + chapName);
  
  // Start playing
  await pf.evaluate(function() {
    try { var v = document.querySelector('video'); if (v && v.paused) v.play(); } catch(e) {}
    try { var p = document.querySelector('.dplayer-play-icon'); if (p) p.click(); } catch(e) {}
  });
  
  // Watch for API calls
  var saveCount = 0;
  popup.route('**/takeRecordByToken**', function(route) { saveCount++; route.continue(); });
  
  // Play for 50 seconds to establish session
  log('Playing 50s...');
  await sl(50000);
  
  // Get duration and seek to 60s before end (gradual jump, less likely to trigger -2)
  var dur = await pf.evaluate(function() {
    try {
      var v = document.querySelector('video');
      if (v && v.duration > 120) {
        var target = v.duration - 60;
        v.currentTime = target;
        return Math.floor(v.duration);
      } else if (v && v.duration > 0) {
        v.currentTime = v.duration - 1;
        return Math.floor(v.duration);
      }
    } catch(e) {}
    return 0;
  });
  log('Seek to d-60, dur=' + dur + 's');
  
  // Wait for video to play to natural end
  for (var w = 0; w < 90; w++) {
    var ended = await pf.evaluate(function() { try { var v = document.querySelector('video'); return v ? v.ended : false; } catch(e){return false;} });
    if (ended) { log('Ended!'); break; }
    await sl(1000);
  }
  
  await sl(10000);
  log('Saves: ' + saveCount);
  return saveCount > 0;
}

async function navigateToCourse(p, planId, courseId) {
  await p.evaluate(function(o) {
    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      app.__vue__.$router.push({path:'/v_courseDetails', query:{trainplanId:o.pl, platformId:'154', courseId:o.cd}});
    }
  }, {pl: planId, cd: courseId});
  await sl(8000);
  
  // Check if page is still valid
  var valid = await p.evaluate(function() {
    var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    return b.length > 0;
  });
  if (!valid) {
    log('Page invalid, re-navigating...');
    await p.goto('https://gp.hst360.com/index.html#/v_courseDetails?trainplanId=' + planId + '&platformId=154&courseId=' + courseId, {waitUntil:'load',timeout:30000});
    await sl(5000);
  }
}

async function getChapters(p) {
  return await p.evaluate(function() {
    var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
    var t = document.querySelectorAll('a.titlecolor.text');
    var l = [];
    for (var i = 0; i < b.length; i++) {
      if (b[i].textContent.indexOf('\u5df2\u5b66\u5b8c') === -1) {
        l.push({idx:i, name:(t[i]?t[i].textContent.trim():'?').substring(0,30)});
      }
    }
    return l;
  });
}

async function processCourse(p, c) {
  log('\n=== ' + c.courseName + ' (' + c.learnPercent + '%) ===');
  await navigateToCourse(p, PLAN, c.courseId);
  
  var chapters = await getChapters(p);
  log('Chaps: ' + chapters.length);
  if (chapters.length === 0) return;
  
  for (var ci = 0; ci < chapters.length; ci++) {
    // Register popup handler
    var pp = new Promise(function(r) { p.once('popup', function(popup) { r(popup); }); });
    
    // Click chapter button
    await p.evaluate(function(idx) {
      var b = document.querySelectorAll('a.button.fr.mt10.border-public.tc.f12.titlecolor');
      if (b[idx]) b[idx].click();
      else return 'no_button';
    }, chapters[ci].idx);
    
    var popup = await Promise.race([pp, sl(30000).then(function(){return null;})]);
    if (!popup) {
      log('No popup for [' + chapters[ci].idx + '], re-navigating...');
      await navigateToCourse(p, PLAN, c.courseId);
      continue;
    }
    
    try { await popup.waitForLoadState('load', {timeout:15000}); } catch(e) {}
    
    // Find content iframe
    var pf = null;
    for (var w = 0; w < 20; w++) {
      var frames = popup.frames();
      for (var f of frames) { try { if (f.url().includes('content.hst360.com')) { pf = f; break; } } catch(e) {} }
      if (pf) break;
      await sl(1000);
    }
    
    if (pf) {
      await watchChapter(popup, pf, chapters[ci].name);
    } else {
      log('NO PF - error page shown, closing...');
    }
    
    try { popup.close(); } catch(e) {}
    await sl(2000);
    
    // Re-check page validity
    var ok = await p.evaluate(function() {
      var app = document.querySelector('#app');
      if (!app) return false;
      try { return document.querySelectorAll('a.button').length > 0; } catch(e) { return false; }
    }).catch(function(){return false;});
    if (!ok) {
      log('Main page invalid, re-navigating...');
      await navigateToCourse(p, PLAN, c.courseId);
    }
  }
}

async function doLogin(p) {
  await p.goto('http://gszj.hsthnet.com/', {waitUntil:'load',timeout:60000}); await sl(3000);
  var lf = null;
  for (var i = 0; i < 20; i++) {
    lf = p.frames().find(function(f){try{return f.url().includes('gp.hst360.com') && f.url().includes('commonLogin');}catch(e){return false;}});
    if (lf) break; await sl(2000);
  }
  await lf.waitForSelector('input',{timeout:15000});
  var ins = await lf.locator('input').all();
  await ins[0].fill(U); await ins[1].fill(P);
  await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_done.png'});
  log('W'); fs.writeFileSync(CF,''); var code='';
  while (!code) { await sl(1000); code = fs.readFileSync(CF,'utf8').trim(); }
  log('C: '+code);
  await lf.locator('input').nth(2).type(code,{delay:20});
  await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
  var ok = false;
  for (var w = 0; w < 30; w++) { var u = p.url(); if (u.includes('v_selected_course')||u.includes('v_trainplan')) { ok=true; break; } await sl(1000); }
  if (!ok) { await p.goto('https://gp.hst360.com/index.html#/v_trainplan_list',{timeout:30000}); await sl(3000); }
  log('Logged in');
}

(async function() {
  fs.writeFileSync(LF,''); log('=== DONE v7 (robust) ===');
  var raw = fs.readFileSync('C:/Users/Administrator/.openclaw/workspace/course_data.json','utf8');
  var courses = JSON.parse(raw).data.courseStudyList || [];
  log('Courses: '+courses.length);
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  // Check login
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(3000);
  if (p.url().indexOf('nosession') >= 0 || p.url().indexOf('commonLogin') >= 0) { log('Need login'); await doLogin(p); }
  else log('Session OK');
  
  await sl(3000);
  await p.goto('https://gp.hst360.com/index.html#/v_selected_course?trainplanId='+PLAN+'&platformId=154',{waitUntil:'load',timeout:30000}); await sl(5000);
  await p.evaluate(function(){var b=Array.from(document.querySelectorAll('button')).find(function(el){return el.textContent.indexOf('\u53bb\u5b66\u4e60')>=0;});if(b)b.click();});
  await sl(8000);
  
  for (var ci = 0; ci < courses.length; ci++) {
    var c = courses[ci];
    if (parseInt(c.learnPercent) >= 100) { log(c.courseName + ': DONE'); continue; }
    
    await processCourse(p, c);
    
    // Navigate back to list
    await p.evaluate(function(){var app=document.querySelector('#app');if(app&&app.__vue__)app.__vue__.$router.push({path:'/v_selected_course',query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76',platformId:'154'}});}).catch(function(){});
    await sl(5000);
  }
  
  log('\n=== ALL DONE!');
  await sl(3000);
})();
