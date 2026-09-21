import {runSshScript} from './ssh2-run.mjs';
const remote=String.raw`echo '=== MEMORY MATCHES ==='
rg -n -i 'entrevista|renome|nome.*program|grade.*program|program.*adicion|adicion.*program|boletim financeiro|desenhos clássicos|gsa motor|gsa mercado|histórias da bíblia|noite de louvor' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md /home/opc/gsa-ai/GSA_TV_MEMORY_MASTER.md /home/opc/gsa-ai/docs 2>/dev/null | tail -n 240 || true
echo '=== WORKSPACE/REMOTE CONFIG MATCHES ==='
rg -n -i --glob '*.json' --glob '*.js' --glob '*.md' --glob '*.sql' 'GSA Entrevista|GSA Boletim Financeiro|GSA Desenhos Clássicos|GSA Motor|GSA Mercado|GSA Histórias da Bíblia|GSA Noite de Louvor' /home/opc/gsa-ai /opt/gsa-tv 2>/dev/null | head -n 300 || true`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
