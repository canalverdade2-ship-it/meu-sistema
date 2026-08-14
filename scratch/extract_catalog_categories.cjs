const fs = require('fs');
const path = require('path');

const FEED_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcFMjz35zY_7hscVJ_4QLIFiIR3DQ9hsrLcX6rgIVVFkb';

// Parser CSV com suporte a campos entre aspas e quebras de linha dentro de aspas
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // pula aspa duplicada
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && currentRow.some(f => f.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

async function analyzeFeed(url, name) {
  console.log(`\n======================================================`);
  console.log(`📥 Baixando e analisando catálogo: ${name}...`);
  console.log(`🔗 URL: ${url}`);
  console.log(`======================================================\n`);

  const startTime = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!res.ok) {
    console.error(`❌ Erro no download: HTTP ${res.status} ${res.statusText}`);
    return null;
  }

  const contentLength = res.headers.get('content-length');
  const disposition = res.headers.get('content-disposition');
  console.log(`📦 Tamanho do arquivo: ${(contentLength / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`📄 Arquivo: ${disposition || 'sem nome'}`);

  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  console.log(`⏱️ Download e decodificação concluídos em ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

  console.log(`⚙️ Fazendo parsing completo do CSV...`);
  const parseStart = Date.now();
  const rows = parseCSV(text);
  console.log(`⏱️ Parsing concluído em ${((Date.now() - parseStart) / 1000).toFixed(2)}s`);

  if (rows.length === 0) {
    console.log('❌ CSV vazio');
    return null;
  }

  const headers = rows[0].map(h => h.trim());
  console.log(`\n📋 Colunas encontradas (${headers.length}):`, headers.join(' | '));

  const idxCat1 = headers.indexOf('global_category1');
  const idxCat2 = headers.indexOf('global_category2');
  const idxCatId1 = headers.indexOf('global_catid1');
  const idxCatId2 = headers.indexOf('global_catid2');
  const idxTitle = headers.indexOf('title');
  const idxItemId = headers.indexOf('itemid');

  const cat1Map = {};
  const cat2Map = {};
  let totalProducts = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cat1 = (idxCat1 !== -1 && row[idxCat1] ? row[idxCat1].trim() : '') || 'Sem Categoria Principal';
    const cat2 = (idxCat2 !== -1 && row[idxCat2] ? row[idxCat2].trim() : '') || 'Sem Subcategoria';
    const catId1 = idxCatId1 !== -1 && row[idxCatId1] ? row[idxCatId1].trim() : '';
    const catId2 = idxCatId2 !== -1 && row[idxCatId2] ? row[idxCatId2].trim() : '';
    const itemId = idxItemId !== -1 && row[idxItemId] ? row[idxItemId].trim() : '';

    if (!itemId && (!row[idxTitle] || row[idxTitle].trim() === '')) {
      continue;
    }

    totalProducts++;

    if (!cat1Map[cat1]) {
      cat1Map[cat1] = {
        name: cat1,
        count: 0,
        ids: new Set(),
        subcats: {}
      };
    }
    cat1Map[cat1].count++;
    if (catId1) cat1Map[cat1].ids.add(catId1);

    if (!cat1Map[cat1].subcats[cat2]) {
      cat1Map[cat1].subcats[cat2] = {
        name: cat2,
        count: 0,
        ids: new Set()
      };
    }
    cat1Map[cat1].subcats[cat2].count++;
    if (catId2) cat1Map[cat1].subcats[cat2].ids.add(catId2);

    cat2Map[cat2] = (cat2Map[cat2] || 0) + 1;
  }

  console.log(`\n======================================================`);
  console.log(`📊 RESUMO GERAL DO CATÁLOGO (${name})`);
  console.log(`======================================================`);
  console.log(`Total de Linhas no CSV: ${(rows.length - 1).toLocaleString('pt-BR')}`);
  console.log(`Total de Produtos Válidos: ${totalProducts.toLocaleString('pt-BR')}`);
  console.log(`Total de Categorias Principais (global_category1): ${Object.keys(cat1Map).length}`);
  console.log(`Total de Subcategorias Únicas (global_category2): ${Object.keys(cat2Map).length}`);
  console.log(`======================================================\n`);

  const sortedCat1 = Object.values(cat1Map).sort((a, b) => b.count - a.count);

  console.log(`\n🏷️ TABELA DE TODAS AS CATEGORIAS PRINCIPAIS (global_category1):\n`);
  console.log(`| # | Categoria Principal | ID Categoria | Qtd. Produtos | % do Total | Qtd. Subcategorias |`);
  console.log(`|---|---|---|---|---|---|`);

  sortedCat1.forEach((cat, idx) => {
    const pct = ((cat.count / totalProducts) * 100).toFixed(2);
    const ids = Array.from(cat.ids).join(', ') || 'N/A';
    const subcatCount = Object.keys(cat.subcats).length;
    console.log(`| ${idx + 1} | ${cat.name} | ${ids} | ${cat.count.toLocaleString('pt-BR')} | ${pct}% | ${subcatCount} |`);
  });

  console.log(`\n\n🌳 HIERARQUIA COMPLETA (Categoria > Subcategorias com contagem):\n`);
  sortedCat1.forEach((cat, idx) => {
    console.log(`\n📁 [${idx + 1}] ${cat.name} (${cat.count.toLocaleString('pt-BR')} produtos - ID: ${Array.from(cat.ids).join(', ')})`);
    const sortedSub = Object.values(cat.subcats).sort((a, b) => b.count - a.count);
    sortedSub.forEach((sub, sIdx) => {
      const subPct = ((sub.count / cat.count) * 100).toFixed(1);
      const subIds = Array.from(sub.ids).join(', ') || 'N/A';
      console.log(`   └─ ${sub.name} [ID: ${subIds}] -> ${sub.count.toLocaleString('pt-BR')} produtos (${subPct}%)`);
    });
  });

  return {
    totalProducts,
    cat1Map,
    sortedCat1,
    cat2Map
  };
}

async function run() {
  await analyzeFeed(FEED_URL, 'Shopee Brasil - 2022 (Feed Configurado na Automação)');
}

run().catch(console.error);
