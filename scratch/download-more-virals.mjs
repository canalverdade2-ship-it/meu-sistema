import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
VDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/4681/4681-720.mp4" -o "$VDIR/funny_pet1.mp4" || true
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/4669/4669-720.mp4" -o "$VDIR/funny_pet2.mp4" || true
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/1166/1166-720.mp4" -o "$VDIR/funny_people.mp4" || true

ls -lh "$VDIR"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
