const N8N_HOST = 'http://147.15.43.141:5678';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YmE2NDI0My0wZGQzLTRjOWItOWM0MC1lM2RmZGFlYTY0OTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU3ZDkzNWYtNmI2Ny00YThkLThiOTctN2M1NGY3OTI5NmU3IiwiaWF0IjoxNzg2NTM3MTMxfQ.N9nkjjFahhvHi01aNcJmeHR0LSon2QV_625JNTGhZro';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';
const SUPABASE_URL = 'https://api.147-15-43-141.nip.io';

const workflowPayload = {
  name: 'GSA HUB - Automação Banners Carrossel Home',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'atualizar-banner-carrossel',
        options: {}
      },
      id: 'webhook-trigger-banner',
      name: 'Webhook - Novo Banner',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [250, 300],
      webhookId: 'atualizar-banner-carrossel'
    },
    {
      parameters: {
        method: 'POST',
        url: `${SUPABASE_URL}/rest/v1/gsa_hero_banners`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'apikey', value: SUPABASE_ANON_KEY },
            { name: 'Authorization', value: `Bearer ${SUPABASE_ANON_KEY}` },
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Prefer', value: 'return=representation' }
          ]
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={\n  "title": "{{ $json.body.title || $json.title }}",\n  "subtitle": "{{ $json.body.subtitle || $json.subtitle }}",\n  "image_url": "{{ $json.body.image_url || $json.image_url }}",\n  "link_url": "{{ $json.body.link_url || $json.link_url || \'/marketplace/produtos-assinaturas\' }}",\n  "button_text": "{{ $json.body.button_text || $json.button_text || \'Confira agora\' }}",\n  "display_order": {{ $json.body.display_order || $json.display_order || 1 }},\n  "is_active": true\n}'
      },
      id: 'http-supabase-banner',
      name: 'Publicar no Supabase VPS',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [500, 300]
    }
  ],
  connections: {
    'Webhook - Novo Banner': {
      main: [
        [
          {
            node: 'Publicar no Supabase VPS',
            type: 'main',
            index: 0
          }
        ]
      ]
    }
  },
  settings: {
    executionOrder: 'v1'
  }
};

async function createWorkflow() {
  console.log('🚀 Criando Workflow de Automação de Banners diretamente no N8N da VPS...');

  try {
    const res = await fetch(`${N8N_HOST}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(workflowPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('❌ Erro ao criar workflow no N8N:', data);
      return;
    }

    console.log('✅ Workflow de Banners criado com sucesso no N8N!');
    console.log(`🆔 ID do Workflow: ${data.id}`);
    console.log(`📌 Nome: ${data.name}`);

    // Ativar o workflow
    const activateRes = await fetch(`${N8N_HOST}/api/v1/workflows/${data.id}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    const activateData = await activateRes.json();
    if (activateRes.ok) {
      console.log('⚡ Workflow ATIVADO com sucesso no N8N!');
      console.log(`🔗 Webhook URL de produção: http://147.15.43.141:5678/webhook/atualizar-banner-carrossel`);
    } else {
      console.log('ℹ️ Status da ativação:', activateData);
    }
  } catch (err) {
    console.error('❌ Erro na execução:', err.message);
  }
}

createWorkflow();
