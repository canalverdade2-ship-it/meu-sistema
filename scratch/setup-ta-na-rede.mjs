import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
mkdir -p /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/{audio,video,graphics,broll}
echo "Created directories."

# Check existing video files
find /opt/gsa-tv/cache/media/1/ -name "*tecnologia*" -o -name "*ia*" -o -name "*smart*" -o -name "*motion*" | head -n 20
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
