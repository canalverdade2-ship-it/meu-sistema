import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.147-15-43-141.nip.io';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('🧪 Testando inserção na tabela gsa_site_campaigns na VPS...');

  const { data, error } = await supabase
    .from('gsa_site_campaigns')
    .insert([
      {
        internal_name: 'Hero Banner N8N Auto',
        title: 'Oferta Especial N8N Automática',
        subtitle: 'Aproveite os melhores preços em tecnologia',
        category: 'promotion',
        format: 'inline_banner',
        status: 'active',
        priority: 100,
        cta_label: 'Confira agora',
        cta_url: '/marketplace/produtos-assinaturas',
        image_desktop_url: '/images/marketplace/produtos-assinaturas-hero.jpg',
      }
    ])
    .select();

  if (error) {
    console.error('❌ Erro ao inserir na VPS:', error.message);
  } else {
    console.log('✅ Registro inserido com sucesso na VPS:', data);
  }
}

testInsert();
