const { spawn } = require('child_process');
const ssh = spawn('C:\\Program Files\\Git\\usr\\bin\\ssh.exe', [
  '-T',
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-R', '80:127.0.0.1:8765',
  'nokey@localhost.run'
], { stdio: 'pipe' });

const URL_RE = /https:\/\/[\w-]+\.lhr\.life/;
let tunnelUrl = null;

ssh.stdout.on('data', (d) => {
  const t = d.toString();
  const m = t.match(URL_RE);
  if (m && !tunnelUrl) { tunnelUrl = m[0]; console.log('URL:', tunnelUrl); }
});
ssh.stderr.on('data', (d) => {
  const t = d.toString();
  const m = t.match(URL_RE);
  if (m && !tunnelUrl) { tunnelUrl = m[0]; console.log('URL(err):', tunnelUrl); }
});
ssh.on('close', (c) => {
  if (tunnelUrl) console.log('Tunnel stable');
  else console.log('Closed:', c);
});
ssh.on('error', (e) => console.error('SSH err:', e.message));

setTimeout(() => {
  if (!tunnelUrl) { ssh.kill('SIGKILL'); console.log('Timeout'); process.exit(1); }
  else console.log('OK');
}, 12000);
