import { runSshScript } from './ssh2-run.mjs';

const note = `

## 2026-09-04 — Auditoria da possível duplicação GSA Tá na Rede

- Consulta direta ao banco ativo confirmou dois programas publicados: GSA Tá na Rede e GSA Tá na Rede Web.
- Ambos possuem categoria internet, duração padrão de 1.800 segundos e descrição genérica idêntica.
- GSA Tá na Rede está habilitado diariamente às 03:45, domingo às 11:00 e de segunda a sexta às 17:00.
- GSA Tá na Rede Web está habilitado sábado e domingo às 20:30.
- Não foi encontrada no cadastro uma diferenciação editorial, formato, público ou identidade que justifique duas marcas independentes.
- Diagnóstico: há dois registros e horários distintos, mas a distinção de programa não está sustentada; operacionalmente aparenta duplicação de marca/variante de faixa.
- Nenhum registro ou horário foi alterado nesta auditoria, pois a pergunta solicitou confirmação e a remoção/união exige definição do responsável.
- A prancha de logos permanece em revisão e não foi promovida como oficial.
`;
const b64=Buffer.from(note,'utf8').toString('base64');
const result=await runSshScript(`printf '%s' '${b64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 13 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,60000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
