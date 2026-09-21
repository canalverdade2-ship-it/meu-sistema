import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`
set -euo pipefail

echo "=== DISK BEFORE PHASE 1 ==="
df -h /

echo "=== STEP 1.1: ARCHIVE SCRIPTS & MANIFESTS FROM WORK ==="
tar -czf /home/opc/work-scripts-backup-20260909.tar.gz \
  -C /home/opc/gsa-ai/work \
  $(find /home/opc/gsa-ai/work -maxdepth 2 \( -name "*.cjs" -o -name "*.mjs" -o -name "*.js" -o -name "*.json" -o -name "*.sql" -o -name "*.sh" -o -name "*.md" \) -printf '%P\n' 2>/dev/null || true)
ls -lh /home/opc/work-scripts-backup-20260909.tar.gz

echo "=== STEP 1.2: REMOVE WORK SCRATCH DIRECTORIES ==="
rm -rf /home/opc/gsa-ai/work/chamada-grade-v2 \
       /home/opc/gsa-ai/work/identity-flow-20260907 \
       /home/opc/gsa-ai/work/chamada-grade-20260906 \
       /home/opc/gsa-ai/work/vinheta-flow-40s \
       /home/opc/gsa-ai/work/encoder-outer-audio-fix-20260907T051649Z \
       /home/opc/gsa-ai/work/bible-rebuild-20260909 \
       /home/opc/gsa-ai/work/corrections-20260906 \
       /home/opc/gsa-ai/work/incompatible-swap-guard-20260907 \
       /home/opc/gsa-ai/work/test-flow-20260909 \
       /home/opc/gsa-ai/work/source-research-20260909 \
       /home/opc/gsa-ai/work/referencias-chamadas

echo "=== STEP 1.3: REMOVE OBSOLETE EDITIONS ==="
rm -rf /home/opc/gsa-ai/editions/gsa-manha-news-2026-09-08-1h \
       /home/opc/gsa-ai/editions/momento-de-fe-2026-09-02 \
       /home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min \
       /home/opc/gsa-ai/editions/gsa-news-2026-09-02 \
       /home/opc/gsa-ai/editions/gsa-manha-news-2026-09-04-draft \
       /home/opc/gsa-ai/editions/gsa-historias-da-biblia-2026-09-08

echo "=== STEP 1.4: CLEAN TEMPORARY DOWNLOADS & TMP ==="
rm -rf /home/opc/gsa-ai/data/downloads/*
sudo rm -rf /tmp/gsa-tv-editorial \
            /tmp/news_chunk.mp4 \
            /tmp/source-*.wav \
            /tmp/gsa-news-edge-venv \
            /tmp/src-full.raw \
            /tmp/clean-audio.raw \
            /tmp/intro.mp4 \
            /tmp/salomao-intro-1080p30.mp4 \
            /tmp/outro.mp4 \
            /tmp/news-theme-bed.wav \
            /tmp/fast_black.mp4 \
            /tmp/news-voice-*.wav \
            /tmp/gsa_tv_official_brand_pack_v2 \
            /tmp/gsa_tv_institutional_brand_pack \
            /tmp/salomao.mp4 \
            /tmp/krampus_fresh.mp3 \
            /tmp/main.mp4 \
            /tmp/*.txt

echo "=== STEP 1.5: DOCKER CLEANUP ==="
docker builder prune -f >/dev/null || true
docker image prune -f >/dev/null || true

echo "=== DISK AFTER PHASE 1 ==="
df -h /
`;

const res = await runSshScript(cmd, 60000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
