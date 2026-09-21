import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
SDIR="/opt/gsa-tv/cache/media/1/identity/sfx"
mkdir -p "$SDIR"

echo "Baixando sonoplastia e stingers de TV profissional..."
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/active_storage/sfx/2900/2900-preview.mp3" -o "$SDIR/logo_ident_hit.mp3"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/active_storage/sfx/2984/2984-preview.mp3" -o "$SDIR/cinematic_reveal.mp3"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/active_storage/sfx/2751/2751-preview.mp3" -o "$SDIR/electronic_logo.mp3"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/active_storage/sfx/1492/1492-preview.mp3" -o "$SDIR/whoosh_air.mp3"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/active_storage/sfx/2897/2897-preview.mp3" -o "$SDIR/broadcast_sting.mp3"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/music/738/738.mp3" -o "$SDIR/modern_beat.mp3"

ls -lh "$SDIR"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
