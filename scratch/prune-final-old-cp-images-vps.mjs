import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
ACTIVE=$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')
test "$ACTIVE" = gsa-tv/control-plane:1.7.5
sudo docker image ls gsa-tv/control-plane --format '{{.Repository}}:{{.Tag}}' | grep -v '^gsa-tv/control-plane:1.7.5$' | while read -r img; do sudo docker image rm "$img" >/dev/null 2>&1 || true; done
LEFT=$(sudo docker image ls gsa-tv/control-plane --format '{{.Repository}}:{{.Tag}}')
test "$LEFT" = gsa-tv/control-plane:1.7.5
COUNT=$(ps -eo args= | grep '[f]fmpeg' | grep -c 'rtmp://a.rtmp.youtube.com/live2/' || true)
test "$COUNT" -eq 1
echo "remaining_image=$LEFT"
echo "publishers=$COUNT"
STAMP=$(date -Iseconds)
sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null <<EOF

## $STAMP — Remoção do último estoque de imagens antigas do Control Plane

- A segunda auditoria listou tags históricas 1.1.x a 1.6.x ainda armazenadas localmente. Embora nenhuma estivesse em execução e o guardião impedisse publicação concorrente, elas representavam uma possibilidade de inicialização manual equivocada.
- Todas as imagens antigas do repositório gsa-tv/control-plane foram removidas da VPS.
- Única imagem restante e ativa: gsa-tv/control-plane:1.7.5, reconstruída sem o publicador legado.
- Após a limpeza permanece exatamente um publicador RTMP.
EOF
echo OLD_IMAGES_PRUNED
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
