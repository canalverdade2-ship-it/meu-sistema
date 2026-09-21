import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const buffer = fs.readFileSync('scratch/qc-v2/presenters/gsa-sabor.png');
console.log('Buffer length:', buffer.length);

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/home/opc/gsa-sabor.png');
    writeStream.on('close', () => {
      console.log('File successfully uploaded via SFTP!');
      conn.end();
    });
    writeStream.end(buffer);
  });
});
conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey() });
