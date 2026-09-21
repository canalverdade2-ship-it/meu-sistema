import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
MDIR="/opt/gsa-tv/cache/media/1/identity/motion_bg"
mkdir -p "$MDIR"

echo "Baixando videos neon / motion..."
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/34317/34317-720.mp4" -o "$MDIR/neon_tunnel.mp4"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/18151/18151-720.mp4" -o "$MDIR/digital_wave.mp4"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/31497/31497-720.mp4" -o "$MDIR/abstract_gold.mp4"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/46635/46635-720.mp4" -o "$MDIR/cyber_network.mp4"

ls -lh "$MDIR"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
