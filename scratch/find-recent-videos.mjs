import fs from 'fs';
import path from 'path';

async function main() {
  const downloadsDir = 'C:\\Users\\Adriano Farias\\Downloads';
  try {
    const files = fs.readdirSync(downloadsDir);
    const videoFiles = files.filter(f => /\.(mp4|mov|avi|mkv|webm)$/i.test(f)).map(f => {
      const fullPath = path.join(downloadsDir, f);
      const stat = fs.statSync(fullPath);
      return { file: f, path: fullPath, size: stat.size, mtime: stat.mtime };
    });
    videoFiles.sort((a, b) => b.mtime - a.mtime);
    console.log('Arquivos de vídeo recentes em Downloads:', JSON.stringify(videoFiles.slice(0, 10), null, 2));
  } catch (e) {
    console.error('Erro ao ler Downloads:', e.message);
  }
}

main().catch(console.error);
