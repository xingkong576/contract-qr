function findLoginMethod(vm, depth) {
  if (!vm || depth > 10) return null;
  var methods = [];
  for (var key in vm) {
    if (typeof vm[key] === 'function' && (key.indexOf('login') !== -1 || key.indexOf('Login') !== -1 || key.indexOf('submit') !== -1 || key.indexOf('Submit') !== -1)) {
      methods.push(key);
    }
  }
  if (methods.length > 0) return methods;
  
  // Access children safely - Vue 2 uses $children
  var childArr = vm.$children;
  if (childArr) {
    for (var i = 0; i < childArr.length; i++) {
      var result = findLoginMethod(childArr[i], depth + 1);
      if (result) return result;
    }
  }
  return null;
}

var vm = document.querySelector('[data-v-f3fc9f20]').__vue__;
var result = findLoginMethod(vm, 0);
JSON.stringify(result || 'no login method found');
