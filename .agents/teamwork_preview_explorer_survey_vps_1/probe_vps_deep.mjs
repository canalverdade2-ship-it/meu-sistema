import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function probe2() {
  const script = `
echo '=== BIN DIRS ==='
ls -la /opt/gsa-tv/bin 2>&1 || true
find /opt -name "ffprobe" -o -name "ffmpeg" 2>/dev/null || true

echo '=== DOCKER IMAGES ==='
docker images 2>&1 | head -n 20 || true

echo '=== IDENTITY SFX ==='
ls -la /opt/gsa-tv/cache/media/1/identity/sfx 2>&1 || true

echo '=== INTERNET / EGRESS TEST ==='
curl -I -s --connect-timeout 5 https://archive.org | head -n 3 || echo "archive.org failed"
curl -I -s --connect-timeout 5 https://freemusicarchive.org | head -n 3 || echo "freemusicarchive.org failed"
curl -I -s --connect-timeout 5 https://cdn.pixabay.com | head -n 3 || echo "pixabay failed"
curl -I -s --connect-timeout 5 https://github.com | head -n 3 || echo "github failed"

echo '=== FILE COMMAND / AUDIO LIBS ==='
which file 2>&1 || true
file --version 2>&1 | head -n 1 || true
python3 -c "import urllib.request; print('urllib ok')" 2>&1 || true
python3 -c "import wave; print('wave ok')" 2>&1 || true

echo '=== DOCKER FFPROBE TEST ==='
docker run --rm gsa-tv/control-plane:1.6.12 ffprobe -version 2>&1 | head -n 2 || true

echo '=== PYTHON / PIP USER INSTALL ==='
python3 -m pip --version 2>&1 || true
`;

  const res = await runSshScript(script, 45000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);
}

probe2().catch(console.error);
