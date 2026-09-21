import {runSshScript} from './ssh2-run.mjs';
const note=String.raw`

## 2026-09-04 — Releitura técnica e incorporação das novas regras de produção

- O arquivo GSA_TV_MEMORY_CHANGELOG.md foi relido integralmente (508 linhas na captura desta auditoria) antes da continuidade da produção.
- Regras incorporadas ao fluxo: imagem em movimento e realismo; mídias novas e exclusivas por programa; preferência por vídeo; Flow e Vids no processo criativo; montagem final Full HD; trilhas, stings, ambiência e transições; descarte semanal dos episódios; registro contínuo na caixa-preta.
- A regra de sinal permanece: master do programa em tela cheia, com apenas mosca GSA TV e selo AO VIVO aplicados pelo playout; nenhuma dessas duas camadas pode ser alterada sem autorização expressa.
- A expressão “uso ilimitado” do Google Vids e do Fish Audio foi tratada como informação ainda não comprovada por conta/plano, e não como garantia operacional.
- O Fish Audio permanece bloqueado por ausência de credencial configurada; não será substituído silenciosamente por outra voz.

### Auditoria da biblioteca sonora

- Diretório auditado: /opt/gsa-tv/cache/media/1/identity/audio/.
- Inventário físico confirmado: news=45, viral=45, faith=45, lifestyle=45 e sfx=50; total=230 arquivos, cerca de 2,0 GB em disco.
- Manifestos localizados: manifest.json e ATTRIBUTIONS.md.
- manifest.json contém 230 entradas; nenhuma entrada sem source_url ou sha256.
- Licenças declaradas no manifesto: 180 faixas CC-BY 4.0 e 50 efeitos CC0 1.0.
- Condição obrigatória: toda faixa CC-BY 4.0 utilizada deverá receber atribuição correta no encerramento, ficha técnica e/ou EPG, conforme o caso. A existência do arquivo local não elimina essa obrigação.
- A biblioteca pode servir à produção, mas a seleção deve ser específica por programa e nenhuma licença será presumida sem conferência da entrada individual do manifesto.
- Nenhuma mudança foi realizada no encoder, Control Plane, mosca, AO VIVO ou mídia em exibição durante esta auditoria.
`;
const b64=Buffer.from(note).toString('base64');
const sh=String.raw`printf '%s' '${b64}'|base64 -d >>/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
tail -n 28 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
