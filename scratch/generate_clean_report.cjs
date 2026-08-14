const fs = require('fs');

const FEED_URL = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcFMjz35zY_7hscVJ_4QLIFiIR3DQ9hsrLcX6rgIVVFkb';

// Dicionário de tradução para português amigável
const CATEGORY_TRANSLATIONS = {
  'Home & Living': 'Casa e Decoração',
  'Women Clothes': 'Moda Feminina',
  'Beauty': 'Beleza e Cuidados Pessoais',
  'Health': 'Saúde',
  'Spare Parts and Accessories for Vehicles': 'Autopeças e Acessórios para Veículos',
  'Fashion Accessories': 'Acessórios de Moda',
  'Baby & Kids Fashion': 'Moda Infantil e Bebês',
  'Sports & Outdoors': 'Esportes e Lazer',
  'Stationery': 'Papelaria e Escritório',
  'Toys, Kids & Babies': 'Brinquedos, Crianças e Bebês',
  'Mobile & Gadgets': 'Celulares e Dispositivos',
  'Men Clothes': 'Moda Masculina',
  'Home Appliances': 'Eletrodomésticos e Eletroportáteis',
  'Hobbies & Collections': 'Hobbies e Coleções',
  'Pets': 'Pet Shop e Animais',
  'Food & Beverages': 'Alimentos e Bebidas',
  'Women Shoes': 'Calçados Femininos',
  'Men Shoes': 'Calçados Masculinos',
  'Computers & Accessories': 'Informática e Computadores',
  'Books & Magazines': 'Livros e Revistas',
  'Women Bags': 'Bolsas Femininas',
  'Audio': 'Áudio e Fones',
  'Travel & Luggage': 'Malas e Viagem',
  'Watches': 'Relógios',
  'Men Bags': 'Bolsas e Mochilas Masculinas',
  'Gaming & Consoles': 'Games e Consoles',
  'Cameras & Drones': 'Câmeras e Drones',
  'Automobiles': 'Automóveis',
  'Motorcycles': 'Motocicletas'
};

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
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
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

async function run() {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  const rows = parseCSV(text);

  const headers = rows[0].map(h => h.trim());
  const idxCat1 = headers.indexOf('global_category1');
  const idxCat2 = headers.indexOf('global_category2');
  const idxCatId1 = headers.indexOf('global_catid1');
  const idxCatId2 = headers.indexOf('global_catid2');

  const cat1Map = {};
  let totalProducts = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cat1 = (idxCat1 !== -1 && row[idxCat1] ? row[idxCat1].trim() : '') || 'Sem Categoria Principal';
    const cat2 = (idxCat2 !== -1 && row[idxCat2] ? row[idxCat2].trim() : '') || 'Sem Subcategoria';
    const catId1 = idxCatId1 !== -1 && row[idxCatId1] ? row[idxCatId1].trim() : '';
    const catId2 = idxCatId2 !== -1 && row[idxCatId2] ? row[idxCatId2].trim() : '';

    totalProducts++;

    if (!cat1Map[cat1]) {
      cat1Map[cat1] = {
        nameEn: cat1,
        namePt: CATEGORY_TRANSLATIONS[cat1] || cat1,
        id: catId1,
        count: 0,
        subcats: {}
      };
    }
    cat1Map[cat1].count++;
    if (!cat1Map[cat1].id && catId1) cat1Map[cat1].id = catId1;

    if (!cat1Map[cat1].subcats[cat2]) {
      cat1Map[cat1].subcats[cat2] = {
        name: cat2,
        id: catId2,
        count: 0
      };
    }
    cat1Map[cat1].subcats[cat2].count++;
  }

  const sortedCat1 = Object.values(cat1Map).sort((a, b) => b.count - a.count);

  const report = {
    totalProducts,
    totalCategories: sortedCat1.length,
    categories: sortedCat1.map((c, i) => ({
      pos: i + 1,
      nameEn: c.nameEn,
      namePt: c.namePt,
      id: c.id,
      productsCount: c.count,
      percentage: ((c.count / totalProducts) * 100).toFixed(2) + '%',
      subcategoriesCount: Object.keys(c.subcats).length,
      subcategories: Object.values(c.subcats).sort((a, b) => b.count - a.count).map(s => ({
        name: s.name,
        id: s.id,
        count: s.count,
        percentage: ((s.count / c.count) * 100).toFixed(1) + '%'
      }))
    }))
  };

  fs.writeFileSync('scratch/catalog_report.json', JSON.stringify(report, null, 2));
  console.log('✅ Relatório gerado com sucesso em scratch/catalog_report.json!');
}

run().catch(console.error);
