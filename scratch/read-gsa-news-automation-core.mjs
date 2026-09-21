import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`set -e
for f in /home/opc/gsa-ai/create_vids_02sep.js /home/opc/gsa-ai/check_vids_flow_02sep.js /home/opc/gsa-ai/flow_generate_master_studio.js /home/opc/gsa-ai/bin/vids-download-final.js; do
 echo "===== $f ====="; sed -n '1,360p' "$f";
done
echo '===== TODAY DRAFT MANIFESTS ====='
find /home/opc/gsa-ai/editions/gsa-manha-news-2026-09-04-draft -type f -maxdepth 2 -not -path '*/audio/*' -print -exec sed -n '1,260p' {} \;
`;
const r=await runSshScript(remote,120000); process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
