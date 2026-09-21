import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve('scratch/gsa-tv-editorial');
await fs.mkdir(out, { recursive: true });

const segments = [
  ['Abertura', 'GSA TV', 'Informação, soluções e oportunidades conectadas.', 'Bem-vindo à GSA TV, o canal do ecossistema GSA HUB. Informação, soluções e oportunidades conectadas em uma programação feita para pessoas e empresas.'],
  ['Editorial', 'Muitas necessidades. Uma estrutura para resolver.', 'Tecnologia, serviços, saúde, seguros e comércio em uma experiência integrada.', 'A GSA HUB reúne tecnologia, serviços, saúde, seguros e comércio em uma experiência integrada. A proposta é reduzir caminhos confusos e conectar cada necessidade a uma solução clara, acompanhada e funcional.'],
  ['Tecnologia', 'Sites, sistemas e plataformas digitais', 'Projetos digitais, lojas virtuais, aplicativos, portais, integrações e automações.', 'Na área de tecnologia, a GSA desenvolve sites institucionais, lojas virtuais, aplicativos, portais, integrações, automações e sistemas sob medida. Cada projeto parte da realidade da operação e evolui de acordo com a necessidade do cliente.'],
  ['Serviços', 'Apoio para pessoas, MEIs e empresas', 'Demandas administrativas, empresariais, financeiras e operacionais organizadas.', 'Os serviços e assinaturas GSA apoiam pessoas, microempreendedores e empresas em demandas administrativas, empresariais, financeiras e operacionais. O cliente escolhe seu perfil, conhece o escopo e solicita atendimento pelos canais disponíveis.'],
  ['Saúde e proteção', 'GSA Saúde e GSA Seguros', 'Cotações para saúde e proteção em diferentes fases da vida.', 'A GSA Saúde orienta cotações para soluções individuais, familiares, empresariais e odontológicas. A GSA Seguros direciona solicitações para automóveis, residências, vida e empresas, com clareza desde a escolha da categoria.'],
  ['Comércio conectado', 'GSA Store', 'Produtos, assinaturas e oportunidades dentro do ecossistema GSA.', 'A GSA Store reúne produtos, assinaturas e oportunidades comerciais em uma loja integrada aos demais ambientes da GSA HUB. As ofertas exibidas no portal seguem os dados publicados no marketplace.'],
  ['Marca e presença', 'Identidade e Web Design', 'Nome, identidade, presença digital, site e estrutura de marca conectados.', 'A jornada de Identidade e Web Design conecta nome, identidade, presença digital, site e estrutura de marca. É uma construção completa para transformar estratégia em uma presença reconhecível e consistente.'],
  ['Padrão GSA', 'Entender. Orientar. Executar. Acompanhar.', 'Uma jornada organizada do diagnóstico ao relacionamento contínuo.', 'O padrão GSA segue quatro movimentos: entender a necessidade, orientar o caminho, executar com responsabilidade e acompanhar toda a jornada. A solução muda, mas o compromisso com organização e atendimento responsável permanece.'],
  ['Encerramento', 'Conheça o GSA HUB', 'Encontre o caminho certo dentro do ecossistema.', 'Continue acompanhando a GSA TV e conheça o GSA HUB. Encontre o caminho certo para sua necessidade e descubra as soluções que formam o ecossistema GSA.'],
];

const logo = path.resolve('scratch/gsa-tv-logo-transparent.png').replaceAll('\\', '/');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

for (let i = 0; i < segments.length; i += 1) {
  const [eyebrow, title, subtitle, narration] = segments[i];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;width:1280px;height:720px;overflow:hidden;background:#07111d;color:white;font-family:Arial,Helvetica,sans-serif}
  .frame{position:relative;width:100%;height:100%;padding:76px 86px;background:radial-gradient(circle at 88% 15%,rgba(213,184,107,.20),transparent 28%),linear-gradient(135deg,#07111d,#0c2236 62%,#07111d)}
  .line{position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,transparent,#d5b86b,transparent)}
  .ring{position:absolute;border:1px solid rgba(213,184,107,.18);border-radius:50%;width:480px;height:480px;right:-110px;top:80px}.ring.two{width:280px;height:280px;right:70px;top:210px;border-color:rgba(255,255,255,.09)}
  .brand{display:flex;align-items:center;gap:18px}.brand img{width:88px;height:88px;object-fit:contain}.brand strong{font-size:25px;letter-spacing:.08em}.brand span{display:block;margin-top:5px;color:#d5b86b;font-size:12px;font-weight:800;letter-spacing:.22em}
  .content{position:absolute;left:86px;bottom:100px;width:870px}.eyebrow{font-size:15px;color:#d5b86b;font-weight:900;text-transform:uppercase;letter-spacing:.22em}.eyebrow:before{content:'';display:inline-block;width:48px;height:2px;background:#d5b86b;margin-right:18px;vertical-align:middle}
  h1{font-size:${title.length > 42 ? 52 : 64}px;line-height:1.02;letter-spacing:-.045em;margin:24px 0 20px;max-width:900px}p{font-size:25px;line-height:1.45;color:rgba(255,255,255,.72);max-width:850px;margin:0}
  .live{position:absolute;right:70px;bottom:52px;font-size:12px;font-weight:900;letter-spacing:.18em;color:#d5b86b;border:1px solid rgba(213,184,107,.45);padding:10px 14px}
  </style></head><body><div class="frame"><div class="line"></div><div class="ring"></div><div class="ring two"></div><div class="brand"><img src="file:///${logo}"><div><strong>GSA TV</strong><span>GSA HUB</span></div></div><div class="content"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="live">PROGRAMAÇÃO EDITORIAL</div></div></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(out, `slide-${String(i + 1).padStart(2, '0')}.png`) });
  await fs.writeFile(path.join(out, `voice-${String(i + 1).padStart(2, '0')}.txt`), narration, 'utf8');
}
await browser.close();
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ title: 'GSA HUB — Uma estrutura para resolver', segments: segments.map(([eyebrow, title], i) => ({ index: i + 1, eyebrow, title })) }, null, 2));
console.log(`Pacote editorial criado em ${out}`);
