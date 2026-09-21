import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
echo '=== INDEX ==='
sudo cat /home/opc/gsa-ai/docs/programas/INDEX.md 2>/dev/null || true
echo '=== PROGRAM BRIEFS ==='
for f in /home/opc/gsa-ai/docs/programas/*_FICHA.md; do
  echo "##### $(basename "$f")"
  sudo grep -Ei '^# |^- (Categoria|Proposta|Promessa|Formato|Apresent|Voz|Cenário|Paleta|Identidade|Público|Duração|Logo|Avatar|Nome artístico):|^## (Identidade|Proposta|Formato|Apresentação|Cenário)' "$f" | head -n 40
done
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
