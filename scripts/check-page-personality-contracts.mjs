import fs from 'node:fs';

const files = {
  client: 'src/components/client/ClientDashboard.tsx',
  provider: 'src/pages/Prestador/PrestadorDashboard.tsx',
  supplier: 'src/pages/Fornecedor/FornecedorDashboard.tsx',
  tools: 'src/components/public/FreeToolsPage.tsx',
  store: 'src/components/client/StoreHub.tsx',
  travel: 'src/components/client/marketplace/travel/TravelHubMenu.tsx',
  admin: 'src/components/admin/Dashboard.tsx',
  advertiser: 'src/pages/AdvertiserPortal.tsx',
  classifieds: 'src/components/client/marketplace/ClassifiedsHubPage.tsx',
};

const read = (path) => fs.readFileSync(path, 'utf8');
const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]));
const failures = [];

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(source.client.includes('Central pessoal GSA'), 'Portal Pessoa Física não contém a nova central pessoal.');
expect(!source.client.includes('🎉'), 'Portal Pessoa Física ainda contém celebração genérica com emoji.');
expect(!source.client.includes('animate-gradient-x'), 'Portal Pessoa Física ainda contém gradiente animado genérico.');

expect(source.provider.includes('Central de execução profissional'), 'Portal do Prestador não contém a central de execução.');
expect(source.provider.includes("bg-[#0b2026]"), 'Portal do Prestador não preserva sua identidade operacional escura.');

expect(source.supplier.includes('Central de cadeia de fornecimento'), 'Portal do Fornecedor não contém a cadeia de fornecimento.');
expect(source.supplier.includes('Visão da cadeia de suprimentos'), 'Portal do Fornecedor não contém o fluxo operacional.');

expect(source.tools.includes('Laboratório de utilidades GSA'), 'Ferramentas Gratuitas não contém a identidade de laboratório.');
expect(source.tools.includes('filteredTools'), 'Ferramentas Gratuitas não possui busca e filtro funcionais.');

expect(source.store.includes('Vitrine e relacionamento'), 'GSA Store não contém a nova experiência comercial.');
expect(!source.store.includes('Bem Vindo ao <br/>'), 'GSA Store ainda contém o título genérico anterior.');
expect(!source.store.includes('<MarketplaceSubmoduleCard'), 'GSA Store ainda usa o card compartilhado como arquitetura principal.');

expect(source.travel.includes('Para onde você quer ir?'), 'GSA Viagens não começa pela descoberta de destino.');
expect(!source.travel.includes('MarketplaceSubmoduleCard'), 'GSA Viagens ainda usa o card compartilhado como arquitetura principal.');

expect(source.admin.includes('Central de comando operacional'), 'Dashboard administrativo não contém a central de comando.');
expect(source.admin.includes('Filas operacionais'), 'Dashboard administrativo não apresenta filas operacionais.');

expect(source.advertiser.includes('Campanha em foco'), 'Portal do Anunciante não apresenta campanha em foco.');

expect(source.classifieds.includes('filteredCategories'), 'Classificados não possui busca funcional por categoria.');
expect(!source.classifieds.includes('<MarketplaceSubmoduleCard'), 'Classificados ainda usa o card compartilhado como arquitetura principal.');

if (failures.length) {
  console.error('\nContratos de personalidade reprovados:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Contratos de personalidade aprovados para as 9 áreas auditadas.');
