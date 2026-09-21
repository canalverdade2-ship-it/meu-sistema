import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Regra oficial de vozes do GSA News

- Determinação expressa do responsável: os apresentadores do GSA News manterão as vozes nativas do Google Vids.
- Holt permanece como voz masculina do GSA News e Nyla como voz feminina, selecionados dentro do próprio Google Vids.
- É proibido substituir Holt/Nyla por modelos públicos de mesmo nome encontrados na Fish Audio.
- Fish Audio não é requisito para as falas dos apresentadores do GSA News; será usado em chamadas, vinhetas e outros programas somente com modelos previamente aprovados.
- A conta Fish está autenticada, mas o saldo de API consultado está em zero, motivo do HTTP 402 nas amostras de TTS. Nenhum áudio foi gerado e nenhum débito ocorreu nesse teste.
- Nenhuma alteração foi feita no sinal ao vivo neste registro.
`;
const n64=Buffer.from(note).toString('base64');const r=await runSshScript(String.raw`printf '%s' '${n64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 14 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
