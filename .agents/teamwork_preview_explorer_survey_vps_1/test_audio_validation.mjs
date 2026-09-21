import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function testAudioValidation() {
  const script = `
echo '=== FILE COMMAND ==='
file /opt/gsa-tv/cache/media/1/identity/sfx/whoosh_air.mp3

echo '=== DOCKER FFPROBE ==='
docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.7.2 ffprobe -v error -show_entries format=filename,format_name,duration -of json /media/1/identity/sfx/whoosh_air.mp3
`;
  const res = await runSshScript(script, 45000);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

testAudioValidation().catch(console.error);
