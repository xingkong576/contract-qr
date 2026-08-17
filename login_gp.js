// Set username and password on Vue instance
var vm = document.querySelector('[data-v-f3fc9f20]').__vue__;
vm.username = '622726198311030246';
vm.password = 'abc123';

// Set captcha using native input value setter + dispatchEvent for Vue reactivity
var captchaInput = document.querySelectorAll('input')[2];
var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
nativeSetter.call(captchaInput, 'nagy8');
var evt = new Event('input', { bubbles: true });
captchaInput.dispatchEvent(evt);

// Trigger login via Vue method
vm.doLogin();
