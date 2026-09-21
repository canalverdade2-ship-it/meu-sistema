import { runSshScript } from './ssh2-run.mjs';

const canonical=`# 🚨 ESTADO CANÔNICO ATUAL — LEIA PRIMEIRO
**Atualizado em:** 2026-09-06 09:42 (Brasília)  
**Base:** correções pós-auditoria, validação visual e registros confirmados até este instante  
**Status geral:** 🟢 transporte RTMP/HLS operacional e protegido contra duplicidade | 🟡 continuidade editorial/DR ainda possui pendências abertas | 🟡 chamada oficial da grade em produção

## Regra de precedência
- Esta seção é o **snapshot operacional vigente**. Em caso de conflito, prevalecem esta seção e as decisões cronológicas explícitas posteriores.
- Entradas antigas permanecem como histórico; palavras como “definitivo”, “100%”, “final” ou “estabilizado” não anulam correções posteriores.
- Nenhuma credencial, senha, token ou chave de ingestão deve ser gravada em texto aberto.

## Transmissão e arquitetura vigentes
- **Control Plane:** \`gsa-tv/control-plane:1.8.2\`.
- **Encoder Engine:** \`gsa-tv/encoder-engine:1.2.0\`.
- **Watchdog:** \`gsa-tv/watchdog:1.3.0\`.
- **RTMP:** exatamente um proprietário autorizado, \`gsa-tv-encoder-engine\`; o Control Plane não publica diretamente.
- O Engine serializa operações, reconcilia o advisory lock e protege contra publicador duplicado.
- O Watchdog observa o HLS final e o conteúdo real em execução.
- **HLS final:** \`/runtime/hls/program.m3u8\`.
- A tomada manual de mídia exige \`ready + approved + rights_ok\`, valida SHA-256, usa lease/TTL e não restaura \`media:\` transitório após reinício.
- Última verificação registrada confirmou Engine saudável, HLS recente, sem fallback, lock saudável e exatamente um publicador RTMP.
- A faixa preta fantasma do selo AO VIVO foi corrigida estruturalmente em 1.8.2; o selo vermelho correto foi preservado.
- O frontend aguarda o estado terminal real dos jobs e diferencia relay enviando de YouTube publicamente confirmado.

## Proteções operacionais
- Mosca oficial e selo vermelho AO VIVO não devem ser removidos, reposicionados, redimensionados ou alterados sem autorização expressa.
- A camada \`live_badge\` não pode voltar a passar pelo renderizador genérico de lower third.
- Alterações em encoder, RTMP, grade, playlist ou sinal ao vivo exigem autorização expressa e registro neste arquivo.
- Diagnósticos declarados somente leitura não podem executar scripts mutáveis sem inspeção prévia.

## Grade, logos, avatares e vozes
- **Grade oficial:** 25 identidades de programa; repetições na grade devem usar conteúdo editorial diferente do bloco anterior.
- **Logos:** prancha oficial aprovada em \`/home/opc/gsa-ai/assets/brand/gsa-program-logos-consolidated-25-OFFICIAL-APPROVED-2026-09-04.png\`.
- **Avatares e vozes dos programas:** casting aprovado e fixo até nova autorização expressa.
- GSA Hora da Palavra e GSA Histórias da Bíblia compartilham a voz oficial de Salomão Oliveira; a diferenciação é editorial e interpretativa.
- As três edições do GSA News usam Marcelo Valença e Lívia Fontes e preservam as vozes nativas Holt/Nyla do Google Vids.
- O avatar institucional de Adriano Farias foi aprovado para apresentações institucionais e comerciais da GSA TV.
- Sua única voz institucional autorizada é o modelo privado Fish Audio natural v2 \`f9b0947fc7c74ed0b33bd6350873fe09\`; a versão v1 robótica foi excluída do Fish Audio, da VPS e do workspace.

## Chamada oficial da grade
- Projeto Google Vids: \`GSA TV — Chamada Oficial da Grade de Programação\`, horizontal 16:9, 1080p30.
- Regra absoluta: conteúdo editorial 100% em vídeos em movimento; logos e textos somente como grafismos animados.
- Estado atual: 6 cenas, aproximadamente 2min08s, com vídeos licenciados do Vids/Getty Images.
- Todas as cinco divisões possuem transição \`Dissolver\` de 1,5 segundo.
- O roteiro foi dividido em seis núcleos e usará o locutor oficial Fish Audio “Impacto Comercial”, voice_id \`5c8a9b5d0b2549c7ada853529199ebe5\`.
- Ainda pendentes antes de declarar conclusão: gerar/inserir as seis locuções, completar identificação animada dos 25 programas e apresentadores, inserir trilha licenciada, sincronizar, reproduzir integralmente e executar QC final.

## Pacote de identidade do GSA News
- Abertura V3; Estamos Apresentando V4; Voltamos a Apresentar V4; Encerramento V3.
- As peças passaram por QC técnico/visual, mas não devem entrar automaticamente em playlist/encoder sem promoção autorizada.

## Pendências operacionais ainda abertas
1. Não há registro posterior comprovando conclusão formal do teste integral de desastre/reboot e continuidade 24x7.
2. O backup integral iniciado no checkpoint anterior não pode ser considerado aprovado sem chegar a \`restored_test\`.
3. Alertas externos continuam sem destinatário confirmado.
4. Existem blocos futuros publicados sem mídia editorial real vinculada; o filler preserva continuidade técnica, mas não substitui produção editorial.
5. A chamada oficial da grade ainda está em produção e não foi colocada no ar.

## Notas de superação explícita
- O snapshot anterior de 03:14 e os checkpoints intermediários de candidatos não promovidos estão superados por este estado.
- Control Plane 1.7.9, Encoder Engine 1.1.0 e Watchdog 1.2.0 não são mais as versões vigentes.
- O defeito \`media:\` sem TTL e a duplicação visual do \`live_badge\` foram corrigidos; não devem permanecer listados como pendências abertas atuais.
- Contagens históricas de 32/27/26/24 programas/logos não representam o estado atual.
- Registros de vozes preliminares foram superados pelas aprovações finais; a voz institucional v1 de Adriano foi excluída.

---`;
const payload=Buffer.from(canonical,'utf8').toString('base64');
const remote=String.raw`
const fs=require('fs');
const p='/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const s=fs.readFileSync(p,'utf8');
const start=s.indexOf('# 🚨 ESTADO CANÔNICO ATUAL — LEIA PRIMEIRO');
const marker='---\n\n## HISTÓRICO — Snapshot de serviços em 2026-09-04 13:08 (SUPERADO)';
const end=s.indexOf(marker,start);
if(start<0||end<0)throw Error('canonical markers not found');
const c=Buffer.from('${payload}','base64').toString('utf8');
const out=s.slice(0,start)+c+'\n\n'+s.slice(end+4);
fs.copyFileSync(p,'/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.pre-canonical-0942-20260906.md');
fs.writeFileSync(p,out,{encoding:'utf8',mode:0o600});
console.log(JSON.stringify({ok:true,old_bytes:Buffer.byteLength(s),new_bytes:Buffer.byteLength(out)}));
`;
const encoded=Buffer.from(remote,'utf8').toString('base64');
const r=await runSshScript(`printf '%s' '${encoded}' | base64 -d | sudo node
sudo sed -n '1,105p' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,120000);
process.stdout.write(r.stdout);
