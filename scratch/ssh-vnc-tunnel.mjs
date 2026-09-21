import net from 'node:net';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const ssh = new Client();
ssh.on('ready', () => {
  const server = net.createServer((socket) => {
    ssh.forwardOut(socket.remoteAddress ?? '127.0.0.1', socket.remotePort ?? 0,
      '127.0.0.1', 6088, (error, stream) => {
        if (error) return socket.destroy(error);
        socket.pipe(stream).pipe(socket);
      });
  });
  server.listen(6088, '127.0.0.1', () => process.stdout.write('VNC_TUNNEL_READY\n'));
});
ssh.on('error', (error) => {
  process.stderr.write(`VNC_TUNNEL_ERROR ${error.message}\n`);
  process.exitCode = 1;
});
ssh.connect({
  host: '147.15.43.141', port: 22, username: 'opc',
  privateKey: readInfraKey(), readyTimeout: 15000,
  keepaliveInterval: 15000, keepaliveCountMax: 3,
});
