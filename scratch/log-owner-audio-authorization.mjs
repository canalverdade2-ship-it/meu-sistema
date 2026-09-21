import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Confirmação do responsável: biblioteca sonora liberada para a GSA TV

- O responsável pela GSA TV declarou expressamente que todos os 230 arquivos da nova biblioteca de áudio estão 100% liberados para uso na GSA TV.
- Estado operacional: biblioteca autorizada para seleção e incorporação nos programas, aberturas, encerramentos, chamadas e transições da emissora.
- As condições específicas descritas no manifesto continuam sendo cumpridas durante o uso; para arquivos CC-BY 4.0, o crédito de autoria/licença será incluído na ficha técnica, encerramento e/ou EPG aplicável.
- Os efeitos registrados como CC0 podem ser utilizados sem atribuição obrigatória, mantendo-se a referência no manifesto interno para rastreabilidade.
- Esta confirmação não transforma testes antigos em masters oficiais: continuam pendentes 32 aberturas e 32 encerramentos oficiais.
- Nenhuma alteração foi feita no encoder, no Control Plane, na mosca, no selo AO VIVO ou na mídia em exibição neste registro.
`;
const b64=Buffer.from(note).toString('base64');
const sh=String.raw`printf '%s' '${b64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 14 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(sh,60000);
process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
