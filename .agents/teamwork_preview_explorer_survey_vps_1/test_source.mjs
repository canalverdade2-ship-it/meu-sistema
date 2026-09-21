import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function testAudioSource() {
  const script = `
echo '=== TESTING MIXKIT SFX DOWNLOAD ==='
curl -sIL -A "Mozilla/5.0" "https://assets.mixkit.co/active_storage/sfx/2897/2897-preview.mp3" | head -n 5
curl -sIL -A "Mozilla/5.0" "https://assets.mixkit.co/music/738/738.mp3" | head -n 5
`;
  const res = await runSshScript(script, 15000);
  console.log(res.stdout);
}

testAudioSource().catch(console.error);
