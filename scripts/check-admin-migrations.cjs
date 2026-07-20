const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { Client } = require('pg');

const root = process.cwd();
const databaseName = 'gsa_admin_migration_test';
const connection = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

const migrations = [
  'supabase/migrations/20260720234500_admin_identity_permissions_hardening.sql',
  'supabase/migrations/20260720235450_enable_admin_extensions.sql',
  'supabase/migrations/20260720235500_admin_secure_operations.sql',
  'supabase/migrations/20260721000500_admin_module_rls_boundaries.sql',
  'supabase/migrations/20260721001500_private_admin_documents.sql',
  'supabase/migrations/20260721002500_secure_admin_settings.sql',
  'supabase/migrations/20260721003000_hash_collaborator_credentials.sql',
];

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_SESSION_ID = '00000000-0000-4000-8000-000000000002';
const LEGACY_COLLABORATOR_ID = '00000000-0000-4000-8000-000000000003';
const LEGACY_SESSION_ID = '00000000-0000-4000-8000-000000000004';
const ADMIN_TOKEN = 'admin-session-token';
const LEGACY_TOKEN = 'legacy-session-token';

function jwt(actorType, actorId, sessionId) {
  return JSON.stringify({
    app_metadata: {
      gsa_actor_type: actorType,
      gsa_actor_id: actorId,
      gsa_session_id: sessionId,
    },
  });
}

async function setJwt(client, actorType, actorId, sessionId) {
  await client.query('SELECT set_config($1, $2, false)', [
    'request.jwt.claims',
    jwt(actorType, actorId, sessionId),
  ]);
}

async function expectDatabaseError(operation, message) {
  let failed = false;
  try {
    await operation();
  } catch (error) {
    failed = true;
  }
  assert.equal(failed, true, message);
}

async function createTestDatabase() {
  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$;`);
    }
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await admin.query(`CREATE DATABASE ${databaseName}`);
  } finally {
    await admin.end();
  }
}

async function dropTestDatabase() {
  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  } finally {
    await admin.end();
  }
}

const scaffold = String.raw`
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE TABLE public.funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  status text NOT NULL DEFAULT 'ativo',
  credencial_acesso text UNIQUE,
  credencial_hash text,
  funcao_id uuid REFERENCES public.funcoes(id),
  modulos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.colaborador_modulos (
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  modulo_id text NOT NULL,
  PRIMARY KEY (colaborador_id, modulo_id)
);

CREATE TABLE public.sistema_sessoes (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'ativo',
  ator_tipo text,
  ator_id uuid,
  ator_nome text,
  session_token text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz
);

CREATE OR REPLACE FUNCTION public.gsa_validate_session(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(is_valid boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id
       AND s.session_token = p_session_token
       AND lower(s.status) IN ('ativo', 'ativa', 'active')
       AND (s.expira_em IS NULL OR s.expira_em > now())
  )
$$;

CREATE TABLE public.solicitacoes_exclusao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  colaborador_id uuid REFERENCES public.colaboradores(id),
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  motivo text,
  status text NOT NULL DEFAULT 'pendente',
  data_decisao timestamptz
);

CREATE TABLE public.sistema_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_tipo text,
  ator_id uuid,
  ator_nome text,
  acao text,
  detalhes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text,
  mensagem text,
  modulo text,
  tab text,
  item_id uuid,
  tipo text,
  prioridade text,
  destinatario_tipo text,
  colaborador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text,
  mensagem text,
  modulo text,
  tab text,
  item_id uuid,
  tipo text,
  prioridade text,
  acao_origem text,
  destinatario_tipo text,
  colaborador_id uuid,
  data_criacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text,
  cnpj text,
  telefone text,
  responsavel text
);

