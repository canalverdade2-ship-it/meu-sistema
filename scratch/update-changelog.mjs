import { runSshScript } from './ssh2-run.mjs';

const entry = `
## 2026-09-08 00:08 -03 — Integração oficial do Program Builder à API Fish Audio TTS (Worker M2)

- Backup de segurança de \`/home/opc/gsa-program-builder/builder.py\` criado em \`builder.py.bak-20260908\`.
- Implementada a descriptografia segura em memória AES-256-GCM no \`builder.py\` lendo as credenciais de \`/home/opc/gsa-ai/secrets/fish-production.enc.json\` e a chave mestra \`GSA_TV_SECRET_KEY\` diretamente do container \`gsa-tv-control-plane\` sem expor a chave em texto plano ou logs.
- Implementada a síntese dinâmica via API Fish Audio (\`https://api.fish.audio/v1/tts\`, modelo \`s2.1-pro-free\`, voz institucional \`5c8a9b5d0b2549c7ada853529199ebe5\` - Impacto Comercial) para os textos "Estamos apresentando [Programa]" e "Estamos de volta [Programa]".
- Aplicado filtro FFmpeg canônico de conformação broadcast (\`adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000\`), produzindo áudio exatamente 5.000s, 48kHz estéreo normalizado a -16 LUFS.
- Implementado cache local em disco em \`/home/opc/gsa-program-builder/cache/bumpers/\`, eliminando consultas desnecessárias à API e garantindo resposta sub-milissegundo para bumpers já gerados.
- Testada e aprovada a síntese para "GSA Agro" (presenting e return) e "GSA Tech", verificados com \`ffprobe\` (duração 5.000s, sample rate 48000, 2 canais estéreo).
- Testada a montagem end-to-end de master pelo Builder gerando MP4 720p30 H.264/AAC 48k estéreo.
- O serviço \`gsa-program-builder.service\` foi reiniciado via systemd e está ativo e operacional (\`active (running)\`).
`;

async function main() {
  const b64 = Buffer.from(entry, 'utf8').toString('base64');
  const script = `
python3 -c "
import base64
content = base64.b64decode('${b64}').decode('utf-8')
with open('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md', 'a', encoding='utf-8') as f:
    f.write(content)
print('Changelog updated successfully.')
"
tail -n 25 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;
  const r = await runSshScript(script);
  console.log('STDOUT:\n' + r.stdout);
  console.log('STDERR:\n' + r.stderr);
}

main().catch(console.error);
