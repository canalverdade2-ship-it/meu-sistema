-- =============================================================================
-- Migration: 20260826233000_db_rpc_integrity_remediation.sql
-- Description: GSA HUB Database & RPC Layer Full Integrity Remediation
-- =============================================================================

BEGIN;

-- 1. TABELAS GSA TV E POLÍTICAS RLS
CREATE TABLE IF NOT EXISTS public.gsa_tv_channels (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'online',
  stream_url text,
  stream_key text,
  quality_profile text NOT NULL DEFAULT '720p30',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_tv_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_channels_public_read" ON public.gsa_tv_channels;
CREATE POLICY "gsa_tv_channels_public_read" ON public.gsa_tv_channels FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "gsa_tv_channels_admin_write" ON public.gsa_tv_channels;
CREATE POLICY "gsa_tv_channels_admin_write" ON public.gsa_tv_channels FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

INSERT INTO public.gsa_tv_channels (id, name, slug, status, stream_url, quality_profile, config)
VALUES ('ch-main', 'Canal Principal GSA TV', 'gsa-tv-main', 'online', 'https://stream.gsa.com.br/hls/live.m3u8', '720p30', '{"fps": 30, "output_resolution": "1280x720", "video_bitrate_kbps": 4000}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gsa_tv_media_items (
  id text PRIMARY KEY,
  channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE SET NULL,
  title text NOT NULL,
  original_filename text,
  duration_s integer NOT NULL DEFAULT 60,
  video_codec text DEFAULT 'h264',
  video_width integer DEFAULT 1280,
  video_height integer DEFAULT 720,
  video_fps integer DEFAULT 30,
  video_bitrate_kbps integer DEFAULT 4000,
  audio_codec text DEFAULT 'aac',
  audio_sample_rate integer DEFAULT 48000,
  audio_channels integer DEFAULT 2,
  audio_bitrate_kbps integer DEFAULT 128,
  state text NOT NULL DEFAULT 'ready',
  rights_ok boolean NOT NULL DEFAULT true,
  rights_expires_at timestamptz,
  drive_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_tv_media_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_media_public_read" ON public.gsa_tv_media_items;
CREATE POLICY "gsa_tv_media_public_read" ON public.gsa_tv_media_items FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "gsa_tv_media_admin_write" ON public.gsa_tv_media_items;
CREATE POLICY "gsa_tv_media_admin_write" ON public.gsa_tv_media_items FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gsa_tv_schedule_slots (
  id text PRIMARY KEY,
  channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  slot_type text NOT NULL DEFAULT 'program',
  title_override text,
  state text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_tv_schedule_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_schedule_public_read" ON public.gsa_tv_schedule_slots;
CREATE POLICY "gsa_tv_schedule_public_read" ON public.gsa_tv_schedule_slots FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "gsa_tv_schedule_admin_write" ON public.gsa_tv_schedule_slots;
CREATE POLICY "gsa_tv_schedule_admin_write" ON public.gsa_tv_schedule_slots FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gsa_tv_playlists (
  id text PRIMARY KEY,
  channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_tv_playlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_playlists_admin_access" ON public.gsa_tv_playlists;
CREATE POLICY "gsa_tv_playlists_admin_access" ON public.gsa_tv_playlists FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gsa_tv_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.gsa_tv_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_incidents_admin_access" ON public.gsa_tv_incidents;
CREATE POLICY "gsa_tv_incidents_admin_access" ON public.gsa_tv_incidents FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gsa_tv_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  actor text NOT NULL DEFAULT 'Administrador',
  action text NOT NULL,
  resource_type text NOT NULL DEFAULT 'general',
  resource_id text,
  ip_address text DEFAULT '127.0.0.1',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_tv_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_audit_log_admin_access" ON public.gsa_tv_audit_log;
CREATE POLICY "gsa_tv_audit_log_admin_access" ON public.gsa_tv_audit_log FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gsa_tv_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress numeric(5,2) DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_tv_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gsa_tv_jobs_admin_access" ON public.gsa_tv_jobs;
CREATE POLICY "gsa_tv_jobs_admin_access" ON public.gsa_tv_jobs FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- 2. COLUNAS DE COMPATIBILIDADE E BACKFILLS
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.tickets SET created_at = COALESCE(data_abertura, now()) WHERE created_at IS NULL;

ALTER TABLE public.loja_reembolsos ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.loja_reembolsos SET created_at = COALESCE(criado_em, now()) WHERE created_at IS NULL;

ALTER TABLE public.indicacoes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.indicacoes SET created_at = COALESCE(data_indicacao, now()) WHERE created_at IS NULL;

ALTER TABLE public.saques ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.saques SET created_at = COALESCE(data_solicitacao, now()) WHERE created_at IS NULL;

-- 3. RPCS RESILIENTES (SOBRECARGAS E PARÂMETROS UNIVERSAIS)

-- 3.1 Ajustar Saldo Cliente (aceita p_motivo ou p_descricao)
CREATE OR REPLACE FUNCTION public.gsa_admin_ajustar_saldo_cliente(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_tipo text DEFAULT 'credito',
  p_valor numeric DEFAULT 0,
  p_descricao text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_desc text := COALESCE(p_motivo, p_descricao, 'Ajuste administrativo');
  v_cliente public.clientes%ROWTYPE;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('crm');
  IF p_cliente_id IS NULL THEN RAISE EXCEPTION 'ID do cliente é obrigatório.'; END IF;
  
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  IF p_tipo = 'credito' THEN
    UPDATE public.clientes SET saldo_carteira = COALESCE(saldo_carteira, 0) + p_valor WHERE id = p_cliente_id;
  ELSE
    UPDATE public.clientes SET saldo_carteira = GREATEST(0, COALESCE(saldo_carteira, 0) - p_valor) WHERE id = p_cliente_id;
  END IF;

  INSERT INTO public.transacoes_carteira (cliente_id, tipo, valor, descricao, status)
  VALUES (p_cliente_id, p_tipo, p_valor, v_desc, 'aprovado');

  RETURN jsonb_build_object('success', true, 'novo_saldo', (SELECT saldo_carteira FROM public.clientes WHERE id = p_cliente_id));
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_ajustar_saldo_cliente(uuid, text, uuid, text, numeric, text, text) FROM PUBLIC, anon;
DROP FUNCTION IF EXISTS public.gsa_admin_ajustar_saldo_cliente(uuid, text, uuid, text, numeric, text);
GRANT EXECUTE ON FUNCTION public.gsa_admin_ajustar_saldo_cliente(uuid, text, uuid, text, numeric, text, text) TO authenticated, service_role;

-- 3.2 Alterar Status Cliente (aceita p_bloqueado / p_motivo ou p_status)
CREATE OR REPLACE FUNCTION public.gsa_admin_alterar_status_cliente(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_bloqueado boolean DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_new_status text := COALESCE(p_status, CASE WHEN p_bloqueado = true THEN 'bloqueado' ELSE 'ativo' END);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('crm');

  UPDATE public.clientes 
     SET status = v_new_status,
         carteira_bloqueada = COALESCE(p_bloqueado, carteira_bloqueada),
         observacoes = CASE WHEN p_motivo IS NOT NULL THEN COALESCE(observacoes || E'\n', '') || 'Bloqueio: ' || p_motivo ELSE observacoes END
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_alterar_status_cliente(uuid, text, uuid, text, boolean, text) FROM PUBLIC, anon;
DROP FUNCTION IF EXISTS public.gsa_admin_alterar_status_cliente(uuid, text, uuid, text);
GRANT EXECUTE ON FUNCTION public.gsa_admin_alterar_status_cliente(uuid, text, uuid, text, boolean, text) TO authenticated, service_role;

-- 3.3 Calculator Pro Product Save (aceita individual ou payload)
CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_product(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_tool_id text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_preco_centavos integer DEFAULT NULL,
  p_duracao_acesso_minutos integer DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tool text := COALESCE(p_tool_id, p_payload->>'tool_id', 'calculadora_padrao');
  v_nome text := COALESCE(p_nome, p_payload->>'nome', 'Ferramenta Pro');
  v_ativo boolean := COALESCE(p_ativo, (p_payload->>'ativo')::boolean, true);
  v_preco integer := COALESCE(p_preco_centavos, (p_payload->>'preco_centavos')::integer, 0);
  v_duracao integer := COALESCE(p_duracao_acesso_minutos, (p_payload->>'duracao_acesso_minutos')::integer, 1440);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  
  INSERT INTO public.calculator_pro_products (tool_id, nome, ativo, preco_centavos, duracao_acesso_minutos, updated_at)
  VALUES (v_tool, v_nome, v_ativo, v_preco, v_duracao, now())
  ON CONFLICT (tool_id) DO UPDATE
  SET nome = EXCLUDED.nome,
      ativo = EXCLUDED.ativo,
      preco_centavos = EXCLUDED.preco_centavos,
      duracao_acesso_minutos = EXCLUDED.duracao_acesso_minutos,
      updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid, text, text, jsonb, text, boolean, integer, integer) TO authenticated, service_role;

-- 3.4 Calculator Pro Voucher Create (aceita p_phone / p_validade_dias)
CREATE OR REPLACE FUNCTION public.gsa_admin_create_calculator_pro_voucher(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_tool_id text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_validade_dias integer DEFAULT 30
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code text;
  v_exp timestamptz := COALESCE(p_expires_at, now() + (COALESCE(p_validade_dias, 30) || ' days')::interval);
  v_obs text := COALESCE(p_observacoes, CASE WHEN p_phone IS NOT NULL THEN 'Gerado para ' || p_phone ELSE 'Gerado via painel' END);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_code := 'VOUCHER-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  INSERT INTO public.calculator_pro_vouchers (codigo, tool_id, expires_at, observacoes, status)
  VALUES (v_code, p_tool_id, v_exp, v_obs, 'ativo');

  RETURN jsonb_build_object('success', true, 'codigo', v_code, 'expires_at', v_exp);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_calculator_pro_voucher(uuid, text, text, timestamptz, text, text, integer) TO authenticated, service_role;

-- 3.5 Gerar Acordo de Cobrança (aceita p_primeiro_vencimento e p_desconto_valor)
CREATE OR REPLACE FUNCTION public.gsa_admin_gerar_acordo_cobranca(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cobranca_id uuid DEFAULT NULL,
  p_parcelas integer DEFAULT 1,
  p_dt_primeiro_venc date DEFAULT NULL,
  p_desconto numeric DEFAULT 0,
  p_tipo_desconto text DEFAULT 'fixo',
  p_observacoes text DEFAULT NULL,
  p_primeiro_vencimento date DEFAULT NULL,
  p_desconto_valor numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_dt date := COALESCE(p_primeiro_vencimento, p_dt_primeiro_venc, current_date + interval '5 days');
  v_desc numeric := COALESCE(p_desconto_valor, p_desconto, 0);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('cobranca');

  UPDATE public.cobrancas
     SET status = 'acordo_firmado',
         valor_desconto = v_desc,
         numero_parcelas = p_parcelas,
         data_acordo = now(),
         observacoes = COALESCE(p_observacoes, observacoes)
   WHERE id = p_cobranca_id;

  RETURN jsonb_build_object('success', true, 'primeiro_vencimento', v_dt);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gerar_acordo_cobranca(uuid, text, uuid, integer, date, numeric, text, text, date, numeric) TO authenticated, service_role;

-- 3.6 Liberar Comissões de Afiliados (aceita array p_affiliate_ids ou único p_afiliado_id)
CREATE OR REPLACE FUNCTION public.gsa_admin_release_affiliate_commissions(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_afiliado_id uuid DEFAULT NULL,
  p_affiliate_ids uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF p_affiliate_ids IS NOT NULL AND array_length(p_affiliate_ids, 1) > 0 THEN
    UPDATE public.afiliado_comissoes
       SET status = 'disponivel', updated_at = now()
     WHERE afiliado_id = ANY(p_affiliate_ids) AND status = 'pendente';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSIF p_afiliado_id IS NOT NULL THEN
    UPDATE public.afiliado_comissoes
       SET status = 'disponivel', updated_at = now()
     WHERE afiliado_id = p_afiliado_id AND status = 'pendente';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true, 'liberadas', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_release_affiliate_commissions(uuid, text, uuid, uuid[]) TO authenticated, service_role;

-- 3.7 Decidir Payout de Afiliado (aceita p_decision ou p_action)
CREATE OR REPLACE FUNCTION public.gsa_admin_decide_affiliate_payout(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_payout_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_decision text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_act text := COALESCE(p_decision, p_action);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  UPDATE public.afiliado_saques
     SET status = CASE WHEN v_act = 'approve' THEN 'pago' ELSE 'rejeitado' END,
         observacoes_admin = p_notes,
         pago_em = CASE WHEN v_act = 'approve' THEN COALESCE(p_paid_at, now()) ELSE NULL END,
         updated_at = now()
   WHERE id = p_payout_id;

  RETURN jsonb_build_object('success', true, 'status', v_act);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid, text, uuid, text, text, timestamptz, text) TO authenticated, service_role;

-- 3.8 gsa_admin_update_affiliate_points_settings
CREATE OR REPLACE FUNCTION public.gsa_admin_update_affiliate_points_settings(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_rate numeric DEFAULT NULL,
  p_minimum integer DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_welcome_active boolean DEFAULT true,
  p_welcome_value numeric DEFAULT 100
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  IF coalesce(p_rate, 0) <= 0 OR p_rate > 100 THEN RAISE EXCEPTION 'Taxa de pontos inválida.'; END IF;
  IF coalesce(p_minimum, 0) < 1 OR p_minimum > 1000000 THEN RAISE EXCEPTION 'Mínimo de pontos inválido.'; END IF;

  INSERT INTO public.system_settings(key, value) VALUES
    ('afiliado_pontos_resgate_taxa', p_rate::text),
    ('afiliado_pontos_minimo_resgate', p_minimum::text),
    ('afiliado_pontos_ativo', coalesce(p_active, true)::text),
    ('afiliado_bonus_boas_vindas_ativo', coalesce(p_welcome_active, true)::text),
    ('afiliado_bonus_boas_vindas_valor', coalesce(p_welcome_value, 100)::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM public.gsa_admin_write_audit('afiliados', 'ATUALIZAR_PONTOS_AFILIADO', 'system_settings', NULL, jsonb_build_object('taxa', p_rate, 'minimo', p_minimum, 'ativo', p_active, 'welcome_ativo', p_welcome_active, 'welcome_valor', p_welcome_value));
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_affiliate_points_settings(uuid, text, numeric, integer, boolean, boolean, numeric) TO anon, authenticated, service_role;

-- 3.9 gsa_admin_protestar_cobranca (aceita p_cartorio ou p_nome_cartorio)
CREATE OR REPLACE FUNCTION public.gsa_admin_protestar_cobranca(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cobranca_id uuid DEFAULT NULL,
  p_data_protesto date DEFAULT NULL,
  p_nome_cartorio text DEFAULT NULL,
  p_cartorio text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cartorio text := COALESCE(p_cartorio, p_nome_cartorio);
  v_dt date := COALESCE(p_data_protesto, current_date);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('cobranca');

  IF p_cobranca_id IS NULL THEN RAISE EXCEPTION 'ID da cobranca é obrigatório.'; END IF;
  IF v_cartorio IS NULL THEN RAISE EXCEPTION 'Nome do cartório é obrigatório.'; END IF;

  UPDATE public.cobrancas
     SET status = 'protestado',
         data_protesto = v_dt,
         nome_cartorio = v_cartorio,
         updated_at = now()
   WHERE id = p_cobranca_id;

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (p_cobranca_id, 'protesto_cartorio', 'Protestado no cartorio: ' || v_cartorio || ' em ' || v_dt::text, 'cartorio');

  RETURN jsonb_build_object('success', true, 'cobranca_id', p_cobranca_id, 'cartorio', v_cartorio);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_protestar_cobranca(uuid, text, uuid, date, text, text) TO anon, authenticated, service_role;

-- 3.10 gsa_admin_registrar_cobranca_historico (aceita p_tipo ou p_tipo_acao)
CREATE OR REPLACE FUNCTION public.gsa_admin_registrar_cobranca_historico(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cobranca_id uuid DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_canal text DEFAULT 'manual',
  p_promessa_pagamento boolean DEFAULT false,
  p_data_promessa date DEFAULT NULL,
  p_valor_envolvido numeric DEFAULT NULL,
  p_atualizar_ultimo_contato boolean DEFAULT false,
  p_tipo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_act_type text := COALESCE(p_tipo, p_tipo_acao, 'contato_telefonico');
  v_desc text := COALESCE(p_descricao, 'Contato com cliente');
  v_historico_id uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('cobranca');

  IF p_cobranca_id IS NULL THEN RAISE EXCEPTION 'ID da cobranca é obrigatório.'; END IF;

  INSERT INTO public.cobranca_historico(
    cobranca_id, tipo_acao, descricao, canal, promessa_pagamento, data_promessa, valor_envolvido
  ) VALUES (
    p_cobranca_id, v_act_type, v_desc, COALESCE(p_canal, 'manual'),
    COALESCE(p_promessa_pagamento, false), p_data_promessa, p_valor_envolvido
  ) RETURNING id INTO v_historico_id;

  IF p_atualizar_ultimo_contato THEN
    UPDATE public.cobrancas SET ultimo_contato = now(), updated_at = now() WHERE id = p_cobranca_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'historico_id', v_historico_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_registrar_cobranca_historico(uuid, text, uuid, text, text, text, boolean, date, numeric, boolean, text) TO anon, authenticated, service_role;

-- 3.11 gsa_admin_cancelar_acordo_cobranca (aceita p_motivo)
CREATE OR REPLACE FUNCTION public.gsa_admin_cancelar_acordo_cobranca(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cobranca_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('cobranca');

  IF p_cobranca_id IS NULL THEN RAISE EXCEPTION 'ID da cobranca é obrigatório.'; END IF;

  UPDATE public.cobrancas
     SET status = 'pendente',
         valor_desconto = 0,
         data_acordo = NULL,
         observacoes = CASE WHEN p_motivo IS NOT NULL THEN COALESCE(observacoes || E'\n', '') || 'Acordo Cancelado: ' || p_motivo ELSE observacoes END,
         updated_at = now()
   WHERE id = p_cobranca_id;

  UPDATE public.cobranca_acordo_parcelas
     SET status = 'cancelado'
   WHERE cobranca_id = p_cobranca_id AND status = 'pendente';

  INSERT INTO public.cobranca_historico(cobranca_id, tipo_acao, descricao, canal)
  VALUES (p_cobranca_id, 'cancelamento_acordo', COALESCE(p_motivo, 'Acordo de cobranca cancelado'), 'sistema');

  RETURN jsonb_build_object('success', true, 'cobranca_id', p_cobranca_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancelar_acordo_cobranca(uuid, text, uuid, text) TO anon, authenticated, service_role;

-- 3.12 gsa_admin_emprestimo_enviar_proposta
CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_enviar_proposta(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_emprestimo_id uuid DEFAULT NULL,
  p_valor_aprovado numeric DEFAULT NULL,
  p_juros_total_percentual numeric DEFAULT NULL,
  p_max_parcelas_liberado integer DEFAULT NULL,
  p_taxa_servico numeric DEFAULT 0,
  p_proposta_mensagem text DEFAULT NULL,
  p_validade_dias integer DEFAULT 7,
  p_taxa_juros numeric DEFAULT NULL,
  p_prazo_meses integer DEFAULT NULL,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_juros numeric := COALESCE(p_taxa_juros, p_juros_total_percentual, 0);
  v_parcelas integer := COALESCE(p_prazo_meses, p_max_parcelas_liberado, 12);
  v_msg text := COALESCE(p_mensagem, p_proposta_mensagem, 'Proposta de crédito aprovada.');
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('emprestimos');

  IF p_emprestimo_id IS NULL THEN RAISE EXCEPTION 'ID do empréstimo é obrigatório.'; END IF;

  UPDATE public.emprestimos
     SET valor_aprovado = COALESCE(p_valor_aprovado, valor_solicitado),
         juros_total_percentual = v_juros,
         max_parcelas_liberado = v_parcelas,
         taxa_servico = COALESCE(p_taxa_servico, 0),
         proposta_mensagem = v_msg,
         proposta_validade = now() + (COALESCE(p_validade_dias, 7) || ' days')::interval,
         status = 'proposta_enviada',
         updated_at = now()
   WHERE id = p_emprestimo_id;

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_enviar_proposta(uuid, text, uuid, numeric, numeric, integer, numeric, text, integer, numeric, integer, text) TO anon, authenticated, service_role;

-- 3.13 gsa_admin_emprestimo_enviar_oferta_quitacao
CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_enviar_oferta_quitacao(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_emprestimo_id uuid DEFAULT NULL,
  p_valor_quitacao_acordo numeric DEFAULT NULL,
  p_valor_oferta numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_val numeric := COALESCE(p_valor_oferta, p_valor_quitacao_acordo, 0);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('emprestimos');

  IF p_emprestimo_id IS NULL THEN RAISE EXCEPTION 'ID do empréstimo é obrigatório.'; END IF;
  IF v_val <= 0 THEN RAISE EXCEPTION 'Valor de quitação inválido.'; END IF;

  UPDATE public.emprestimos
     SET valor_quitacao_acordo = v_val,
         oferta_quitacao_em = now(),
         status = 'oferta_quitacao_enviada',
         updated_at = now()
   WHERE id = p_emprestimo_id;

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'valor_quitacao', v_val);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_enviar_oferta_quitacao(uuid, text, uuid, numeric, numeric) TO anon, authenticated, service_role;

-- 3.14 gsa_admin_adjust_affiliate_balance
CREATE OR REPLACE FUNCTION public.gsa_admin_adjust_affiliate_balance(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_afiliado_id uuid DEFAULT NULL,
  p_tipo text DEFAULT 'comissao',
  p_valor numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_affiliate_id uuid DEFAULT NULL,
  p_delta numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_target_id uuid := COALESCE(p_affiliate_id, p_afiliado_id);
  v_val numeric := COALESCE(p_delta, p_valor, 0);
  v_reason text := COALESCE(p_motivo, 'Ajuste de saldo');
  v_cliente_id uuid;
  v_conv_id uuid;
  v_comm_id uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF v_target_id IS NULL THEN RAISE EXCEPTION 'ID do afiliado é obrigatório.'; END IF;
  IF v_val = 0 THEN RAISE EXCEPTION 'O valor do ajuste deve ser diferente de zero.'; END IF;

  SELECT cliente_id INTO v_cliente_id FROM public.gsa_afiliados WHERE id = v_target_id;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Afiliado não encontrado.'; END IF;

  IF p_tipo = 'pontos' THEN
    UPDATE public.clientes
       SET pontos = greatest(coalesce(pontos, 0) + v_val, 0),
           saldo_pontos = greatest(coalesce(saldo_pontos, 0) + floor(v_val)::integer, 0),
           updated_at = now()
     WHERE id = v_cliente_id;

    INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, tipo, pontos_assinados, metadata)
    VALUES (v_cliente_id, v_target_id, 'ajuste', v_val, jsonb_build_object('descricao', left(trim(v_reason), 500)));
  ELSE
    INSERT INTO public.gsa_afiliado_conversoes(
      afiliado_id, programa_id, comprador_id, origem_tipo, origem_id, evento, valor_bruto, base_elegivel, metadata
    ) VALUES (
      v_target_id, (SELECT id FROM public.gsa_afiliado_programas WHERE ativo LIMIT 1), v_cliente_id,
      'ajuste_manual', gen_random_uuid(), 'ajuste_admin', abs(v_val), abs(v_val), jsonb_build_object('motivo', v_reason)
    ) RETURNING id INTO v_conv_id;

    INSERT INTO public.gsa_afiliado_comissoes(
      conversao_id, afiliado_id, programa_id, percentual_snapshot, base_elegivel_snapshot, valor, status, disponivel_em
    ) VALUES (
      v_conv_id, v_target_id, (SELECT id FROM public.gsa_afiliado_programas WHERE ativo LIMIT 1),
      100, abs(v_val), v_val, 'disponivel', now()
    ) RETURNING id INTO v_comm_id;

    INSERT INTO public.gsa_afiliado_comissao_eventos(
      afiliado_id, comissao_id, tipo, valor_assinado, efetivo_em, metadata
    ) VALUES (
      v_target_id, v_comm_id, 'ajuste', v_val, now(), jsonb_build_object('motivo', v_reason)
    );
  END IF;

  PERFORM public.gsa_admin_write_audit('afiliados', 'AJUSTE_MANUAL_AFILIADO', 'gsa_afiliados', v_target_id, jsonb_build_object('tipo', p_tipo, 'valor', v_val, 'motivo', v_reason));
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_adjust_affiliate_balance(uuid, text, uuid, text, numeric, text, uuid, numeric) TO anon, authenticated, service_role;

-- 3.15 gsa_admin_adjust_points (aceita p_motivo ou p_descricao)
CREATE OR REPLACE FUNCTION public.gsa_admin_adjust_points(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_pontos integer DEFAULT 0,
  p_descricao text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_desc text := COALESCE(p_motivo, p_descricao, 'Ajuste administrativo de pontos');
  v_result jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('fidelidade');

  IF p_cliente_id IS NULL THEN RAISE EXCEPTION 'ID do cliente é obrigatório.'; END IF;
  IF p_pontos = 0 THEN RAISE EXCEPTION 'Ajuste de pontos deve ser diferente de zero.'; END IF;

  v_result := public.gsa_apply_points_internal(
    p_cliente_id,
    p_pontos,
    trim(v_desc),
    'ajuste_manual',
    NULL,
    true
  );

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'AJUSTE_PONTOS_CLIENTE',
    jsonb_build_object('cliente_id', p_cliente_id, 'pontos', p_pontos, 'motivo', trim(v_desc))::text,
    'admin', p_sessao_id, 'Administrador'
  );

  RETURN jsonb_build_object('success', true, 'novo_saldo', (SELECT pontos FROM public.clientes WHERE id = p_cliente_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_adjust_points(uuid, text, uuid, integer, text, text) TO anon, authenticated, service_role;

-- 3.16 gsa_admin_update_career_application
CREATE OR REPLACE FUNCTION public.gsa_admin_update_career_application(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_application_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL,
  p_interview_at timestamptz DEFAULT NULL,
  p_interview_location text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_public_message text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_notes text := COALESCE(p_notes, p_internal_notes);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('rh');

  IF p_application_id IS NULL THEN RAISE EXCEPTION 'ID da candidatura é obrigatório.'; END IF;

  UPDATE public.candidaturas
     SET status = COALESCE(p_status, status),
         observacoes_internas = COALESCE(v_notes, observacoes_internas),
         mensagem_publica = COALESCE(p_public_message, mensagem_publica),
         data_entrevista = COALESCE(p_interview_at, data_entrevista),
         local_entrevista = COALESCE(p_interview_location, local_entrevista),
         updated_at = now()
   WHERE id = p_application_id;

  RETURN jsonb_build_object('success', true, 'application_id', p_application_id, 'status', p_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_career_application(uuid, text, uuid, text, text, timestamptz, text, text, text) TO anon, authenticated, service_role;

-- 4. RECARREGAR CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';

COMMIT;