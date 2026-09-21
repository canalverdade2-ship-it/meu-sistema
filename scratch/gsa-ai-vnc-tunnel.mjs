import net from 'node:net';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const conn = new Client();
const server = net.createServer((socket) => {
  conn.forwardOut('127.0.0.1', 0, '127.0.0.1', 6088, (err, stream) => {
    if (err) { socket.destroy(err); return; }
    socket.pipe(stream).pipe(socket);
    stream.on('error', () => socket.destroy());
    socket.on('error', () => stream.destroy());
  });
});

conn.on('ready', () => {
  server.listen(16088, '127.0.0.1', () => {
    console.log('GSA_AI_TUNNEL_READY http://127.0.0.1:16088/vnc.html?autoconnect=true');
  });
});
conn.on('error', (e) => { console.error('SSH_TUNNEL_ERROR', e.message); process.exit(1); });
conn.connect({ host:'147.15.43.141', port:22, username:'opc', privateKey:readInfraKey(), readyTimeout:15000 });

process.on('SIGINT', () => { server.close(); conn.end(); process.exit(0); });
