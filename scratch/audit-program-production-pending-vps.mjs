import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
file=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
echo '=== LATEST PENDING REFERENCES ==='
sudo grep -nEi 'pendente|pendência|ainda não|não existe|não produzido|não conclu|aguardando|próxima etapa|abertura|encerramento|estamos apresentando|voltamos a apresentar|comercial|cenário|episódio|chamada oficial' "$file" | tail -n 220
echo '=== PROGRAM SHEETS IDENTITY PIECES ==='
sudo grep -RHiE 'Abertura|Encerramento|Estamos apresentando|Voltamos a apresentar|Estado' /home/opc/gsa-ai/docs/programas/*_FICHA.md 2>/dev/null | sort | uniq -c | sort -nr | head -n 100 || true
echo '=== IDENTITY ASSET COUNTS ==='
for d in /home/opc/gsa-ai/assets/brand /home/opc/gsa-ai/assets/casting /home/opc/gsa-ai/assets/programas /home/opc/gsa-ai/work/program-bumpers; do
  [ -d "$d" ] && echo "$d|$(sudo find "$d" -type f | wc -l)"
done
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
