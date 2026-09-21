import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== CHANGELOG AUDIO HISTORY ==='
sudo grep -nEi 'estal|estrident|aresample|alimiter|áudio ficou limpo|audio ficou limpo' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | tail -n 80 || true
echo '=== ENGINE AUDIO CONFIG ==='
sudo grep -RniE 'aresample|alimiter|-af |audio.*filter|192k|48000' /opt/gsa-tv/encoder-engine /opt/gsa-tv/control-plane/src 2>/dev/null | grep -vE '\.before-|node_modules' | head -n 100 || true
echo '=== CURRENT ENGINE LOG TAIL ==='
sudo docker logs --since 20m gsa-tv-encoder-engine 2>&1 | grep -Ei 'audio|timestamp|dts|pts|queue|drop|error|warning' | tail -n 80 || true
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
