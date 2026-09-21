import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Restauração forte da fonte de áudio GSA OFICIAL

- O operador confirmou que o estalo continuava após o filtro leve.
- Medição pós-encoder ainda encontrou cerca de 1,025% de amostras candidatas a clicks. Comparação confirmou que o defeito já existia no upload original (aprox. 1,133%) e no normalizado anterior (aprox. 1,116%); portanto não era causado pelo RTMP.
- Criada cópia restaurada sem sobrescrever o original: áudio com redução de ruído, dois estágios de declique, cortes de extremos, atenuação da região estridente, limitador e microfades nas extremidades para evitar click na repetição de 35 segundos.
- Nova mídia ativa: media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30-audio-restored.mp4. O cadastro de mídia foi atualizado para manter a versão restaurada em futuras seleções.
- A troca ocorreu somente no produtor interno; o PID do transporte RTMP foi preservado, permaneceu um único publicador e o Encoder Engine está sem erro.
- Métricas da cópia restaurada: cerca de -17,6 LUFS, true peak -2,1 dBFS, AAC 192 kbps/48 kHz estéreo.
EOF
echo CHANGELOG_UPDATED
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
