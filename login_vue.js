var vm = document.querySelector('[data-v-f3fc9f20]').__vue__;
vm.username = '622726198311030246';
vm.password = 'abc123';

// For the captcha, we need to trigger an input event on the native input
var captchaInput = document.querySelectorAll('input')[2];
var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
nativeInputValueSetter.call(captchaInput, 'gma36');

var inputEvent = new Event('input', { bubbles: true });
captchaInput.dispatchEvent(inputEvent);

// Now call doLogin
vm.doLogin();
