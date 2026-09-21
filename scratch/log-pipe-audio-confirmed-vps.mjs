import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Áudio limpo confirmado; causa definitiva no transporte interno

- O operador confirmou em tempo real: “Agora o áudio ficou limpo”.
- Diagnóstico final: o arquivo original estava íntegro; os estalos eram introduzidos pelo transporte MPEG-TS em UDP entre o produtor e o transmissor da nova arquitetura Encoder Engine.
- Evidência do host: 99.630 erros históricos de recepção UDP por estouro de buffer. Embora o contador não aumentasse na amostra curta final, o caminho por datagramas permanecia sujeito a perdas e corrupção audível do AAC.
- Encoder Engine promovido para 1.1.0. O relay UDP localhost:12345 foi completamente removido e substituído por pipe do processo produtor para o transporte externo, com backpressure e sem encerrar o stdin durante troca de produtor.
- Control Plane promovido para 1.7.7. Removido tratamento agressivo que havia sido tentado durante o diagnóstico; arquivo original restaurado como fonte oficial.
- Cadeia de transmissão atual: AAC 192 kbps, 48 kHz, compensação suave async=1 e limitador transparente. Nenhuma restauração destrutiva aplicada ao vídeo original.
- Validação: porta UDP 12345 ausente; exatamente um publicador RTMP; Control Plane e Encoder Engine saudáveis; last_error nulo; 40 segundos da saída HLS decodificados com xerror sem qualquer erro.
- Regra permanente: o transporte interno do canal principal não deve voltar a usar UDP. Trocas dinâmicas continuam ocorrendo no produtor, enquanto o processo RTMP único permanece ativo.
EOF
echo CHANGELOG_UPDATED
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
