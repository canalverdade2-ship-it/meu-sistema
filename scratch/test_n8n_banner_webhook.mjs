async function testWebhook() {
  console.log('📡 Testando disparo de banner via Webhook do N8N na VPS...');

  const payload = {
    title: 'Oferta Especial N8N Automática',
    subtitle: 'Publicado via N8N integrado na VPS com sucesso!',
    image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=2000&q=80',
    link_url: '/marketplace/produtos-assinaturas',
    button_text: 'Aproveitar Agora',
    display_order: 1
  };

  try {
    const res = await fetch('http://147.15.43.141:5678/webhook/atualizar-banner-carrossel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('HTTP Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Resposta do Webhook N8N:', text);
  } catch (err) {
    console.error('❌ Erro no teste do Webhook:', err.message);
  }
}

testWebhook();
