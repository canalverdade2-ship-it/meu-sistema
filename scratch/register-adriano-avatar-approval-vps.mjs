import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 — Avatar institucional de Adriano aprovado

- O usuário forneceu duas referências fotográficas próprias em alta resolução: uma facial e uma de corpo inteiro.
- Foi criada a versão \`adriano-farias-institucional-v1\`, com preservação de identidade facial, barba, idade aparente e proporções corporais.
- Direção visual aprovada: apresentador executivo, terno azul-marinho/preto, camisa branca sem gravata, estúdio GSA TV em azul-marinho com luzes douradas, enquadramento horizontal 16:9.
- O usuário aprovou expressamente esta aparência como avatar institucional para apresentações e comerciais da própria GSA.
- Regra de consistência: futuras animações e vídeos falantes devem preservar exatamente esse rosto, barba, idade, figurino-base e linguagem visual; alterações relevantes exigem nova aprovação.
- Arquivo canônico no workspace: \`assets/gsa-tv/avatars/adriano-farias/adriano-farias-institucional-v1.png\`.
`;

const payload = Buffer.from(entry, 'utf8').toString('base64');
const result = await runSshScript(`set -eu
printf '%s' '${payload}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
sudo tail -n 16 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
