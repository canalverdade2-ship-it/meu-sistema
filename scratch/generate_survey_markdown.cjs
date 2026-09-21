const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const enriched = JSON.parse(fs.readFileSync(path.join(__dirname, 'admin_survey_enriched.json'), 'utf-8'));
const outputFilePath = path.join(
  rootDir,
  '.agents',
  'teamwork_preview_explorer_survey_web',
  'survey_web_report.md'
);

// Group by squad
const squads = {};
enriched.forEach(item => {
  if (!squads[item.squad]) {
    squads[item.squad] = [];
  }
  squads[item.squad].push(item);
});

// Compute aggregate metrics
const totalComponents = enriched.length;
const totalLines = enriched.reduce((sum, item) => sum + item.lines, 0);

const uniqueTables = new Set();
const uniqueRpcs = new Set();
const uniqueEdgeFunctions = new Set();
enriched.forEach(item => {
  item.tableNames.forEach(t => uniqueTables.add(t));
  item.rpcs.forEach(r => uniqueRpcs.add(r));
  item.edgeFunctions.forEach(ef => uniqueEdgeFunctions.add(ef));
});

let md = '';

md += `# Relatório Técnico de Mapeamento e Auditoria dos Módulos Web Admin (ERP GSA)\n\n`;
md += `> **Data do Levantamento**: 2026-09-19  \n`;
md += `> **Escopo da Análise**: \`src/components/admin/**\` (100% dos componentes \`.tsx\`)  \n`;
md += `> **Finalidade**: Subsidiar a Migração Nativa Completa do ERP Web para Aplicativo Móvel (React Native / Expo) com Paridade Funcional de 100%  \n\n`;

md += `---\n\n`;

md += `## 1. Sumário Executivo & Métricas Consolidadas\n\n`;
md += `Foi realizada uma varredura exaustiva, automatizada e minuciosa em **todos os arquivos TypeScript React (\`.tsx\`)** localizados no diretório \`src/components/admin/\` e seus respectivos subdiretórios (\`super-domains\`, \`clientes\`, \`demandas\`, \`ecommerce\`, \`gsa-tv\`, \`infra\`, \`prestadores\`, \`products\`, \`relatorios\`, \`ui\`).\n\n`;

md += `### Tabela Geral de Métricas\n\n`;
md += `| Métrica | Quantitativo Absoluto |\n`;
md += `| :--- | :--- |\n`;
md += `| **Total de Componentes .tsx Catalogados** | **${totalComponents} arquivos** |\n`;
md += `| **Total de Linhas de Código Analisadas** | **${totalLines.toLocaleString('pt-BR')} linhas** |\n`;
md += `| **Tabelas Supabase Acessadas Diretamente** | **${uniqueTables.size} tabelas únicas** |\n`;
md += `| **Funções RPC (Remote Procedure Calls) Chamadas** | **${uniqueRpcs.size} RPCs únicas** |\n`;
md += `| **Edge Functions / Microserviços Invocados** | **${uniqueEdgeFunctions.size} endpoints** |\n`;
md += `| **Esquadrões de Domínio (Squads) Definidos** | **${Object.keys(squads).length} squads especializados** |\n\n`;

md += `### Distribuição por Esquadrões de Domínio (Squads)\n\n`;
md += `| ID | Esquadrão / Domínio Funcional | Componentes | Linhas Totais | Complexidade Média | Principais Entidades |\n`;
md += `| :--- | :--- | :---: | :---: | :---: | :--- |\n`;

Object.keys(squads).sort().forEach((squadName, idx) => {
  const items = squads[squadName];
  const squadLines = items.reduce((s, i) => s + i.lines, 0);
  const highComp = items.filter(i => i.complexity === 'Alta').length;
  const medComp = items.filter(i => i.complexity === 'Média').length;
  const lowComp = items.filter(i => i.complexity === 'Baixa').length;
  const compStr = `${highComp} Alta / ${medComp} Média / ${lowComp} Baixa`;
  
  const tablesSet = new Set();
  items.forEach(i => i.tableNames.forEach(t => tablesSet.add(t)));
  const topTables = Array.from(tablesSet).slice(0, 4).join(', ') || 'Infra/UI';

  md += `| **SQ-0${idx + 1}** | **${squadName}** | ${items.length} | ${squadLines.toLocaleString('pt-BR')} | ${compStr} | ${topTables} |\n`;
});

