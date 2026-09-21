BEGIN;

CREATE TABLE IF NOT EXISTS public.clientes_identidades_historicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_origem_id uuid,
  documento text NOT NULL,
  telefone text NOT NULL,
  tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('pf', 'pj')),
  exclusao_definitiva_em timestamptz NOT NULL DEFAULT now(),
  inelegivel_novo_cliente boolean NOT NULL DEFAULT true,
  inelegivel_nova_indicacao boolean NOT NULL DEFAULT true,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clientes_identidades_historicas_documento_uidx
  ON public.clientes_identidades_historicas (documento);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_identidades_historicas_telefone_uidx
  ON public.clientes_identidades_historicas (telefone);
ALTER TABLE public.clientes_identidades_historicas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clientes_identidades_historicas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clientes_identidades_historicas TO service_role;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inativado_pelo_cliente_em timestamptz;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS reativado_em timestamptz;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS exclusao_definitiva_em timestamptz;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inelegivel_novo_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inelegivel_nova_indicacao boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.gsa_client_deactivate_account(
  p_sessao_id uuid, p_session_token text, p_reason text, p_permanent boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_session record;
  v_client public.clientes%rowtype;
  v_doc text;
BEGIN
  SELECT * INTO v_session FROM public.gsa_validate_session(p_sessao_id, p_session_token) LIMIT 1;
  IF NOT coalesce(v_session.is_valid, false) OR v_session.ator_tipo <> 'cliente' THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;

  SELECT * INTO v_client FROM public.clientes WHERE id = v_session.ator_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;
  v_doc := regexp_replace(coalesce(v_client.cpf, v_client.cnpj, ''), '\D', '', 'g');

  IF p_permanent THEN
    INSERT INTO public.clientes_identidades_historicas(
      cliente_origem_id, documento, telefone, tipo_pessoa, motivo
    ) VALUES (
      v_client.id, v_doc, regexp_replace(coalesce(v_client.telefone, ''), '\D', '', 'g'),
      coalesce(v_client.tipo_pessoa, CASE WHEN length(v_doc) = 14 THEN 'pj' ELSE 'pf' END), trim(p_reason)
    ) ON CONFLICT (documento) DO UPDATE SET
      telefone = excluded.telefone,
      exclusao_definitiva_em = now(),
      motivo = excluded.motivo,
      inelegivel_novo_cliente = true,
      inelegivel_nova_indicacao = true;

    UPDATE public.clientes SET
      nome = 'Conta excluida ' || right(id::text, 8),
      email = 'excluido+' || id::text || '@invalid.local',
      cpf = NULL, cnpj = NULL, telefone = NULL,
      cep = NULL, endereco = NULL, numero = NULL, bairro = NULL, cidade = NULL, estado = NULL,
      observacoes = NULL, pin_hash = NULL, pin_tentativas = 0, pin_bloqueado = false,
      status = 'inativo', cadastro_aprovado = false,
      carteira_bloqueada = true, pontos_bloqueados = true,
      exclusao_definitiva_em = now(), inelegivel_novo_cliente = true,
      inelegivel_nova_indicacao = true, updated_at = now()
    WHERE id = v_client.id;
  ELSE
    UPDATE public.clientes SET
      status = 'inativo', cadastro_aprovado = true,
      inativado_pelo_cliente_em = now(), updated_at = now()
    WHERE id = v_client.id;
  END IF;

  UPDATE public.sistema_sessoes SET status = 'encerrado', encerrado_em = now()
   WHERE ator_tipo = 'cliente' AND ator_id = v_client.id AND status = 'ativo';

  RETURN jsonb_build_object('success', true, 'permanent', p_permanent);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_deactivate_account(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_deactivate_account(uuid, text, text, boolean) TO authenticated, service_role;

-- A reativacao acontece somente depois de documento e PIN corretos.
CREATE OR REPLACE FUNCTION public.gsa_reactivate_client_after_pin(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clientes SET status = 'ativo', cadastro_aprovado = true,
    inativado_pelo_cliente_em = NULL, reativado_em = now(), updated_at = now()
  WHERE id = p_client_id AND status = 'inativo'
    AND cadastro_aprovado IS TRUE AND exclusao_definitiva_em IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_reactivate_client_after_pin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_reactivate_client_after_pin(uuid) TO service_role;

-- Atualiza o cadastro publico vigente sem duplicar uma versao antiga da funcao.
-- Cadastro sem indicacao nao depende mais de codigo ou liberacao administrativa.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_public_register_client(text,jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'IF v_default_active AND upper(v_token) = upper(coalesce(v_default_code, '''')) THEN',
    'IF v_token = '''' OR (v_default_active AND upper(v_token) = upper(coalesce(v_default_code, ''''))) THEN');
  v_def := replace(v_def,
    'IF upper(v_token) = ''BEMVINDO'' OR (v_default_active AND upper(v_token) = upper(coalesce(v_default_code, ''''))) THEN',
    'IF v_token = '''' OR upper(v_token) = ''BEMVINDO'' OR (v_default_active AND upper(v_token) = upper(coalesce(v_default_code, ''''))) THEN');
  v_def := replace(v_def,
    'CASE WHEN v_is_default THEN ''inativo'' ELSE ''ativo'' END,',
    '''ativo'',');
  v_def := replace(v_def,
    'v_is_default, v_is_default, NOT v_is_default,',
    'false, false, true,');
  v_def := replace(v_def,
    '''status'', CASE WHEN v_is_default THEN ''pendente'' ELSE ''ativo'' END',
    '''status'', ''ativo''');
  v_def := replace(v_def,
    'CASE WHEN v_is_default THEN ''Cadastro recebido'' ELSE ''Bem-vindo ao Grupo GSA'' END,',
    '''Bem-vindo ao Grupo GSA'',');
  v_def := replace(v_def,
    'CASE WHEN v_is_default THEN ''Seu cadastro foi recebido e aguarda analise administrativa.'' ELSE ''Seu cadastro foi criado com sucesso. Bem-vindo ao portal.'' END,',
    '''Seu cadastro foi criado e ativado imediatamente. Bem-vindo ao portal.'',');
  v_def := replace(v_def,
    '''cadastro'', CASE WHEN v_is_default THEN ''pendentes'' ELSE ''ativos'' END,',
    '''cadastro'', ''ativos'',');

  -- Identidade excluida pode se cadastrar novamente, mas nunca recebe premio de novo cliente/indicacao.
  v_def := replace(v_def,
    'v_codigo := public.gsa_generate_code(''CLI'');',
    'IF EXISTS (SELECT 1 FROM public.clientes_identidades_historicas h WHERE h.documento = v_doc OR h.telefone = v_phone) THEN v_is_default := true; END IF; v_codigo := public.gsa_generate_code(''CLI'');');
  EXECUTE v_def;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_mark_historical_client_ineligible()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_doc text; v_phone text;
BEGIN
  v_doc := regexp_replace(coalesce(NEW.cpf, NEW.cnpj, ''), '\D', '', 'g');
  v_phone := regexp_replace(coalesce(NEW.telefone, ''), '\D', '', 'g');
  IF EXISTS (SELECT 1 FROM public.clientes_identidades_historicas h WHERE h.documento = v_doc OR h.telefone = v_phone) THEN
    NEW.inelegivel_novo_cliente := true;
    NEW.inelegivel_nova_indicacao := true;
    NEW.bonus_boas_vindas_pendente := false;
    NEW.indicacao_origem_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mark_historical_client_ineligible ON public.clientes;
CREATE TRIGGER trg_mark_historical_client_ineligible
BEFORE INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.gsa_mark_historical_client_ineligible();

-- Depois que o PIN foi validado, uma conta apenas desativada volta imediatamente.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_login_pin(text,text,text)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'IF p_tipo = ''cliente'' AND v_record.status = ''inativo'' AND coalesce(v_record.cadastro_aprovado, true) THEN' || chr(10) ||
    '    RETURN jsonb_build_object(''valid'', false, ''error'', ''Cliente inativo.'');' || chr(10) || '  END IF;',
    'IF p_tipo = ''cliente'' AND v_record.status = ''inativo'' AND coalesce(v_record.cadastro_aprovado, true) THEN PERFORM public.gsa_reactivate_client_after_pin(v_record.id); v_record.status := ''ativo''; END IF;');
  EXECUTE v_def;
END;
$$;

COMMIT;