CREATE TABLE public.formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  tipo text,
  instrucoes text,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE public.viagens_orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classificados_anuncios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text,
  status text,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classificados_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid,
  status_moderacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classificados_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classificados_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.saude_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ordens_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_fiscal text,
  status_emissao text,
  observacoes text,
  arquivo_nf_url text,
  arquivo_nf_xml_url text,
  numero_nota text,
  data_emissao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint
);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rpc_moderar_mensagem_classificado(
  p_mensagem_id uuid,
  p_proposta_id uuid,
  p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.classificados_mensagens
     SET status_moderacao = CASE WHEN p_acao = 'approve' THEN 'aprovada' ELSE 'rejeitada' END
   WHERE id = p_mensagem_id;
  RETURN jsonb_build_object('success', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_login_colaborador(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_collaborator public.colaboradores%ROWTYPE;
BEGIN
  SELECT * INTO v_collaborator
    FROM public.colaboradores
   WHERE credencial_acesso = p_code
   LIMIT 1;

  IF NOT FOUND OR lower(COALESCE(v_collaborator.status, 'ativo')) <> 'ativo' THEN
    RETURN jsonb_build_object('valid', false, 'success', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'success', true,
    'session', jsonb_build_object(
      'ator_tipo', 'colaborador',
      'ator_id', v_collaborator.id,
      'ator_nome', v_collaborator.nome
    )
  );
END;
$$;

INSERT INTO public.colaboradores (
  id, nome, status, credencial_acesso, modulos
) VALUES (
  '${LEGACY_COLLABORATOR_ID}', 'Colaborador Legado', 'ativo', '123456', '["viagens"]'::jsonb
);

INSERT INTO public.colaborador_modulos (colaborador_id, modulo_id)
VALUES ('${LEGACY_COLLABORATOR_ID}', 'viagens');

INSERT INTO public.sistema_sessoes (
  id, status, ator_tipo, ator_id, ator_nome, session_token, expira_em
) VALUES
  ('${ADMIN_SESSION_ID}', 'ativo', 'admin', '${ADMIN_ID}', 'Administrador', '${ADMIN_TOKEN}', now() + interval '1 day'),
  ('${LEGACY_SESSION_ID}', 'ativo', 'colaborador', '${LEGACY_COLLABORATOR_ID}', 'Colaborador Legado', '${LEGACY_TOKEN}', now() + interval '1 day');
`;

async function applyMigrations(client) {
  for (const migration of migrations) {
    const sql = await readFile(resolve(root, migration), 'utf8');
    try {
      await client.query(sql);
    } catch (error) {
      error.message = `${migration}: ${error.message}`;
      throw error;
    }
  }
}

async function addTestPolicies(client) {
  await client.query(`
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

    ALTER TABLE public.viagens_orcamentos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS test_permissive_viagens ON public.viagens_orcamentos;
    CREATE POLICY test_permissive_viagens ON public.viagens_orcamentos
      AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

    ALTER TABLE public.classificados_anuncios ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS test_permissive_classificados ON public.classificados_anuncios;
    CREATE POLICY test_permissive_classificados ON public.classificados_anuncios
      AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
  `);
}

async function runAssertions(client) {
  await setJwt(client, 'admin', ADMIN_ID, ADMIN_SESSION_ID);

  const adminContext = await client.query(
    'SELECT public.gsa_admin_get_context_secure($1, $2) AS context',
    [ADMIN_SESSION_ID, ADMIN_TOKEN],
  );
  assert.equal(adminContext.rows[0].context.actor_type, 'admin');
  assert.equal(adminContext.rows[0].context.session_id, ADMIN_SESSION_ID);

  const legacyStored = await client.query(
    `SELECT credencial_acesso, credencial_hash,
            crypt('123456', credencial_hash) = credencial_hash AS hash_matches
       FROM public.colaboradores WHERE id = $1`,
    [LEGACY_COLLABORATOR_ID],
  );
  assert.notEqual(legacyStored.rows[0].credencial_acesso, '123456');
  assert.equal(legacyStored.rows[0].credencial_acesso.length, 6);
  assert.equal(legacyStored.rows[0].hash_matches, true);

  const legacyLogin = await client.query(
    'SELECT public.gsa_login_colaborador($1) AS result',
    ['123456'],
  );
  assert.equal(legacyLogin.rows[0].result.valid, true);

  const internalLogin = await client.query(
    'SELECT public.gsa_login_colaborador($1) AS result',
    [legacyStored.rows[0].credencial_acesso],
  );
  assert.equal(internalLogin.rows[0].result.valid, false);

  const created = await client.query(
    `SELECT public.gsa_admin_save_collaborator(
      $1, $2, NULL, $3::jsonb, $4::text[]
    ) AS result`,
    [
      ADMIN_SESSION_ID,
      ADMIN_TOKEN,
      JSON.stringify({ nome: 'Agente Viagens', email: 'viagens@example.test' }),
      ['viagens'],
    ],
  );
  const createdId = created.rows[0].result.id;
  const createdCredential = created.rows[0].result.initial_credential;
  assert.match(createdCredential, /^[A-F0-9]{24}$/);

  const createdStored = await client.query(
    `SELECT credencial_acesso, credencial_hash,
            crypt($2, credencial_hash) = credencial_hash AS hash_matches
       FROM public.colaboradores WHERE id = $1`,
    [createdId, createdCredential],
  );
  assert.notEqual(createdStored.rows[0].credencial_acesso, createdCredential);
  assert.equal(createdStored.rows[0].hash_matches, true);

  const createdSessionId = '00000000-0000-4000-8000-000000000010';
  const createdToken = 'created-collaborator-token';
  await client.query(
    `INSERT INTO public.sistema_sessoes
      (id, status, ator_tipo, ator_id, ator_nome, session_token, expira_em)
     VALUES ($1, 'ativo', 'colaborador', $2, 'Agente Viagens', $3, now() + interval '1 day')`,
    [createdSessionId, createdId, createdToken],
  );
  await setJwt(client, 'colaborador', createdId, createdSessionId);

  const permissions = await client.query(`
    SELECT
      public.gsa_admin_has_module('viagens') AS viagens,
      public.gsa_admin_has_module('saude') AS saude,
      public.gsa_admin_has_module('classificados') AS classificados,
      public.gsa_admin_has_module('dashboard') AS dashboard
  `);
  assert.equal(permissions.rows[0].viagens, true);
  assert.equal(permissions.rows[0].saude, false);
  assert.equal(permissions.rows[0].classificados, false);
  assert.equal(permissions.rows[0].dashboard, true);

  await client.query("INSERT INTO public.viagens_orcamentos(status) VALUES ('recebido')");
  await client.query("INSERT INTO public.classificados_anuncios(titulo, status) VALUES ('Oculto', 'aguardando_revisao')");

  await client.query('SET ROLE authenticated');
  const visibleTravel = await client.query('SELECT count(*)::integer AS count FROM public.viagens_orcamentos');
  const hiddenClassified = await client.query('SELECT count(*)::integer AS count FROM public.classificados_anuncios');
  await client.query('RESET ROLE');
  assert.equal(visibleTravel.rows[0].count, 1);
  assert.equal(hiddenClassified.rows[0].count, 0);

  const notificationValues = [];
  const notificationParams = [];
  for (let index = 0; index < 120; index += 1) {
    const offset = index * 3;
    notificationValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    notificationParams.push(`Aviso ${index + 1}`, createdId, 'viagens');
  }
  await client.query(
    `INSERT INTO public.admin_notificacoes
      (titulo, colaborador_id, modulo, destinatario_tipo)
     SELECT values_table.titulo, values_table.colaborador_id::uuid, values_table.modulo, 'colaborador'
       FROM (VALUES ${notificationValues.join(',')}) AS values_table(titulo, colaborador_id, modulo)`,
    notificationParams,
  );
  await client.query(
    `INSERT INTO public.admin_notificacoes
      (titulo, modulo, destinatario_tipo)
     VALUES ('Somente administrador', 'acessos', 'admin')`,
  );

  const notifications = await client.query(
    'SELECT public.gsa_admin_list_notifications($1, $2, 500) AS items',
    [createdSessionId, createdToken],
  );
  assert.equal(notifications.rows[0].items.length, 120);
  assert.equal(notifications.rows[0].items.some((item) => item.titulo === 'Somente administrador'), false);

  const marked = await client.query(
    'SELECT public.gsa_admin_mark_all_notifications($1, $2, false) AS result',
    [createdSessionId, createdToken],
  );
  assert.equal(marked.rows[0].result.processed, 120);
  const notificationState = await client.query(
    'SELECT count(*)::integer AS count FROM public.gsa_admin_notification_state WHERE actor_id = $1',
    [createdId],
  );
  assert.equal(notificationState.rows[0].count, 120);

  const ad = await client.query(
    `INSERT INTO public.classificados_anuncios(titulo, status)
     VALUES ('Aprovar', 'aguardando_revisao') RETURNING id`,
  );
  await setJwt(client, 'admin', ADMIN_ID, ADMIN_SESSION_ID);
  await client.query(
    `SELECT public.gsa_admin_classified_action(
      $1, $2, 'anuncio', $3, NULL, 'aprovar', NULL
    )`,
    [ADMIN_SESSION_ID, ADMIN_TOKEN, ad.rows[0].id],
  );
  const approvedAd = await client.query(
    'SELECT status FROM public.classificados_anuncios WHERE id = $1',
    [ad.rows[0].id],
  );
  assert.equal(approvedAd.rows[0].status, 'publicado');

  await client.query(
    `SELECT public.gsa_admin_update_settings_secure(
      $1, $2, $3::jsonb
    )`,
    [ADMIN_SESSION_ID, ADMIN_TOKEN, JSON.stringify([{ key: 'valor_minimo_saque', value: '75' }])],
  );
  const setting = await client.query("SELECT value FROM public.system_settings WHERE key = 'valor_minimo_saque'");
  assert.equal(setting.rows[0].value, '75');

  await expectDatabaseError(
    () => client.query(
      `SELECT public.gsa_admin_update_settings_secure(
        $1, $2, $3::jsonb
      )`,
      [ADMIN_SESSION_ID, ADMIN_TOKEN, JSON.stringify([{ key: 'admin_access_code', value: 'segredo' }])],
    ),
    'A allowlist deve bloquear configurações administrativas desconhecidas.',
  );

  await setJwt(client, 'colaborador', createdId, createdSessionId);
  await client.query("UPDATE public.colaboradores SET status = 'suspenso' WHERE id = $1", [createdId]);
  await expectDatabaseError(
    () => client.query('SELECT public.gsa_admin_context()'),
    'Colaborador suspenso não pode manter contexto administrativo válido.',
  );
}

async function main() {
  await createTestDatabase();
  const client = new Client({ ...connection, database: databaseName });
  await client.connect();
  try {
    await client.query(scaffold);
    await applyMigrations(client);
    await addTestPolicies(client);
    await runAssertions(client);
    console.log('Migrations administrativas: PostgreSQL, sessão, hash, RLS e RPCs validados.');
  } finally {
    await client.end();
    await dropTestDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
