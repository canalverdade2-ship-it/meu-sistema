import { runSshScript } from './ssh2-run.mjs';

const title = '## 2026-09-07 — Produção imediata dos 100 vídeos de identidade iniciada';
const note = `
## 2026-09-07 — Google Vids: cota de geração identificada durante o primeiro lote

- O projeto GSA Mercado — Pacote Oficial de Identidade — 2026-09-07 foi criado no Google Vids.
- Ao concluir a primeira solicitação de plano, o Google Vids informou: “Você atingiu seu limite para gerar conteúdo no Vids”.
- Nenhum vídeo defeituoso ou incompleto foi promovido, exportado ou levado ao ar.
- Enquanto a cota não é restabelecida, a produção segue nas etapas que não dependem da geração: roteiros visuais, organização dos ativos oficiais, planos de cena, texto, áudio, conform e estrutura de QC dos 25 programas.
- Assim que a geração estiver novamente disponível, o trabalho retoma no primeiro plano do GSA Mercado e prossegue pelos demais universos criativos já definidos.
`;

const title64 = Buffer.from(title).toString('base64');
const note64 = Buffer.from(note).toString('base64');
const result = await runSshScript(`set -e
file=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
sudo cp "$file" "$file.bak-20260907-vids-start"
sudo python3 - "$file" '${title64}' '${note64}' <<'PY'
import base64, pathlib, sys
p = pathlib.Path(sys.argv[1])
title = base64.b64decode(sys.argv[2]).decode()
note = base64.b64decode(sys.argv[3]).decode()
s = p.read_text()
parts = s.split(title)
if len(parts) >= 3 and parts[-1] == parts[-2]:
    s = title.join(parts[:-1])
elif s.count(title) >= 2:
    first = s.find(title)
    second = s.find(title, first + len(title))
    block1 = s[first:second]
    block2 = s[second:]
    if block2.strip() == block1.strip():
        s = s[:second].rstrip() + '\\n'
s = s.rstrip() + '\\n' + note
p.write_text(s)
PY
sudo grep -cF "${title}" "$file"
sudo tail -n 16 "$file"
`, 30000);
process.stdout.write(result.stdout || '');
