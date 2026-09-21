BEGIN;

-- Recurso único para solicitações de benefícios recusadas.
CREATE TABLE IF NOT EXISTS public.parceiros_resgates_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resgate_id uuid NOT NULL REFERENCES public.parceiros_resgates(id) ON DELETE CASCADE,
  protocolo_recurso text NOT NULL UNIQUE,
  contestacao_cliente text NOT NULL,
  status text NOT NULL DEFAULT 'em_analise'
    CHECK (status IN ('em_analise', 'deferido', 'indeferido')),
  aberto_em timestamptz NOT NULL DEFAULT now(),
  prazo_analise_em timestamptz NOT NULL,
  analisado_em timestamptz,
  motivo_decisao text,
  analisado_por uuid,
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parceiros_resgates_recursos_unico_por_resgate UNIQUE (resgate_id),
  CONSTRAINT parceiros_resgates_recursos_contestacao_check
    CHECK (char_length(trim(contestacao_cliente)) BETWEEN 20 AND 4000),
  CONSTRAINT parceiros_resgates_recursos_decisao_check CHECK (
    (status = 'em_analise' AND analisado_em IS NULL AND motivo_decisao IS NULL)
    OR
    (status = 'deferido' AND analisado_em IS NOT NULL)
    OR
    (status = 'indeferido' AND analisado_em IS NOT NULL AND char_length(trim(COALESCE(motivo_decisao, ''))) BETWEEN 10 AND 2000)
  )
);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_recursos_status_prazo
  ON public.parceiros_resgates_recursos(status, prazo_analise_em);

