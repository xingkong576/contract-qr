const WebSocket = require('ws');
const http = require('http');

// Get browser WebSocket URL
http.get('http://127.0.0.1:9222/json/version', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const browser = JSON.parse(data);
    console.log('Browser WS URL:', browser.webSocketDebuggerUrl);
    
    // Connect to browser
    const ws = new WebSocket(browser.webSocketDebuggerUrl);
    
    ws.on('open', () => {
      console.log('✅ Connected to Edge via CDP!\n');
      
      // List targets (tabs)
      const listTargets = {
        id: 1,
        method: 'Target.getTargets',
        params: {}
      };
      ws.send(JSON.stringify(listTargets));
    });
    
    ws.on('message', (message) => {
      const msg = JSON.parse(message);
      console.log('Received:', JSON.stringify(msg, null, 2));
      
      if (msg.id === 1 && msg.result) {
        const targets = msg.result.targetInfos;
        console.log('\n📑 Found', targets.length, 'tabs:');
        targets.forEach((t, i) => {
          console.log(`  ${i+1}. ${t.title} - ${t.url}`);
        });
        
        // Find any target we can attach to (prefer 'page', fallback to 'other')
        let pageTarget = targets.find(t => t.type === 'page') || targets.find(t => t.type === 'other');
        if (pageTarget) {
          console.log('\n🎯 Attaching to target:', pageTarget.targetId, '(' + pageTarget.type + ')');
          
          // Attach to target
          const attach = {
            id: 2,
            method: 'Target.attachToTarget',
            params: { targetId: pageTarget.targetId, flatten: true }
          };
          ws.send(JSON.stringify(attach));
        }
      }
      
      if (msg.id === 2 && msg.result) {
        const sessionId = msg.result.sessionId || msg.result.targetId;
        console.log('\n✅ Attached! Session:', sessionId);
        
        // Navigate to Doubao
        const navigate = {
          id: 3,
          method: 'Page.navigate',
          params: { url: 'https://www.doubao.com' },
          sessionId: sessionId
        };
        ws.send(JSON.stringify(navigate));
      }
      
      if (msg.id === 3 && msg.result) {
        console.log('\n✅ Navigated! FrameId:', msg.result.frameId);
        console.log('🎉 Success! Edge should now be opening Doubao...');
        
        // Wait a bit then close
        setTimeout(() => {
          ws.close();
          console.log('\nDone.');
          process.exit(0);
        }, 2000);
      }
    });
    
    ws.on('error', (err) => {
      console.log('❌ Error:', err.message);
    });
    
    ws.on('close', () => {
      console.log('Connection closed');
    });
  });
}).on('error', e => console.error(e));
