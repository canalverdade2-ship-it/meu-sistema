const N8N_HOST = 'http://147.15.43.141:5678';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4YmE2NDI0My0wZGQzLTRjOWItOWM0MC1lM2RmZGFlYTY0OTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU3ZDkzNWYtNmI2Ny00YThkLThiOTctN2M1NGY3OTI5NmU3IiwiaWF0IjoxNzg2NTM3MTMxfQ.N9nkjjFahhvHi01aNcJmeHR0LSon2QV_625JNTGhZro';

async function testN8N() {
  console.log('📡 Conectando à API do N8N na VPS (http://147.15.43.141:5678)...');

  try {
    const response = await fetch(`${N8N_HOST}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Erro na resposta do N8N:', response.status, response.statusText);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = await response.json();
    console.log('✅ Conexão com N8N estabelecida com sucesso!');
    console.log(`📋 Total de Workflows no N8N: ${data.data?.length || 0}`);
    if (data.data && data.data.length > 0) {
      console.log('Workflows existentes:');
      data.data.forEach(wf => console.log(` - ID: ${wf.id} | Nome: ${wf.name} | Ativo: ${wf.active}`));
    }
  } catch (error) {
    console.error('❌ Erro ao conectar no N8N:', error.message);
  }
}

testN8N();
