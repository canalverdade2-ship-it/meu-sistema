import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function testFfprobe() {
  const script = `
echo '=== DOCKER FFPROBE ON EXISTING SFX ==='
docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.7.2 ffprobe -v error -show_entries format=filename,format_name,duration,size -of json /media/1/identity/sfx/whoosh_air.mp3

echo '=== FILE COMMAND ON EXISTING SFX ==='
file /opt/gsa-tv/cache/media/1/identity/sfx/whoosh_air.mp3

echo '=== DNF REPOS CHECK FOR FFMPEG ==='
dnf info ffmpeg 2>&1 | head -n 10 || echo "ffmpeg not in default dnf repos"
`;
  const res = await runSshScript(script, 20000);
  console.log(res.stdout);
}

testFfprobe().catch(console.error);