md += `\n---\n\n`;

md += `## 2. Topologia Arquitetural de \`src/components/admin/\`\n\n`;
md += `A estrutura do painel administrativo do ERP GSA divide-se em quatro grandes camadas estruturais:\n\n`;
md += `1. **Raiz (\`src/components/admin/*.tsx\` - 68 componentes)**:\n`;
md += `   - Módulos canônicos de alto nível integrados ao roteador (\`AdminPanel.tsx\`, \`CadastroModule.tsx\`, \`VendasModule.tsx\`, \`FinanceiroModule.tsx\`, \`TicketsModule.tsx\`, \`AcessosModule.tsx\`, \`GsaTvModule.tsx\`).\n`;
md += `   - Controles de dashboard, status e atalhos rápidos de navegação.\n`;
md += `2. **Super-Domínios (\`src/components/admin/super-domains/**\` - 51 componentes)**:\n`;
md += `   - Arquitetura corporativa em "Super Domains" introduzida para descentralizar operações complexas:\n`;
md += `     - \`financeiro/\` (11 componentes): Cockpit financeiro, faturamento, DRE/fluxo de caixa, conciliação e disputas.\n`;
md += `     - \`pessoas/\` (11 componentes): Gestão unificada de clientes, prestadores, fornecedores, parceiros e afiliados.\n`;
md += `     - \`operacoes/\` (9 componentes): Workstations dedicadas para Demandas, Orçamentos, OS, Compras e Viagens.\n`;
md += `     - \`governanca/\` (8 componentes): Dashboards executivos, auditoria de transações, logs de segurança e políticas.\n`;
md += `     - \`contratos/\` (8 componentes): CRM 360º, minutas contratuais, ZapSign, B2B e contratos setoriais.\n`;
md += `     - \`shared/\` (4 componentes): Componentes táticos transversais (TacticalDataGrid, SplitScreenLayout, CommandSlideOver, StatusBadge).\n`;
md += `3. **Subdiretórios Especializados (53 componentes)**:\n`;
md += `   - \`relatorios/\` (15 componentes): Relatórios analíticos e operacionais segmentados por verticais de negócio.\n`;
md += `   - \`gsa-tv/\` (10 componentes): Suíte broadcast, estúdio de grade, acervo de mídia e automação por IA.\n`;
md += `   - \`products/\` (8 componentes): Importação multi-formato, wizard de fornecedores e leitura de código de barras.\n`;
md += `   - \`prestadores/\` (7 componentes): Gestão cadastral profunda, prêmios, vouchers e auditoria documental de prestadores.\n`;
md += `   - \`demandas/\` (6 componentes): Quadro Kanban, modal de despacho, histórico e time tracking de chamados.\n`;
md += `   - \`infra/\` (4 componentes): Gerenciamento Cloudflare R2/DNS, métricas Oracle Cloud VPS e terminal WebSockets SSH.\n`;
md += `   - \`ecommerce/\` (2 componentes): Inteligência de vendas da loja virtual e precificação dinâmica.\n`;
md += `   - \`clientes/\` (1 componente): Gaveta de detalhes completos e histórico 360 do cliente.\n`;
md += `4. **Componentes Táticos de UI (\`src/components/admin/ui/*.tsx\` - 4 componentes)**:\n`;
md += `   - Feed de atividades administrativas, paleta de comandos (\`Ctrl+K\`), cartões de domínio e botão institucional WhatsApp.\n\n`;

md += `---\n\n`;

md += `## 3. Catálogo Exaustivo dos Componentes por Esquadrão (Squad)\n\n`;

