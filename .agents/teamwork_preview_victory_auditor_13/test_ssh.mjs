import fs from 'node:fs';
import { Client } from 'ssh2';

const VPS_HOST = '147.15.43.141';
const VPS_USER = 'opc';
const VPS_KEY_PATH = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';

const privateKey = fs.readFileSync(VPS_KEY_PATH);
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connected successfully via node ssh2.');
  conn.exec('uptime', (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({
  host: VPS_HOST,
  port: 22,
  username: VPS_USER,
  privateKey,
  readyTimeout: 20000
});