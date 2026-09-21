import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function probe() {
  const script = `
echo '=== OS / KERNEL ==='
cat /etc/os-release
uname -a

echo '=== USER / GROUPS ==='
id
id gsa-tv 2>/dev/null || echo 'gsa-tv user not found'

echo '=== PYTHON / NODE / TOOLS ==='
which node npm python3 pip3 ffmpeg ffprobe curl wget jq git 2>&1
node -v 2>&1 || true
npm -v 2>&1 || true
python3 --version 2>&1 || true
pip3 --version 2>&1 || true
ffmpeg -version 2>&1 | head -n 2 || true
ffprobe -version 2>&1 | head -n 2 || true

echo '=== PACKAGE MANAGERS ==='
which dnf yum apt apt-get 2>&1 || true

echo '=== DISK SPACE ==='
df -h / /opt /opt/gsa-tv 2>&1

echo '=== GSA-TV MEDIA DIRS ==='
ls -la /opt/gsa-tv
ls -la /opt/gsa-tv/cache/media/1 2>&1 || true
ls -la /opt/gsa-tv/cache/media/1/identity 2>&1 || true
ls -la /opt/gsa-tv/cache/media/1/identity/audio 2>&1 || true
`;

  const res = await runSshScript(script, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);
}

probe().catch(console.error);
