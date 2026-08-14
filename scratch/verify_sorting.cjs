const { createClient } = require('@supabase/supabase-js');
const url = 'https://api.147-15-43-141.nip.io';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';
const supabase = createClient(url, key);

function calculateRating(product) {
  const importedRating = Number(product?.avaliacao_media || product?.rating || 0);
  const importedCount = Number(product?.total_avaliacoes || product?.total_vendas || 0);
  if (importedRating > 0 && importedCount > 0) {
    return { rating: importedRating, totalCount: importedCount };
  }
  const seedStr = product?.id || 'default_seed';
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const stableReviewsCount = Math.abs(hash % 38) + 12;
  const stableRating = 4.8 + ((Math.abs(hash) % 2) * 0.1);
  return { rating: stableRating, totalCount: stableReviewsCount };
}

function getDiscountPercentage(product) {
  if (Number(product.desconto_percentual || 0) > 0) return Number(product.desconto_percentual);
  const val = Number(product.valor || 0);
  const promo = Number(product.valor_promocional || 0);
  if (val > 0 && promo > 0 && promo < val) {
    return Math.round(((val - promo) / val) * 100);
  }
  return 0;
}

async function verify() {
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, nome, valor, valor_promocional, desconto_percentual, created_at, status, visivel_na_loja')
    .eq('status', 'ativo')
    .eq('visivel_na_loja', true)
    .limit(150);

  console.log(`Total de produtos ativos no teste: ${produtos.length}\n`);

  // 1. MAIS VENDIDOS (Maior nota de estrelas e avaliações)
  const maisVendidos = [...produtos].sort((a, b) => {
    const ratA = calculateRating(a);
    const ratB = calculateRating(b);
    if (ratB.rating !== ratA.rating) return ratB.rating - ratA.rating;
    return ratB.totalCount - ratA.totalCount;
  }).slice(0, 4);

  console.log('🏆 1. TOP 4 MAIS VENDIDOS (Classificados por Maior Nota em Estrelas ⭐):');
  console.table(maisVendidos.map(p => {
    const r = calculateRating(p);
    return {
      Nome: p.nome.slice(0, 40) + '...',
      Preco: 'R$ ' + p.valor,
      'Avaliacao (Estrelas)': r.rating.toFixed(1) + ' ⭐',
      'Total Reviews': '(' + r.totalCount + ')'
    };
  }));

  // 2. OFERTAS DO DIA (Maior % de desconto)
  const tiers = [35, 30, 28, 25, 22, 20, 18, 15];
  const ofertas = [...produtos].slice(0, 48).map((p, idx) => {
    const orig = Number(p.valor || 0);
    const pct = p.desconto_percentual || tiers[idx % tiers.length];
    return {
      ...p,
      desconto_percentual: pct,
      valor_promocional: Math.round(orig * (1 - pct / 100) * 100) / 100
    };
  }).sort((a, b) => {
    const discA = getDiscountPercentage(a);
    const discB = getDiscountPercentage(b);
    return discB - discA;
  }).slice(0, 4);

  console.log('\n⚡ 2. TOP 4 OFERTAS DO DIA (Classificados por Maior % de Desconto 🏷️):');
  console.table(ofertas.map(p => ({
    Nome: p.nome.slice(0, 40) + '...',
    'De': 'R$ ' + p.valor,
    'Por': 'R$ ' + p.valor_promocional,
    'Desconto': getDiscountPercentage(p) + '% OFF'
  })));

  // 3. LANÇAMENTOS (Mais recentes cadastrados)
  const lancamentos = [...produtos].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).slice(0, 4);

  console.log('\n✨ 3. TOP 4 LANÇAMENTOS (Classificados por Mais Recente 📅):');
  console.table(lancamentos.map(p => ({
    Nome: p.nome.slice(0, 40) + '...',
    Preco: 'R$ ' + p.valor,
    'Cadastrado em': p.created_at
  })));
}

verify().catch(console.error);
