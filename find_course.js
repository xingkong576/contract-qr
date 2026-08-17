// Find course data in the page
var html = document.body.innerHTML;

// Look for patterns
var patterns = [
  /courseId["':=]([^"'&?,\s]+)/gi,
  /courseid["':=]([^"'&?,\s]+)/gi,
  /classId["':=]([^"'&?,\s]+)/gi,
  /id["':=]([a-f0-9]{32})/gi
];

patterns.forEach(function(p) {
  var match;
  while ((match = p.exec(html)) !== null) {
    console.log('MATCH:', match[0]);
  }
});

// Look for Vue component data
var app = document.querySelector('#app').__vue__;
if (app && app._routerRoot && app._routerRoot._route) {
  console.log('Current route:', JSON.stringify(app._routerRoot._route));
}

// Look at all data attributes on course-related elements
var divs = document.querySelectorAll('div.pr, div[class*=course], li[class*=course]');
console.log('Course divs found:', divs.length);
for (var i = 0; i < Math.min(divs.length, 3); i++) {
  var attrs = [];
  for (var j = 0; j < divs[i].attributes.length; j++) {
    attrs.push(divs[i].attributes[j].name + '=' + divs[i].attributes[j].value);
  }
  console.log('Div', i, attrs.join(', '));
}
