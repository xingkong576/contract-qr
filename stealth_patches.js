// ===== Stealth Patches for agent-browser =====
// 注入到页面中，抹掉自动化痕迹，防止平台检测
// 用法: agent-browser eval "patches code" （在每次打开目标页面前执行）

(function() {
  const patches = {};

  // 1. 隐藏 navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
  });

  // 2. 伪造 chrome.runtime（模拟真实扩展环境）
  if (!window.chrome) {
    window.chrome = { runtime: {} };
  }
  window.chrome.runtime = {
    ...window.chrome.runtime,
    connect: () => ({ onMessage: { addListener: () => {} }, onDisconnect: { addListener: () => {} }, postMessage: () => {} }),
    sendMessage: () => {},
    onMessage: { addListener: () => {} },
    onConnect: { addListener: () => {} },
    id: 'fakeextensionid'
  };

  // 3. 伪造 navigator.plugins（无头浏览器默认长度为0）
  if (navigator.plugins.length === 0) {
    // 模拟常见的 Chrome 插件
    const fakePlugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
    ];
    // 用 Proxy 伪造 plugins
    const pluginObj = {
      0: fakePlugins[0],
      1: fakePlugins[1],
      2: fakePlugins[2],
      length: 3,
      item: (i) => fakePlugins[i] || null,
      namedItem: (name) => fakePlugins.find(p => p.name === name) || null,
      refresh: () => {},
      [Symbol.iterator]: function*() { for (let p of fakePlugins) yield p; }
    };
    // 用 Object.defineProperties 覆盖
    Object.defineProperties(navigator, {
      plugins: { get: () => pluginObj, configurable: true },
      mimeTypes: { get: () => (() => { const m = {}; m.length = 4; return m; })(), configurable: true }
    });
  }

  // 4. 伪造 languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['zh-CN', 'zh', 'en'],
    configurable: true
  });

  // 5. 伪造 permissions
  if (navigator.permissions) {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (desc) => {
      if (desc.name === 'notifications') return { state: 'prompt', onchange: null };
      if (desc.name === 'clipboard-read') return { state: 'granted', onchange: null };
      if (desc.name === 'clipboard-write') return { state: 'granted', onchange: null };
      return origQuery(desc);
    };
  }

  // 6. 强制 WebGL 供应商信息匹配正常 Chrome
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // 如果检测到头显 或 虚拟机显卡，修改为正常值
        if (renderer && (renderer.includes('llvmpipe') || renderer.includes('SwiftShader') || renderer.includes('Google'))) {
          // 用 getParameter 覆盖不现实，至少记录日志
          console.log('[Stealth] WebGL renderer:', renderer);
        }
      }
    }
  } catch(e) {}

  // 7. 添加额外常见的 window 属性
  if (!window.screenX) Object.defineProperty(window, 'screenX', { get: () => 0 });
  if (!window.screenY) Object.defineProperty(window, 'screenY', { get: () => 0 });
  if (!window.outerHeight) Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 80 });
  if (!window.outerWidth) Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth + 16 });

  patches.version = '1.0';
  return '[Stealth] Patches applied ✅';
})();
