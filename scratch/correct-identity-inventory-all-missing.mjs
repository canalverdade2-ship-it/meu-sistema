import {runSshScript} from './ssh2-run.mjs';

const py=String.raw`from pathlib import Path
p=Path('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md')
text=p.read_text(encoding='utf-8')
lines=[]
for line in text.splitlines():
    if line.startswith('| GSA ') and line.count('|') >= 4:
        name=line.split('|')[1].strip()
        line=f'| {name} | AUSENTE | AUSENTE | Produzir abertura e encerramento oficiais no Flow/Vids, com áudio final, e submeter a QC |'
    lines.append(line)
text='\n'.join(lines)+'\n'
text=text.replace('- Estado “candidato existente” exige QC antes de aprovação.','- Arquivos e vinhetas existentes são somente testes/referências; nenhum é identidade oficial aprovada.\n- A abertura e o encerramento do GSA News também precisam ser produzidos oficialmente.')
text=text.replace('- Aberturas candidatas localizadas automaticamente: 4','- Aberturas oficiais prontas: 0')
text=text.replace('- Fechamentos nomeados localizados: 0','- Fechamentos oficiais prontos: 0')
text=text.replace('- Nenhum candidato é considerado aprovado sem inspeção visual, ffprobe, loudness e teste de inserção.','- Situação oficial: 64 masters pendentes (32 aberturas + 32 encerramentos).\n- Nenhum teste existente pode ser promovido ou exibido como identidade oficial.')
p.write_text(text,encoding='utf-8')
print(text)
`;
const note=String.raw`
## 2026-09-04 — Retificação do inventário de aberturas e encerramentos

- O responsável editorial corrigiu a classificação anterior: **nenhum programa possui abertura ou encerramento oficial aprovado**.
- A abertura e o encerramento existentes do **GSA News** são somente testes e deverão ser refeitos como versões oficiais.
- Os MP4 antigos localizados na pasta de vinhetas ficam classificados exclusivamente como **testes/referências**, sem autorização para uso oficial no ar.
- Estado canônico corrigido: **32 programas, 0 aberturas oficiais, 0 encerramentos oficiais e 64 masters pendentes**.
- O documento /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md foi retificado para refletir esta determinação.
- Nenhuma alteração foi feita no encoder, no Control Plane ou no sinal ao vivo durante esta retificação documental.
`;
const py64=Buffer.from(py).toString('base64');
const note64=Buffer.from(note).toString('base64');
const remote=String.raw`printf '%s' '${py64}'|base64 -d >/tmp/correct-id-inventory.py
python3 /tmp/correct-id-inventory.py
printf '%s' '${note64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
rm -f /tmp/correct-id-inventory.py
printf '\n--- VERIFY ---\n'
grep -E 'Aberturas oficiais prontas|Fechamentos oficiais prontas|64 masters|GSA News' /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md
tail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(remote,60000);
process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
