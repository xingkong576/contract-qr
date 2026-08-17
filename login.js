var vm = document.querySelector('#app').__vue__;
var children = vm.$children;
var result = [];
for (var i = 0; i < children.length; i++) {
  var c = children[i];
  var methods = [];
  for (var key in c) {
    if (typeof c[key] === 'function' && key.indexOf('login') !== -1) methods.push(key);
    if (typeof c[key] === 'function' && key.indexOf('Login') !== -1) methods.push(key);
    if (typeof c[key] === 'function' && key.indexOf('submit') !== -1) methods.push(key);
    if (typeof c[key] === 'function' && key.indexOf('Submit') !== -1) methods.push(key);
  }
  if (methods.length > 0) result.push(c.$options.name + ': ' + methods.join(', '));
  // also check deeper children
  var gc = c.$children;
  if (gc) {
    for (var j = 0; j < gc.length; j++) {
      var g = gc[j];
      for (var key in g) {
        if (typeof g[key] === 'function' && key.indexOf('login') !== -1) result.push('grandchild: ' + g.$options.name + ' method: ' + key);
        if (typeof g[key] === 'function' && key.indexOf('Login') !== -1) result.push('grandchild: ' + g.$options.name + ' method: ' + key);
      }
    }
  }
}
JSON.stringify(result);
