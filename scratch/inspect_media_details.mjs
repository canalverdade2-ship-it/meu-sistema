import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo "=== PREVIOUS BACKUP INSPECTION ==="
sudo ls -lah /opt/gsa-tv/backups/full/20260907T062245Z/
sudo du -sh /opt/gsa-tv/backups/full/20260907T062245Z/

echo "=== PLAYLISTS ==="
sudo ls -la /opt/gsa-tv/playlists/1/
echo "--- TODAY PLAYLIST ---"
sudo head -n 30 /opt/gsa-tv/playlists/1/$(date +%F).json 2>/dev/null || true
echo "--- TOMORROW PLAYLIST ---"
sudo head -n 30 /opt/gsa-tv/playlists/1/$(date -d 'tomorrow' +%F).json 2>/dev/null || true

echo "=== MEDIA BREAKDOWN IN NEWS ==="
sudo ls -lah /opt/gsa-tv/cache/media/1/news/
sudo du -sh /opt/gsa-tv/cache/media/1/news/* | sort -hr | head -n 20

echo "=== MEDIA BREAKDOWN IN PROGRAM-MASTERS ==="
sudo ls -lah /opt/gsa-tv/cache/media/1/program-masters/

echo "=== MEDIA BREAKDOWN IN IDENTITY ==="
sudo ls -lah /opt/gsa-tv/cache/media/1/identity/

echo "=== MEDIA BREAKDOWN IN FILLER ==="
sudo ls -lah /opt/gsa-tv/cache/media/1/filler/

echo "=== FALLBACK ==="
sudo ls -lah /opt/gsa-tv/fallback/
`;

const res = await runSshScript(cmd, 60000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
