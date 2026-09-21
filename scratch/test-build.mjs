import { runSshScript } from './ssh2-run.mjs';

const testBuildScript = `python3 - << 'EOF'
import sys, json
sys.path.insert(0, '/home/opc/gsa-program-builder')
import builder

manifest = builder.load_manifest('/home/opc/gsa-program-builder/examples/teste-curto-gsa-agro.json')
manifest['saida'] = 'gsa-agro-test-worker-m2.mp4'
manifest['publicar'] = False
manifest['registrar_biblioteca'] = False

res = builder.build(manifest, force=True)
print("BUILD RESULT:", json.dumps({
    'ok': res['ok'],
    'job_id': res['job_id'],
    'arquivo': res['arquivo'],
    'duracao': res['duracao'],
    'bytes': res['bytes'],
    'segmentos': len(res['segmentos'])
}, indent=2))

probe_res = builder.probe(res['arquivo'])
print("OUTPUT PROBE:", json.dumps({
    'duration': probe_res['format']['duration'],
    'streams': probe_res['streams']
}, indent=2))
EOF
`;

async function main() {
  const r = await runSshScript(testBuildScript, 120000);
  console.log('STDOUT:\n' + r.stdout);
  console.log('STDERR:\n' + r.stderr);
}

main().catch(console.error);
