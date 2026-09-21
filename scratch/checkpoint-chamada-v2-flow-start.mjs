import { runSshScript } from './ssh2-run.mjs';

const entry = `

## 2026-09-06 — Produção efetiva da chamada profissional V2 iniciada

- O túnel seguro local para o estúdio visual da VPS foi restabelecido sem reiniciar o container, o Chromium, a sessão Google, o encoder ou a transmissão.
- A sessão autenticada do Google Flow foi preservada e o projeto visual existente ficou novamente acessível.
- O inventário confirmou os 25 logos individuais oficiais aprovados e clipes aprovados dos apresentadores do GSA News; esses ativos poderão integrar a nova composição.
- A chamada anterior continua formalmente rejeitada e isolada: nenhum vídeo-base, montagem, áudio ou acabamento dela será reutilizado na nova chamada. Somente ativos canônicos independentes, como logos oficiais e materiais de apresentadores aprovados, podem ser reaproveitados.
- Foi preparado e validado o primeiro prompt cinematográfico do shot 001 (pulso dourado institucional), com especificação 16:9, sem texto, sem logo e sem marca-d'água.
- Bloqueio externo no instante desta atualização: o próprio Google Flow exibe aviso global de alta demanda, falha ao carregar projetos/vídeos e mantém o botão de geração desativado. Nenhum crédito foi consumido e nenhum take defeituoso foi aceito.
- A produção permanece fora do ar e sujeita a QC técnico, revisão visual e aprovação expressa do responsável antes de qualquer uso em playout.
`;
const data = Buffer.from(entry).toString('base64');
const r = await runSshScript(`printf '%s' '${data}' | base64 -d >> /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md\ntail -n 28 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`, 60000);
process.stdout.write(r.stdout);
