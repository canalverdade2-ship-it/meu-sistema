import { execSync } from 'child_process';
import path from 'path';

async function main() {
  const filePath = 'C:\\Users\\Adriano Farias\\Downloads\\Vinheta Oficial GSA TV.mp4';
  const out1 = 'public/cast/vinheta_user_f1.jpg';
  const out2 = 'public/cast/vinheta_user_f2.jpg';
  const out3 = 'public/cast/vinheta_user_f3.jpg';

  execSync(`ffmpeg -y -ss 00:00:03 -i "${filePath}" -vframes 1 "${out1}"`);
  execSync(`ffmpeg -y -ss 00:00:15 -i "${filePath}" -vframes 1 "${out2}"`);
  execSync(`ffmpeg -y -ss 00:00:28 -i "${filePath}" -vframes 1 "${out3}"`);
  console.log('Extracted frames successfully!');
}

main().catch(console.error);
