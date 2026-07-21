import fs from 'node:fs';

const path = 'src/components/client/marketplace/classifieds/ClassifiedDetailPage.tsx';
const content = fs.readFileSync(path, 'utf8');
const before = `                        } else {
                          // TODO: Abrir modal de Proposta
                          alert('Em breve: Enviar proposta moderada via GSA.');
                        }
`;
const after = `                        } else {
                          const supportUrl = new URL(routes.client.support(), window.location.origin);
                          supportUrl.searchParams.set('origem', 'classificado');
                          supportUrl.searchParams.set('anuncio', String(ad.id));
                          supportUrl.searchParams.set('titulo', String(ad.titulo || '').slice(0, 120));
                          navigate(\`${'${supportUrl.pathname}${supportUrl.search}'}\`);
                        }
`;
const count = content.split(before).length - 1;
if (count !== 1) throw new Error(`Bloco de proposta esperado uma vez; encontrado ${count}.`);
let next = content.replace(before, after);
next = next.replace('> Enviar Proposta', '> Solicitar mediação');
next = next.replace(
  'Sua mensagem será analisada pela GSA antes de ser enviada ao vendedor para garantir a sua segurança.',
  'Você será direcionado ao suporte GSA para registrar a proposta com mediação e proteção dos seus dados.',
);
fs.writeFileSync(path, next);
console.log('Mediação dos classificados direcionada ao fluxo operacional de suporte.');
