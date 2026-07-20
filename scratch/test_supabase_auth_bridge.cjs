const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config();

function resolveConnectionString() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const runner = fs.readFileSync('apply_pg_migration.cjs', 'utf8');
  const match = runner.match(/process\.env\.SUPABASE_DB_URL\s*\|\|\s*'([^']+)'/);
  if (!match) throw new Error('Defina SUPABASE_DB_URL para executar o teste.');
  return match[1];
}

async function postRpc(url, key, token, name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = text; }
  if (!response.ok) throw new Error(`${name} HTTP ${response.status}: ${text}`);
  return payload;
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Credenciais públicas do Supabase ausentes.');

  const database = new Client({
    connectionString: resolveConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await database.connect();

  const actorId = crypto.randomUUID();
  let authUserId = null;
  let sessionId = null;
  let sessionToken = null;

  try {
    await database.query('begin');
    await database.query(
      `insert into public.clientes(id, nome, pin_hash)
       values ($1, 'AUDITORIA AUTH BRIDGE', extensions.crypt('7391', extensions.gen_salt('bf', 12)))`,
      [actorId],
    );
    const provisioned = await database.query(
      `select public.gsa_create_session_internal('cliente', $1, 'AUDITORIA AUTH BRIDGE', '{}'::jsonb) as result`,
      [actorId],
    );
    const result = provisioned.rows[0].result;
    authUserId = result.auth.user_id;
    sessionId = result.sessao_id;
    sessionToken = result.session_token;
    await database.query('commit');

    const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: result.auth.email,
        password: result.auth.password,
      }),
    });
    const loginBody = await loginResponse.json();
    if (!loginResponse.ok || !loginBody.access_token) {
      throw new Error(`Supabase Auth rejeitou a identidade técnica: HTTP ${loginResponse.status}`);
    }

    const metadata = loginBody.user?.app_metadata || {};
    const claimsMatch = metadata.gsa_actor_type === 'cliente'
      && metadata.gsa_actor_id === actorId
      && metadata.gsa_session_id === sessionId;
    if (!claimsMatch) throw new Error('Claims GSA ausentes ou divergentes no JWT.');

    const validSession = await postRpc(
      supabaseUrl,
      anonKey,
      loginBody.access_token,
      'gsa_jwt_session_is_valid',
      {},
    );
    if (validSession !== true) throw new Error('JWT autenticado não validou a sessão GSA.');

    const legacyValidation = await postRpc(
      supabaseUrl,
      anonKey,
      loginBody.access_token,
      'gsa_validate_session',
      { p_sessao_id: sessionId, p_session_token: sessionToken },
    );
    if (!Array.isArray(legacyValidation) || legacyValidation[0]?.is_valid !== true) {
      throw new Error('Sessão GSA não foi validada pelo token original.');
    }

    await database.query(
      `update public.sistema_sessoes
          set status = 'encerrado', encerrado_em = now()
        where id = $1`,
      [sessionId],
    );
    const revokedSession = await postRpc(
      supabaseUrl,
      anonKey,
      loginBody.access_token,
      'gsa_jwt_session_is_valid',
      {},
    );
    if (revokedSession !== false) throw new Error('JWT antigo continuou válido após revogação GSA.');

    console.log(JSON.stringify({
      authLogin: true,
      claimsMatch: true,
      activeSessionAccepted: true,
      revokedSessionRejected: true,
      cleanup: 'pending',
    }, null, 2));
  } finally {
    try { await database.query('rollback'); } catch {}
    if (authUserId) {
      await database.query('delete from auth.refresh_tokens where user_id = $1', [authUserId]);
      await database.query('delete from auth.sessions where user_id = $1::uuid', [authUserId]);
      await database.query('delete from auth.identities where user_id = $1::uuid', [authUserId]);
      await database.query('delete from auth.users where id = $1::uuid', [authUserId]);
    }
    await database.query('delete from public.gsa_auth_identities where ator_tipo = $1 and ator_id = $2', ['cliente', actorId]);
    await database.query('delete from public.sistema_sessoes where ator_tipo = $1 and ator_id = $2', ['cliente', actorId]);
    await database.query('delete from public.clientes where id = $1', [actorId]);
    await database.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
