import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`from pathlib import Path
p=Path('/home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md')
s=p.read_text(encoding='utf-8')
s=s.replace('Cada programa requer abertura MASTER Full HD e fechamento MASTER Full HD próprios.','Cada programa requer quatro peças MASTER Full HD próprias: abertura, “Estamos apresentando” (ida para o comercial), “Voltamos a apresentar” (retorno do comercial) e encerramento.')
s=s.replace('| Programa | Abertura | Fechamento | Observação |','| Programa | Abertura | Estamos apresentando | Voltamos a apresentar | Encerramento | Observação |')
s=s.replace('|---|---|---|---|','|---|---|---|---|---|---|',1)
out=[]
for line in s.splitlines():
    if line.startswith('| GSA ') and line.count('|')==4:
        parts=[x.strip() for x in line.split('|')[1:-1]]
        line=f'| {parts[0]} | AUSENTE | AUSENTE | AUSENTE | AUSENTE | Produzir as quatro peças oficiais no Flow/Vids, com áudio final, e submeter a QC |'
    out.append(line)
s='\n'.join(out)+'\n'
s=s.replace('- Masters necessários: 64 (32 aberturas + 32 fechamentos)','- Masters necessários: 128 (32 aberturas + 32 “Estamos apresentando” + 32 “Voltamos a apresentar” + 32 encerramentos)')
s=s.replace('- Fechamentos oficiais prontos: 0','- “Estamos apresentando” oficiais prontos: 0\n- “Voltamos a apresentar” oficiais prontos: 0\n- Encerramentos oficiais prontos: 0')
s=s.replace('- Situação oficial: 64 masters pendentes (32 aberturas + 32 encerramentos).','- Situação oficial: 128 masters pendentes; nenhuma das quatro categorias possui peça oficial aprovada.')
p.write_text(s,encoding='utf-8')
print('\n'.join([x for x in s.splitlines() if 'Masters necessários' in x or 'oficiais prontos' in x or 'Situação oficial' in x]))
`;
const note=String.raw`

## 2026-09-04 — Vinhetas de ida e volta do comercial adicionadas ao inventário

- O responsável confirmou que também não existem vinhetas oficiais de “Estamos apresentando” e “Voltamos a apresentar”.
- Cada um dos 32 programas passa a exigir quatro peças oficiais próprias: abertura, “Estamos apresentando”, “Voltamos a apresentar” e encerramento.
- Novo total canônico: 128 masters pendentes; zero peças oficiais aprovadas nas quatro categorias.
- O inventário /home/opc/gsa-ai/docs/GSA_PROGRAM_IDENTITY_MASTER_2026-09-04.md foi atualizado.
- Os arquivos antigos continuam classificados apenas como testes/referências.
`;
const p64=Buffer.from(py).toString('base64'),n64=Buffer.from(note).toString('base64');
const sh=String.raw`printf '%s' '${p64}'|base64 -d >/tmp/add-commercial-bumpers.py
python3 /tmp/add-commercial-bumpers.py
printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
rm -f /tmp/add-commercial-bumpers.py
tail -n 12 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
