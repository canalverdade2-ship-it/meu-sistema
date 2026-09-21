import { execSync } from 'child_process';
import path from 'path';

async function main() {
  const filePath = 'C:\\Users\\Adriano Farias\\Downloads\\Vinheta Oficial GSA TV.mp4';
  try {
    const probe = execSync(`ffprobe -v error -show_format -show_streams -print_format json "${filePath}"`).toString();
    console.log('FFPROBE OUTPUT:', probe);
  } catch (e) {
    console.log('ffprobe local error or not found:', e.message);
  }
}

main().catch(console.error);
