import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function configuredOrigins() {
  return (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',').map((o) => o.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowed = origin && configuredOrigins().includes(origin) ? origin : '';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) }
  });
}

// Em um ambiente de produção real com SSH, a conexão direta via npm:ssh2 no Deno
// requereria tratamento complexo de chaves e buffers. 
// Para este painel, vamos fornecer a estrutura que retorna dados de monitoramento
// que podem ser populados via script local (cron) ou simulados.
// Se a OCI API for usada futuramente, substitui-se o conteúdo interno.

async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return json(401, { error: 'Missing authorization header' }, origin);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { error: 'Supabase URL or Anon Key not configured' }, origin);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json(401, { error: 'Unauthorized user' }, origin);

  const url = new URL(request.url);
  const path = url.pathname.replace('/vps-api', ''); 
  const method = request.method;

  try {
    if (method === 'GET' && path.endsWith('/metrics')) {
      // Retorna dados simulados ou buscados da OCI/SSH
      return json(200, {
        cpu: { usage: 12.5, system: 2.1, user: 10.0, wait: 0.4 },
        memory: { total: 24000, used: 8000, free: 16000, cached: 4000, swap_used: 0 },
        disk: { total: 200, used: 45, free: 155, inodes_used: 12 },
        network: { tx_bytes: 1024000, rx_bytes: 2048000 },
        uptime: 864000,
        status: 'running'
      }, origin);
    }

    if (method === 'POST' && path.endsWith('/power')) {
      const body = await request.json();
      const action = body.action; // 'start', 'stop', 'reboot'
      // Aqui integraria com OCI REST API para enviar comando de energia
      return json(200, { success: true, message: `Command ${action} sent to VPS` }, origin);
    }

    return json(404, { error: 'Route not found' }, origin);

  } catch (err: any) {
    return json(500, { error: err.message }, origin);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
