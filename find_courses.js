const PW = 'C:/Users/Administrator/.openclaw/workspace/skills/web-anti-crawl-fetch/scripts/node_modules/playwright/index.js';
const { chromium } = require(PW);
const fs = require('fs');
const U = '622726198311030246', P = 'abc123';
const CF = 'C:/Users/Administrator/.openclaw/workspace/captcha_input.txt';

(async function() {
  try { require('child_process').execSync('taskkill /f /im chrome.exe 2>nul', {stdio:'ignore'}); } catch(e) {}
  
  var ctx = await chromium.launchPersistentContext('C:/Users/Administrator/.openclaw/workspace/pw-profile', {headless:false, viewport:{width:1280,height:800}});
  var p = ctx.pages()[0] || await ctx.newPage();
  
  await p.goto('http://gszj.hsthnet.com/', {waitUntil:'load', timeout:60000}); await new Promise(r => setTimeout(r, 3000));
  var lf=null;
  for(var i=0;i<20;i++){lf=p.frames().find(f=>{try{return f.url().includes('gp.hst360.com')&&f.url().includes('commonLogin');}catch(e){return false;}});if(lf)break;await new Promise(r=>setTimeout(r,1000));}
  if(lf){
    await lf.waitForSelector('input',{timeout:15000});
    var ins=await lf.locator('input').all(); await ins[0].fill('622726198311030246'); await ins[1].fill('abc123');
    await p.screenshot({path:'C:/Users/Administrator/.openclaw/workspace/captcha_p2.png'}); console.log('W');
    fs.writeFileSync(CF,''); var code='';
    while(!code){await new Promise(r=>setTimeout(r,1000));code=fs.readFileSync(CF,'utf8').trim();}
    console.log('C: '+code); await lf.locator('input').nth(2).type(code,{delay:20});
    await lf.locator('button').filter({hasText:'\u767b\u5f55'}).click();
    for(var w=0;w<30;w++){var u=p.url();if(u.includes('v_trainplan'))break;await new Promise(r=>setTimeout(r,1000));}
  }
  
  // Go to course list for the plan
  await p.evaluate(function() {
    var app = document.querySelector('#app');
    if (app && app.__vue__) {
      app.__vue__.$router.push({path:'/v_selected_course', query:{trainplanId:'af7e9b8dce964ebdab00c0647155de76', platformId:'154'}});
    }
  });
  await new Promise(r => setTimeout(r, 5000));
  
  // Find all elements with __vue__ and search for course data
  var result = await p.evaluate(function() {
    var res = { hits: [] };
    
    // Search all elements that have __vue__ property
    var all = document.querySelectorAll('*');
    var vuCount = 0;
    
    for (var el of all) {
      var keys = Object.getOwnPropertyNames(el).filter(function(k) { return k.startsWith('__vue'); });
      if (keys.length === 0) continue;
      vuCount++;
      
      for (var vk of keys) {
        try {
          var vm = el[vk];
          if (!vm || typeof vm !== 'object') continue;
          
          // Check if vm has a courseList or similar
          var data = vm._data || vm;
          // Vue 2 component instance - check all keys
          var ownKeys = Object.keys(vm);
          for (var k of ownKeys) {
            try {
              var val = vm[k];
              if (Array.isArray(val) && val.length > 5 && val[0] && typeof val[0] === 'object' && val[0].courseId) {
                res.hits.push({
                  tag: el.tagName,
                  class: (el.className || '').substring(0,60),
                  vueKey: vk,
                  dataKey: k,
                  count: val.length,
                  sample: val[0].courseName
                });
              }
              // Also check nested objects
              if (val && typeof val === 'object' && !Array.isArray(val) && val.courseStudyList) {
                res.hits.push({
                  tag: el.tagName,
                  class: (el.className || '').substring(0,60),
                  vueKey: vk,
                  dataKey: k + '.courseStudyList',
                  count: val.courseStudyList.length,
                  sample: val.courseStudyList[0] ? val.courseStudyList[0].courseName : '?'
                });
              }
            } catch(e) {}
          }
        } catch(e) {}
      }
      
      // Limit search to 500 elements
      if (vuCount > 500) break;
    }
    
    res.totalVueElements = vuCount;
    return res;
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  if (result.hits.length > 0) {
    // Extract all courseIds
    var hit = result.hits[0];
    var allCourses = await p.evaluate(function(info) {
      var all = document.querySelectorAll('*');
      for (var el of all) {
        var keys = Object.getOwnPropertyNames(el).filter(function(k) { return k.startsWith('__vue'); });
        if (keys.length === 0) continue;
        for (var vk of keys) {
          try {
            var vm = el[vk];
            if (!vm) continue;
            var val = vm[info.dataKey];
            if (Array.isArray(val) && val.length > 5) {
              return val.map(function(c) { return { courseId: c.courseId, courseName: c.courseName, learnPercent: c.learnPercent }; });
            }
            // Try nested
            var parts = info.dataKey.split('.');
            if (parts.length === 2 && vm[parts[0]] && vm[parts[0]][parts[1]]) {
              return vm[parts[0]][parts[1]].map(function(c) { return { courseId: c.courseId, courseName: c.courseName, learnPercent: c.learnPercent }; });
            }
          } catch(e) {}
        }
      }
      return null;
    }, hit);
    
    if (allCourses && allCourses.length > 0) {
      console.log('\n=== ALL COURSES (' + allCourses.length + ') ===');
      allCourses.forEach(function(c, i) {
        console.log((i+1) + '. ' + c.courseName + ' (' + c.learnPercent + '%) id=' + c.courseId);
      });
      fs.writeFileSync('C:/Users/Administrator/.openclaw/workspace/all_courses.json', JSON.stringify(allCourses, null, 2));
      console.log('\nSaved to all_courses.json');
    }
  }
  
  console.log('\nBrowser stays open for inspection');
})();
