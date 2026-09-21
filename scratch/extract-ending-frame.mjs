import { execSync } from 'child_process';

async function main() {
  const filePath = 'C:\\Users\\Adriano Farias\\Downloads\\Vinheta Oficial GSA TV.mp4';
  const out4 = 'public/cast/vinheta_user_f4.jpg';
  execSync(`ffmpeg -y -ss 00:00:33 -i "${filePath}" -vframes 1 "${out4}"`);
  console.log('Extracted frame at 33s!');
}

main().catch(console.error);
