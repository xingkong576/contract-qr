var vm = document.querySelector('[data-v-f3fc9f20]').__vue__;
vm.randomNum = Date.now();
// Wait then get the new captcha URL
setTimeout(function() {
  var captchaImg = document.querySelector('img[alt*="验证码"]');
  document.title = captchaImg ? captchaImg.src : 'no captcha';
}, 500);
