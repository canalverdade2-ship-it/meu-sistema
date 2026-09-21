const fs=require('fs');
const root='/home/opc/gsa-ai/editions/gsa-manha-news-2026-09-08-1h/work/';
fs.copyFileSync('/home/opc/news-video-requirements-20260909.json',root+'video-requirements-20260909.json');
const file='/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';
const marker='news-new-video-90pct-no-reuse-20260909';
if(!fs.readFileSync(file,'utf8').includes(marker)) fs.appendFileSync(file,`\n## 2026-09-09 — News: vídeos novos, mínimo 90%, sem repetição\n\n- Exigência expressa do usuário: News com no mínimo 90% em vídeos; nenhum vídeo repetido e nenhum vídeo que já exista na VPS. Todos os vídeos devem ser novos.\n- Para 60 minutos, cobertura mínima de vídeo distinto: 3240 segundos (54 minutos). Fotografias, zoom em imagens e gráficos não contam para atingir essa cota.\n- Os 10 b-rolls anteriores ficam excluídos da nova montagem. Não apagar o acervo; apenas impedir seu uso nesta produção. Reencodar/recortar um vídeo antigo não o torna novo.\n- Ainda não há vídeos novos aprovados para cumprir a nova exigência. Aquisição, conferência editorial/licenças, comparação com o acervo e medição de timeline permanecem pendentes.\n- Regra salva em ${root}video-requirements-20260909.json. Preservar 1080p30, remover som original e manter créditos inferiores esquerdos.\n- ${marker}\n`);
console.log('Regra persistida no pacote do News e no changelog.');
