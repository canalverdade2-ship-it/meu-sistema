import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version
`;
  console.log('Installing yt-dlp on VPS...');
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