-- Linha do tempo pública e auditável do protocolo.
CREATE TABLE IF NOT EXISTS public.parceiros_resgates_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resgate_id uuid NOT NULL REFERENCES public.parceiros_resgates(id) ON DELETE CASCADE,
  recurso_id uuid REFERENCES public.parceiros_resgates_recursos(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao_publica text,
  detalhes_privados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator_tipo text NOT NULL DEFAULT 'sistema'
    CHECK (ator_tipo IN ('cliente', 'admin', 'colaborador', 'sistema')),
  ator_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_eventos_timeline
  ON public.parceiros_resgates_eventos(resgate_id, ocorrido_em, id);

-- Registro mínimo e sem dados pessoais usado apenas para disparar o refetch Realtime.
CREATE TABLE IF NOT EXISTS public.parceiros_resgates_public_status (
  resgate_id uuid PRIMARY KEY REFERENCES public.parceiros_resgates(id) ON DELETE CASCADE,
  tracking_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Desafios de confirmação por WhatsApp. Nenhum código é armazenado em texto puro.
CREATE TABLE IF NOT EXISTS public.parceiros_resgates_recurso_desafios (
  id uuid PRIMARY KEY,
  resgate_id uuid NOT NULL REFERENCES public.parceiros_resgates(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_recurso_desafios_active
  ON public.parceiros_resgates_recurso_desafios(resgate_id, expires_at)
  WHERE consumed_at IS NULL;

-- Outbox transacional para WhatsApp: a decisão não depende do navegador aberto.
CREATE TABLE IF NOT EXISTS public.parceiros_resgates_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resgate_id uuid NOT NULL REFERENCES public.parceiros_resgates(id) ON DELETE CASCADE,
  recurso_id uuid REFERENCES public.parceiros_resgates_recursos(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'enviado', 'falhou')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parceiros_resgates_notificacoes_dispatch
  ON public.parceiros_resgates_notificacoes(status, available_at)
  WHERE status IN ('pendente', 'falhou');

ALTER TABLE public.parceiros_resgates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz;

ALTER TABLE public.parceiros_resgates_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_resgates_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_resgates_public_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_resgates_recurso_desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros_resgates_notificacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.parceiros_resgates_recursos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.parceiros_resgates_eventos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.parceiros_resgates_recurso_desafios FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.parceiros_resgates_notificacoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.parceiros_resgates_public_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parceiros_resgates_public_status TO anon, authenticated;

DROP POLICY IF EXISTS parceiros_resgates_public_status_read ON public.parceiros_resgates_public_status;
CREATE POLICY parceiros_resgates_public_status_read
  ON public.parceiros_resgates_public_status FOR SELECT TO anon, authenticated USING (true);

-- Remove o acesso anônimo direto à tabela que contém dados pessoais.
DROP POLICY IF EXISTS parceiros_resgates_all_access ON public.parceiros_resgates;
DROP POLICY IF EXISTS parceiros_resgates_anon_insert ON public.parceiros_resgates;
DROP POLICY IF EXISTS parceiros_resgates_anon_select ON public.parceiros_resgates;
REVOKE ALL ON public.parceiros_resgates FROM anon;

-- Mantém a administração por sessão e as operações internas pelo service role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_resgates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_resgates_recursos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_resgates_eventos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_resgates_recurso_desafios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_resgates_notificacoes TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_touch_partner_redemption_public_status(p_resgate_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.parceiros_resgates_public_status(resgate_id)
  VALUES (p_resgate_id)
  ON CONFLICT (resgate_id) DO UPDATE
    SET revision = public.parceiros_resgates_public_status.revision + 1,
        updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.gsa_touch_partner_redemption_public_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_partner_redemption_touch_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_touch_partner_redemption_public_status(
    COALESCE(NULLIF(to_jsonb(NEW) ->> 'resgate_id', '')::uuid, NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_redemption_touch ON public.parceiros_resgates;
CREATE TRIGGER trg_partner_redemption_touch
AFTER INSERT OR UPDATE ON public.parceiros_resgates
FOR EACH ROW EXECUTE FUNCTION public.gsa_partner_redemption_touch_trigger();

DROP TRIGGER IF EXISTS trg_partner_redemption_event_touch ON public.parceiros_resgates_eventos;
CREATE TRIGGER trg_partner_redemption_event_touch
AFTER INSERT OR UPDATE ON public.parceiros_resgates_eventos
FOR EACH ROW EXECUTE FUNCTION public.gsa_partner_redemption_touch_trigger();

DROP TRIGGER IF EXISTS trg_partner_redemption_appeal_touch ON public.parceiros_resgates_recursos;
CREATE TRIGGER trg_partner_redemption_appeal_touch
AFTER INSERT OR UPDATE ON public.parceiros_resgates_recursos
FOR EACH ROW EXECUTE FUNCTION public.gsa_partner_redemption_touch_trigger();

INSERT INTO public.parceiros_resgates_public_status(resgate_id)
SELECT id FROM public.parceiros_resgates
ON CONFLICT (resgate_id) DO NOTHING;

INSERT INTO public.parceiros_resgates_eventos(
  resgate_id, tipo, titulo, descricao_publica, ator_tipo, idempotency_key, ocorrido_em
)
SELECT
  r.id,
  'solicitacao_criada',
  'Solicitação registrada',
  'A solicitação de benefício foi recebida pelo Grupo GSA.',
  'sistema',
  'legacy-created:' || r.id::text,
  r.created_at
FROM public.parceiros_resgates r
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.parceiros_resgates_eventos(
  resgate_id, tipo, titulo, descricao_publica, detalhes_privados, ator_tipo,
  idempotency_key, ocorrido_em
)
SELECT
  r.id,
  'situacao_importada',
  CASE r.status
    WHEN 'recusado' THEN 'Solicitação recusada'
    WHEN 'concluido' THEN 'Benefício liberado'
    WHEN 'analise' THEN 'Solicitação em análise'
    ELSE 'Solicitação em andamento'
  END,
  CASE r.status
    WHEN 'recusado' THEN COALESCE(NULLIF(trim(r.motivo_recusa), ''), 'A solicitação não foi aprovada.')
    WHEN 'concluido' THEN 'O benefício foi liberado.'
    WHEN 'analise' THEN 'A solicitação está em análise.'
    ELSE 'A solicitação está em andamento.'
  END,
  jsonb_build_object('legacy_backfill', true, 'status', r.status),
  'sistema',
  'legacy-status:' || r.id::text || ':' || r.status,
  COALESCE(r.data_ativacao, r.recusado_em, r.updated_at, r.created_at)
FROM public.parceiros_resgates r
WHERE r.status <> 'pendente'
ON CONFLICT (idempotency_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gsa_begin_partner_appeal_challenge(
  p_codigo text,
  p_challenge_id uuid,
  p_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resgate public.parceiros_resgates%ROWTYPE;
BEGIN
  IF p_challenge_id IS NULL OR char_length(trim(COALESCE(p_code_hash, ''))) < 32 THEN
    RAISE EXCEPTION 'Desafio inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_resgate
  FROM public.parceiros_resgates
  WHERE upper(trim(codigo_gerado)) = upper(trim(COALESCE(p_codigo, '')))
  FOR UPDATE;

  IF NOT FOUND OR v_resgate.status <> 'recusado' THEN
    RETURN jsonb_build_object('success', false, 'eligible', false);
  END IF;

  IF EXISTS (SELECT 1 FROM public.parceiros_resgates_recursos WHERE resgate_id = v_resgate.id) THEN
    RETURN jsonb_build_object('success', false, 'eligible', false, 'already_used', true);
  END IF;

  DELETE FROM public.parceiros_resgates_recurso_desafios
  WHERE resgate_id = v_resgate.id AND consumed_at IS NULL;

  INSERT INTO public.parceiros_resgates_recurso_desafios(
    id, resgate_id, code_hash, expires_at
  ) VALUES (
    p_challenge_id, v_resgate.id, trim(p_code_hash), now() + interval '10 minutes'
  );

  RETURN jsonb_build_object(
    'success', true,
    'eligible', true,
    'resgate_id', v_resgate.id,
    'telefone', v_resgate.telefone,
    'nome_completo', v_resgate.nome_completo,
    'expires_in', 600
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_begin_partner_appeal_challenge(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_begin_partner_appeal_challenge(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_complete_partner_appeal(
  p_challenge_id uuid,
  p_code_hash text,
  p_contestacao text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_challenge public.parceiros_resgates_recurso_desafios%ROWTYPE;
  v_resgate public.parceiros_resgates%ROWTYPE;
  v_recurso public.parceiros_resgates_recursos%ROWTYPE;
  v_contestacao text := trim(COALESCE(p_contestacao, ''));
  v_protocol text;
  v_admin_phone text;
  v_first_name text;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(v_contestacao) NOT BETWEEN 20 AND 4000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  SELECT * INTO v_recurso
  FROM public.parceiros_resgates_recursos
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'appeal', jsonb_build_object(
        'id', v_recurso.id,
        'protocolo_recurso', v_recurso.protocolo_recurso,
        'status', v_recurso.status,
        'aberto_em', v_recurso.aberto_em,
        'prazo_analise_em', v_recurso.prazo_analise_em
      )
    );
  END IF;

  SELECT * INTO v_challenge
  FROM public.parceiros_resgates_recurso_desafios
  WHERE id = p_challenge_id
  FOR UPDATE;

  IF NOT FOUND OR v_challenge.consumed_at IS NOT NULL OR v_challenge.expires_at <= now() OR v_challenge.attempts >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  IF v_challenge.code_hash <> trim(COALESCE(p_code_hash, '')) THEN
    UPDATE public.parceiros_resgates_recurso_desafios
       SET attempts = LEAST(attempts + 1, 5)
     WHERE id = v_challenge.id;
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  SELECT * INTO v_resgate
  FROM public.parceiros_resgates
  WHERE id = v_challenge.resgate_id
  FOR UPDATE;

  IF NOT FOUND OR v_resgate.status <> 'recusado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'appeal_not_allowed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.parceiros_resgates_recursos WHERE resgate_id = v_resgate.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'appeal_already_used');
  END IF;

  v_protocol := 'REC-' || to_char(clock_timestamp(), 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.parceiros_resgates_recursos(
    resgate_id, protocolo_recurso, contestacao_cliente, status,
    aberto_em, prazo_analise_em, idempotency_key
  ) VALUES (
    v_resgate.id, v_protocol, v_contestacao, 'em_analise',
    now(), now() + interval '5 days', p_idempotency_key
  ) RETURNING * INTO v_recurso;

  UPDATE public.parceiros_resgates_recurso_desafios
     SET consumed_at = now()
   WHERE id = v_challenge.id;

  INSERT INTO public.parceiros_resgates_eventos(
    resgate_id, recurso_id, tipo, titulo, descricao_publica, ator_tipo,
    idempotency_key, ocorrido_em
  ) VALUES (
    v_resgate.id, v_recurso.id, 'recurso_interposto', 'Recurso apresentado',
    'O recurso foi recebido e será analisado em até cinco dias.', 'cliente',
    'appeal-opened:' || v_recurso.id::text, v_recurso.aberto_em
  );

  v_first_name := split_part(trim(v_resgate.nome_completo), ' ', 1);
  INSERT INTO public.parceiros_resgates_notificacoes(
    resgate_id, recurso_id, tipo, telefone, mensagem, idempotency_key
  ) VALUES (
    v_resgate.id,
    v_recurso.id,
    'recurso_recebido_cliente',
    v_resgate.telefone,
    'Olá, *' || COALESCE(NULLIF(v_first_name, ''), 'Cliente') || '*.' || E'\n\n' ||
    'Seu recurso foi recebido e será analisado em até *5 dias*.' || E'\n\n' ||
    'Protocolo da solicitação: *' || v_resgate.codigo_gerado || '*' || E'\n' ||
    'Protocolo do recurso: *' || v_recurso.protocolo_recurso || '*',
    'appeal-opened-client:' || v_recurso.id::text
  );

  SELECT value INTO v_admin_phone
  FROM public.system_settings
  WHERE key = 'whatsapp_admin_notificacoes'
  LIMIT 1;

  IF NULLIF(regexp_replace(COALESCE(v_admin_phone, ''), '\D', '', 'g'), '') IS NOT NULL THEN
    INSERT INTO public.parceiros_resgates_notificacoes(
      resgate_id, recurso_id, tipo, telefone, mensagem, idempotency_key
    ) VALUES (
      v_resgate.id,
      v_recurso.id,
      'recurso_aberto_admin',
      v_admin_phone,
      'Novo recurso de solicitação recebido.' || E'\n\n' ||
      'Protocolo: *' || v_resgate.codigo_gerado || '*' || E'\n' ||
      'Recurso: *' || v_recurso.protocolo_recurso || '*' || E'\n' ||
      'Prazo: *' || to_char(v_recurso.prazo_analise_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '*',
      'appeal-opened-admin:' || v_recurso.id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'appeal', jsonb_build_object(
      'id', v_recurso.id,
      'protocolo_recurso', v_recurso.protocolo_recurso,
      'status', v_recurso.status,
      'aberto_em', v_recurso.aberto_em,
      'prazo_analise_em', v_recurso.prazo_analise_em
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'appeal_already_used');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_complete_partner_appeal(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_complete_partner_appeal(uuid, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_decide_partner_appeal(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_recurso_id uuid DEFAULT NULL,
  p_decisao text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_recurso public.parceiros_resgates_recursos%ROWTYPE;
  v_resgate public.parceiros_resgates%ROWTYPE;
  v_decisao text := lower(trim(COALESCE(p_decisao, '')));
  v_motivo text := nullif(trim(COALESCE(p_motivo, '')), '');
  v_actor_id uuid;
  v_first_name text;
BEGIN
  v_context := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');

  IF v_decisao NOT IN ('deferido', 'indeferido') THEN
    RAISE EXCEPTION 'Decisão inválida.' USING ERRCODE = '22023';
  END IF;
  IF v_decisao = 'indeferido' AND char_length(COALESCE(v_motivo, '')) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa do recurso.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_recurso
  FROM public.parceiros_resgates_recursos
  WHERE id = p_recurso_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurso não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_recurso.status <> 'em_analise' THEN
    RAISE EXCEPTION 'Este recurso já foi analisado.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_resgate
  FROM public.parceiros_resgates
  WHERE id = v_recurso.resgate_id
  FOR UPDATE;

  BEGIN
    v_actor_id := NULLIF(COALESCE(v_context ->> 'ator_id', v_context ->> 'usuario_id', v_context ->> 'colaborador_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_actor_id := NULL;
  END;

  UPDATE public.parceiros_resgates_recursos
     SET status = v_decisao,
         motivo_decisao = v_motivo,
         analisado_em = now(),
         analisado_por = v_actor_id,
         updated_at = now()
   WHERE id = v_recurso.id
  RETURNING * INTO v_recurso;

  IF v_decisao = 'deferido' THEN
    UPDATE public.parceiros_resgates
       SET status = 'pendente',
           alerta_duplicidade = false,
           updated_at = now()
     WHERE id = v_resgate.id;

    INSERT INTO public.parceiros_resgates_eventos(
      resgate_id, recurso_id, tipo, titulo, descricao_publica, detalhes_privados,
      ator_tipo, ator_id, idempotency_key
    ) VALUES (
      v_resgate.id, v_recurso.id, 'recurso_deferido', 'Recurso aprovado',
      'O recurso foi aprovado e a solicitação voltou ao fluxo de andamento.',
      jsonb_build_object('motivo_decisao', v_motivo),
      CASE WHEN COALESCE(v_context ->> 'ator_tipo', '') = 'colaborador' THEN 'colaborador' ELSE 'admin' END,
      v_actor_id, 'appeal-approved:' || v_recurso.id::text
    );
  ELSE
    UPDATE public.parceiros_resgates
       SET updated_at = now()
     WHERE id = v_resgate.id;

    INSERT INTO public.parceiros_resgates_eventos(
      resgate_id, recurso_id, tipo, titulo, descricao_publica, detalhes_privados,
      ator_tipo, ator_id, idempotency_key
    ) VALUES (
      v_resgate.id, v_recurso.id, 'recurso_indeferido', 'Recurso recusado',
      v_motivo,
      jsonb_build_object('motivo_decisao', v_motivo),
      CASE WHEN COALESCE(v_context ->> 'ator_tipo', '') = 'colaborador' THEN 'colaborador' ELSE 'admin' END,
      v_actor_id, 'appeal-denied:' || v_recurso.id::text
    );
  END IF;

  v_first_name := split_part(trim(v_resgate.nome_completo), ' ', 1);
  INSERT INTO public.parceiros_resgates_notificacoes(
    resgate_id, recurso_id, tipo, telefone, mensagem, idempotency_key
  ) VALUES (
    v_resgate.id,
    v_recurso.id,
    CASE WHEN v_decisao = 'deferido' THEN 'recurso_aprovado_cliente' ELSE 'recurso_recusado_cliente' END,
    v_resgate.telefone,
    CASE WHEN v_decisao = 'deferido' THEN
      'Olá, *' || COALESCE(NULLIF(v_first_name, ''), 'Cliente') || '*.' || E'\n\n' ||
      'Seu recurso foi *aprovado*. A solicitação voltou ao fluxo de andamento.' || E'\n\n' ||
      'Protocolo: *' || v_resgate.codigo_gerado || '*'
    ELSE
      'Olá, *' || COALESCE(NULLIF(v_first_name, ''), 'Cliente') || '*.' || E'\n\n' ||
      'Seu recurso foi analisado e não pôde ser aprovado.' || E'\n\n' ||
      '*Motivo:* ' || v_motivo || E'\n\n' ||
      'Protocolo: *' || v_resgate.codigo_gerado || '*'
    END,
    'appeal-decision-client:' || v_recurso.id::text
  );

  PERFORM public.gsa_admin_write_audit(
    'parceiros',
    CASE WHEN v_decisao = 'deferido' THEN 'APROVAR_RECURSO_RESGATE' ELSE 'RECUSAR_RECURSO_RESGATE' END,
    'parceiros_resgates_recursos',
    v_recurso.id,
    jsonb_build_object(
      'resgate_id', v_resgate.id,
      'protocolo', v_resgate.codigo_gerado,
      'decisao', v_decisao,
      'motivo', v_motivo
    )
  );

  RETURN jsonb_build_object('success', true, 'appeal', to_jsonb(v_recurso));
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_decide_partner_appeal(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_partner_appeal(uuid, text, uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_schedule_partner_appeal_sla_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_phone text;
  v_inserted integer := 0;
BEGIN
  SELECT value INTO v_admin_phone
  FROM public.system_settings
  WHERE key = 'whatsapp_admin_notificacoes'
  LIMIT 1;

  IF NULLIF(regexp_replace(COALESCE(v_admin_phone, ''), '\D', '', 'g'), '') IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.parceiros_resgates_notificacoes(
    resgate_id, recurso_id, tipo, telefone, mensagem, idempotency_key
  )
  SELECT
    a.resgate_id,
    a.id,
    CASE WHEN a.prazo_analise_em <= now() THEN 'recurso_sla_vencido_admin' ELSE 'recurso_sla_24h_admin' END,
    v_admin_phone,
    CASE WHEN a.prazo_analise_em <= now() THEN
      'Atenção: o prazo de análise do recurso *' || a.protocolo_recurso || '* venceu. Acesse o painel para registrar a decisão.'
    ELSE
      'Lembrete: falta menos de 24 horas para analisar o recurso *' || a.protocolo_recurso || '*.'
    END,
    CASE WHEN a.prazo_analise_em <= now() THEN 'appeal-sla-overdue:' ELSE 'appeal-sla-24h:' END || a.id::text
  FROM public.parceiros_resgates_recursos a
  WHERE a.status = 'em_analise'
    AND a.prazo_analise_em <= now() + interval '24 hours'
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_schedule_partner_appeal_sla_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_schedule_partner_appeal_sla_notifications() TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_claim_partner_appeal_notifications(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM public.gsa_schedule_partner_appeal_sla_notifications();

  WITH candidates AS (
    SELECT id
    FROM public.parceiros_resgates_notificacoes
    WHERE (
      status IN ('pendente', 'falhou')
      OR (status = 'processando' AND claimed_at < now() - interval '5 minutes')
    )
      AND available_at <= now()
      AND attempts < 6
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  ), claimed AS (
    UPDATE public.parceiros_resgates_notificacoes n
       SET status = 'processando',
           attempts = n.attempts + 1,
           claimed_at = now(),
           updated_at = now()
      FROM candidates c
     WHERE n.id = c.id
    RETURNING n.id, n.telefone, n.mensagem, n.tipo, n.attempts
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb)
    INTO v_rows
    FROM claimed;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_claim_partner_appeal_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_claim_partner_appeal_notifications(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_finish_partner_appeal_notification(
  p_notification_id uuid,
  p_success boolean,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.parceiros_resgates_notificacoes
     SET status = CASE WHEN p_success THEN 'enviado' WHEN attempts >= 6 THEN 'falhou' ELSE 'falhou' END,
         sent_at = CASE WHEN p_success THEN now() ELSE sent_at END,
         provider_message_id = CASE WHEN p_success THEN nullif(trim(COALESCE(p_provider_message_id, '')), '') ELSE provider_message_id END,
         last_error = CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_error, 'Falha não informada'), 1000) END,
         available_at = CASE WHEN p_success THEN available_at ELSE now() + make_interval(mins => LEAST(60, attempts * attempts)) END,
         updated_at = now()
   WHERE id = p_notification_id AND status = 'processando';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_finish_partner_appeal_notification(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_finish_partner_appeal_notification(uuid, boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_partner_redemption_status(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resgate_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_resgate public.parceiros_resgates%ROWTYPE;
  v_status text := lower(trim(COALESCE(p_status, '')));
  v_motivo text := nullif(trim(COALESCE(p_motivo, '')), '');
  v_actor_id uuid;
  v_first_name text;
BEGIN
  v_context := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');

  IF v_status NOT IN ('pendente', 'analise', 'recusado') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'recusado' AND char_length(COALESCE(v_motivo, '')) NOT BETWEEN 5 AND 2000 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_resgate
  FROM public.parceiros_resgates
  WHERE id = p_resgate_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.parceiros_resgates_recursos
    WHERE resgate_id = v_resgate.id AND status = 'em_analise'
  ) THEN
    RAISE EXCEPTION 'Existe um recurso em análise para esta solicitação.' USING ERRCODE = '23505';
  END IF;

  BEGIN
    v_actor_id := NULLIF(COALESCE(v_context ->> 'ator_id', v_context ->> 'usuario_id', v_context ->> 'colaborador_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_actor_id := NULL;
  END;

  UPDATE public.parceiros_resgates
     SET status = v_status,
         motivo_recusa = CASE WHEN v_status = 'recusado' THEN v_motivo ELSE motivo_recusa END,
         recusado_em = CASE WHEN v_status = 'recusado' THEN now() ELSE recusado_em END,
         alerta_duplicidade = CASE WHEN v_status = 'pendente' THEN false ELSE alerta_duplicidade END,
         updated_at = now()
   WHERE id = v_resgate.id
  RETURNING * INTO v_resgate;

  INSERT INTO public.parceiros_resgates_eventos(
    resgate_id, tipo, titulo, descricao_publica, detalhes_privados,
    ator_tipo, ator_id, idempotency_key
  ) VALUES (
    v_resgate.id,
    CASE v_status WHEN 'recusado' THEN 'solicitacao_recusada' WHEN 'analise' THEN 'solicitacao_em_analise' ELSE 'solicitacao_aprovada' END,
    CASE v_status WHEN 'recusado' THEN 'Solicitação recusada' WHEN 'analise' THEN 'Solicitação em análise' ELSE 'Solicitação aprovada' END,
    CASE v_status WHEN 'recusado' THEN v_motivo WHEN 'analise' THEN 'A solicitação está em análise.' ELSE 'A solicitação seguirá para emissão do benefício.' END,
    jsonb_build_object('status', v_status, 'motivo', v_motivo),
    CASE WHEN COALESCE(v_context ->> 'ator_tipo', '') = 'colaborador' THEN 'colaborador' ELSE 'admin' END,
    v_actor_id,
    'status:' || v_resgate.id::text || ':' || v_status || ':' || extract(epoch from clock_timestamp())::text
  );

  IF v_status = 'recusado' THEN
    v_first_name := split_part(trim(v_resgate.nome_completo), ' ', 1);
    INSERT INTO public.parceiros_resgates_notificacoes(
      resgate_id, tipo, telefone, mensagem, idempotency_key
    ) VALUES (
      v_resgate.id,
      'solicitacao_recusada_cliente',
      v_resgate.telefone,
      'Olá, *' || COALESCE(NULLIF(v_first_name, ''), 'Cliente') || '*.' || E'\n\n' ||
      'Sua solicitação de benefício não pôde ser aprovada.' || E'\n\n' ||
      '*Motivo:* ' || v_motivo || E'\n\n' ||
      'Você poderá apresentar um único recurso pela consulta do protocolo *' || v_resgate.codigo_gerado || '*.',
      'redemption-rejected:' || v_resgate.id::text || ':' || extract(epoch from clock_timestamp())::text
    );
  END IF;

  PERFORM public.gsa_admin_write_audit(
    'parceiros', 'ALTERAR_STATUS_RESGATE', 'parceiros_resgates', v_resgate.id,
    jsonb_build_object('status', v_status, 'motivo', v_motivo)
  );

  RETURN jsonb_build_object('success', true, 'redemption', to_jsonb(v_resgate));
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_set_partner_redemption_status(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_partner_redemption_status(uuid, text, uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_public_consultar_protocolo(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resgate public.parceiros_resgates%ROWTYPE;
  v_parceiro public.parceiros%ROWTYPE;
  v_recurso public.parceiros_resgates_recursos%ROWTYPE;
  v_tracking_key uuid;
  v_eventos jsonb;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código de protocolo inválido.');
  END IF;

  SELECT * INTO v_resgate
  FROM public.parceiros_resgates
  WHERE upper(trim(codigo_gerado)) = upper(trim(p_codigo))
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Protocolo não encontrado. Verifique o código e tente novamente.');
  END IF;

  SELECT * INTO v_parceiro FROM public.parceiros WHERE id = v_resgate.parceiro_id LIMIT 1;
  SELECT * INTO v_recurso FROM public.parceiros_resgates_recursos WHERE resgate_id = v_resgate.id LIMIT 1;
  SELECT tracking_key INTO v_tracking_key FROM public.parceiros_resgates_public_status WHERE resgate_id = v_resgate.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'tipo', e.tipo,
    'titulo', e.titulo,
    'descricao', e.descricao_publica,
    'ocorrido_em', e.ocorrido_em
  ) ORDER BY e.ocorrido_em, e.id), '[]'::jsonb)
  INTO v_eventos
  FROM public.parceiros_resgates_eventos e
  WHERE e.resgate_id = v_resgate.id;

  RETURN jsonb_build_object(
    'success', true,
    'codigo', v_resgate.codigo_gerado,
    'tracking_key', v_tracking_key,
    'status', v_resgate.status,
    'parceiro_nome', COALESCE(v_parceiro.name, 'Parceiro GSA'),
    'parceiro_slug', COALESCE(v_parceiro.slug, ''),
    'parceiro_logo', v_parceiro.logo_url,
    'nome_completo', v_resgate.nome_completo,
    'telefone', v_resgate.telefone,
    'email', v_resgate.email,
    'tipo_resgate', v_resgate.tipo_resgate,
    'link_ativacao', v_resgate.link_ativacao,
    'cupom', v_resgate.cupom,
    'voucher', v_resgate.voucher,
    'created_at', v_resgate.created_at,
    'data_ativacao', v_resgate.data_ativacao,
    'recusado_em', v_resgate.recusado_em,
    'motivo_recusa', v_resgate.motivo_recusa,
    'recurso', CASE WHEN v_recurso.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_recurso.id,
      'protocolo_recurso', v_recurso.protocolo_recurso,
      'contestacao_cliente', v_recurso.contestacao_cliente,
      'status', v_recurso.status,
      'aberto_em', v_recurso.aberto_em,
      'prazo_analise_em', v_recurso.prazo_analise_em,
      'analisado_em', v_recurso.analisado_em,
      'motivo_decisao', v_recurso.motivo_decisao
    ) END,
    'eventos', v_eventos
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', 'Erro interno ao consultar protocolo. Tente novamente.');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_consultar_protocolo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_consultar_protocolo(text) TO anon, authenticated, service_role;

-- Recria a listagem administrativa incluindo recurso e motivo de recusa.
CREATE OR REPLACE FUNCTION public.gsa_admin_list_partner_redemptions(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_partner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_redemptions jsonb;
BEGIN
  PERFORM public.gsa_admin_assert_module('parceiros');

  SELECT COALESCE(jsonb_agg(
    to_jsonb(r)
    || jsonb_build_object(
      'email', COALESCE(NULLIF(r.email, ''), c.email),
      'telefone', COALESCE(NULLIF(r.telefone, ''), c.telefone),
      'cpf', c.cpf,
      'endereco', c.endereco,
      'cidade', c.cidade,
      'estado', c.estado,
      'cep', c.cep,
      'parceiro_name', p.name,
      'parceiro_slug', p.slug,
      'parceiro_benefits', p.benefits,
      'parceiro_logo', p.logo_url,
      'recurso', CASE WHEN a.id IS NULL THEN NULL ELSE to_jsonb(a) END
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_redemptions
  FROM public.parceiros_resgates r
  JOIN public.parceiros p ON p.id = r.parceiro_id
  LEFT JOIN public.parceiros_resgates_recursos a ON a.resgate_id = r.id
  LEFT JOIN public.clientes c ON c.id = r.cliente_id
  WHERE p_partner_id IS NULL OR r.parceiro_id = p_partner_id;

  RETURN jsonb_build_object('redemptions', v_redemptions);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_list_partner_redemptions(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_partner_redemptions(uuid, text, uuid) TO authenticated, service_role;

-- Liberação continua no fluxo existente, agora com timeline transacional.
CREATE OR REPLACE FUNCTION public.gsa_admin_complete_partner_redemption(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resgate_id uuid DEFAULT NULL,
  p_link_ativacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_clean_link text := trim(COALESCE(p_link_ativacao, ''));
  v_resgate public.parceiros_resgates%ROWTYPE;
BEGIN
  v_context := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('parceiros');
  IF p_resgate_id IS NULL OR v_clean_link = '' THEN
    RAISE EXCEPTION 'Informe o resgate e o link de ativação.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.parceiros_resgates
     SET link_ativacao = v_clean_link,
         status = 'concluido',
         data_ativacao = now(),
         updated_at = now()
   WHERE id = p_resgate_id AND status <> 'recusado'
  RETURNING * INTO v_resgate;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado ou recusado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.parceiros_resgates_eventos(
    resgate_id, tipo, titulo, descricao_publica, ator_tipo, idempotency_key
  ) VALUES (
    v_resgate.id, 'beneficio_liberado', 'Benefício liberado',
    'O benefício foi liberado e já está disponível para ativação.',
    CASE WHEN COALESCE(v_context ->> 'ator_tipo', '') = 'colaborador' THEN 'colaborador' ELSE 'admin' END,
    'completed:' || v_resgate.id::text || ':' || extract(epoch from clock_timestamp())::text
  );

  PERFORM public.gsa_admin_write_audit(
    'parceiros', 'CONCLUIR_RESGATE', 'parceiros_resgates', v_resgate.id,
    jsonb_build_object('status', 'concluido')
  );

  RETURN jsonb_build_object('success', true, 'resgate', to_jsonb(v_resgate));
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_complete_partner_redemption(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_complete_partner_redemption(uuid, text, uuid, text) TO authenticated, service_role;

-- Publicação Realtime somente da tabela sanitizada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'parceiros_resgates_public_status'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parceiros_resgates_public_status;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
