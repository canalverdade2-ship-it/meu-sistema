import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastGet(
      '/tmp/test_salmao_tag_frame.jpg',
      'C:/Users/Adriano Farias/.gemini/antigravity/brain/3c05473f-6f8c-4544-b39a-7f5f15c39664/tag_salmao_verified.jpg',
      err => {
        if (err) console.error('Error downloading tag frame:', err);
        else console.log('Successfully saved tag_salmao_verified.jpg locally!');
        conn.end();
      }
    );
  });
});
conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey() });
