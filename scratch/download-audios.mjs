import { runSshScript } from './ssh2-run.mjs';
import fs from 'fs/promises';

async function main() {
  const script1 = `cat /opt/gsa-tv/cache/media/1/identity/vinhetas/media-vinheta-gsa-manha-news.wav | base64 -w 0`;
  const res1 = await runSshScript(script1);
  await fs.writeFile('public/cast/manha_voice.wav', Buffer.from(res1.stdout.trim(), 'base64'));

  const script2 = `cat /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta_master_audio.wav | base64 -w 0`;
  const res2 = await runSshScript(script2);
  await fs.writeFile('public/cast/impact_sfx.wav', Buffer.from(res2.stdout.trim(), 'base64'));

  console.log('Arquivos de audio baixados localmente com sucesso!');
}

main().catch(console.error);