Object.keys(squads).sort().forEach((squadName, sIdx) => {
  const items = squads[squadName];
  const squadLines = items.reduce((s, i) => s + i.lines, 0);

  md += `### ${squadName}\n\n`;
  md += `- **Total de Componentes**: ${items.length}\n`;
  md += `- **Volume de Código**: ${squadLines.toLocaleString('pt-BR')} linhas\n`;
  md += `- **Diretórios Base**: ${Array.from(new Set(items.map(i => i.relPathFromAdmin.split('/')[0]))).join(', ')}\n\n`;

  md += `#### Inventário Detalhado dos Componentes\n\n`;

  items.forEach((c, cIdx) => {
    md += `##### ${sIdx + 1}.${cIdx + 1}. \`${c.componentName}\`\n\n`;
    md += `- **Arquivo**: \`${c.relPathFromRoot}\`\n`;
    md += `- **Linhas de Código**: ${c.lines} linhas\n`;
    md += `- **Complexidade de Migração Mobile**: **${c.complexity}**\n`;
    if (c.title) {
      md += `- **Título / Rótulo de Interface**: "${c.title}"\n`;
    }
    md += `- **Tabelas Supabase Acessadas**:\n`;
    if (c.tables.length > 0) {
      c.tables.forEach(t => {
        md += `  - \`${t}\`\n`;
      });
    } else {
      md += `  - *Nenhum acesso direto a tabelas (opera via props, contexto, orquestração ou serviço externo)*\n`;
    }

    md += `- **RPCs / Edge Functions Chamadas**:\n`;
    const rpcList = [...c.rpcs.map(r => `RPC: \`${r}\``), ...c.edgeFunctions.map(ef => `Edge Function: \`${ef}\``)];
    if (rpcList.length > 0) {
      rpcList.forEach(r => {
        md += `  - ${r}\n`;
      });
    } else {
      md += `  - *Nenhuma RPC ou Edge Function direta*\n`;
    }

    md += `- **Capacidades Interativas & Padrões de UI**:\n`;
    if (c.capabilities.length > 0) {
      c.capabilities.forEach(cap => {
        md += `  - ${cap}\n`;
      });
    } else {
      md += `  - Visualização simples / Card informativo\n`;
    }

    if (c.handlers.length > 0) {
      md += `- **Ações e Handlers Principais**: \`${c.handlers.join('`, `')}\`\n`;
    }
    if (c.inputLabels.length > 0) {
      md += `- **Campos e Formulários Detectados**: ${c.inputLabels.join(', ')}\n`;
    }

    md += `- **Diretriz de Adaptação Mobile (React Native)**:\n`;
    if (c.complexity === 'Alta') {
      md += `  - *Padrão Recomendado*: Dividir interface densa de desktop em fluxo de telas com \`Stack.Navigator\` e \`BottomTab\`. Substituir tabelas largas por cartões verticais virtuais (\`FlashList\`), formulários em passos (\`FormWizard\`), e gavetas laterais por \`BottomSheetModal\` (@gorhom/bottom-sheet).\n`;
    } else if (c.complexity === 'Média') {
      md += `  - *Padrão Recomendado*: Converter listagens em cards colapsáveis com chips de filtro rápido no topo (\`ScrollView\` horizontal). Modais de edição convertidos em \`Modal\` nativo ou tela dedicada.\n`;
    } else {
      md += `  - *Padrão Recomendado*: Componente modular leve, adaptação direta com componentes nativos (\`View\`, \`Text\`, \`Pressable\`, \`Switch\`).\n`;
    }

    md += `\n`;
  });

  md += `---\n\n`;
});

md += `## 4. Matrizes de Dependências Cross-Cutting\n\n`;

md += `### 4.1. Matriz de Acesso a Tabelas Supabase\n\n`;
md += `Abaixo estão listadas todas as tabelas do Supabase referenciadas pelos componentes administrativos, com a indicação de quais componentes realizam operações nelas:\n\n`;

const sortedTables = Array.from(uniqueTables).sort();
md += `| Tabela | Ocorrências | Componentes que Acessam |\n`;
md += `| :--- | :---: | :--- |\n`;

