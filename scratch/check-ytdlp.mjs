import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
which yt-dlp || echo "No yt-dlp"
python3 --version || echo "No python3"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