sortedTables.forEach(t => {
  const accessingComponents = enriched.filter(e => e.tableNames.includes(t)).map(e => `\`${e.componentName}\``);
  md += `| \`${t}\` | ${accessingComponents.length} | ${accessingComponents.slice(0, 6).join(', ')}${accessingComponents.length > 6 ? ` e mais ${accessingComponents.length - 6}...` : ''} |\n`;
});

md += `\n### 4.2. Registro de Funções RPC (Remote Procedure Calls)\n\n`;
md += `| Função RPC | Chamadores |\n`;
md += `| :--- | :--- |\n`;

const sortedRpcs = Array.from(uniqueRpcs).sort();
sortedRpcs.forEach(r => {
  const callingComponents = enriched.filter(e => e.rpcs.includes(r)).map(e => `\`${e.componentName}\``);
  md += `| \`${r}\` | ${callingComponents.join(', ')} |\n`;
});

md += `\n### 4.3. Microserviços, Edge Functions & APIs de Infraestrutura\n\n`;
md += `O ecossistema administrativo integra-se com microserviços em nuvem para automação crítica:\n\n`;
md += `1. **VPS Oracle Cloud (Linux \`147.15.43.141\`)**:\n`;
md += `   - \`vps-api/metrics\`: Coleta de telemetria em tempo real (CPU, memória RAM, disco e rede) via \`OracleMetricsPanel.tsx\`.\n`;
md += `   - \`vps-api/power\`: Comandos de ciclo de energia (start, stop, reboot) do servidor.\n`;
md += `   - \`ssh-proxy\`: Ponte WebSocket para emulação de terminal interativo xterm no navegador (\`VPSTerminal.tsx\`).\n`;
md += `2. **Cloudflare Gateway & R2 Object Storage**:\n`;
md += `   - \`cloudflare-api/analytics\`: Métricas de tráfego, cache hit ratio e segurança DDoS.\n`;
md += `   - \`cloudflare-api/r2-files\`: Gestão do bucket de arquivos e mídias privadas/públicas.\n`;
md += `   - \`cloudflare-api/purge-cache\`, \`dev-mode\`, \`under-attack\`: Controles de borda da CDN.\n`;
md += `3. **Evolution API & WhatsApp Gateway**:\n`;
md += `   - \`WhatsAppQRCodeManager.tsx\` e \`WhatsAppHealthMonitor.tsx\`: Emparelhamento multi-dispositivo de ramais de atendimento e monitoramento de fila de disparos.\n`;
md += `4. **Supabase Realtime Engine**:\n`;
md += `   - Sincronização reativa de notificações, orçamentos, demandas, faturas e auditoria de colaboradores.\n\n`;

md += `---\n\n`;

md += `## 5. Recomendações e Diretrizes para o Time de Migração Mobile\n\n`;
md += `1. **Abstração da Camada de Dados**:\n`;
md += `   - Reutilizar a camada de \`adminRpc.ts\` e queries Supabase encapsuladas em hooks customizados do TanStack Query (\`@tanstack/react-query\`), garantindo cache e invalidação determinística no React Native.\n`;
md += `2. **Substituição de Tabelas Desktop por Listas Virtuais**:\n`;
md += `   - Nunca renderizar \`<table>\` HTML ou layouts com largura fixa de 1000px+ no mobile. Utilizar \`@shopify/flash-list\` com renderização de cartões táteis contendo dados principais e expansão sob demanda (\`Accordion\` ou toque para detalhes).\n`;
md += `3. **Tratamento de Modais e Drawers**:\n`;
md += `   - Substituir gavetas laterais de desktop (\`CommandSlideOver\`, \`Drawer\`) por \`BottomSheetModal\` de alto desempenho nativo no Android e iOS.\n`;
md += `4. **Estratégia de Roteamento por Esquadrões**:\n`;
md += `   - Organizar a navegação mobile espelhando os 9 esquadrões catalogados, permitindo que cada squad desenvolva e teste suas telas de forma desacoplada e isolada.\n\n`;

fs.writeFileSync(outputFilePath, md, 'utf-8');
console.log(`Generated survey_web_report.md successfully at: ${outputFilePath}`);
console.log(`File size: ${fs.statSync(outputFilePath).size} bytes`);
