-- ============================================================
-- Migration: Consulta Pública de Protocolo de Resgate
-- Cria RPC anônima para consultar status de um protocolo
-- ============================================================

-- Remove versão anterior se existir
DROP FUNCTION IF EXISTS gsa_public_consultar_protocolo(text);

CREATE OR REPLACE FUNCTION gsa_public_consultar_protocolo(
  p_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resgate    parceiros_resgates%ROWTYPE;
  v_parceiro   parceiros%ROWTYPE;
BEGIN
  -- Validação básica do código
  IF p_codigo IS NULL OR length(trim(p_codigo)) < 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Código de protocolo inválido.'
    );
  END IF;

  -- Busca o resgate pelo código (case-insensitive)
  SELECT * INTO v_resgate
  FROM parceiros_resgates
  WHERE upper(trim(codigo_gerado)) = upper(trim(p_codigo))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Protocolo não encontrado. Verifique o código e tente novamente.'
    );
  END IF;

  -- Busca o parceiro associado
  SELECT * INTO v_parceiro
  FROM parceiros
  WHERE id = v_resgate.parceiro_id
  LIMIT 1;

  -- Retorna todos os dados sem mascaramento
  RETURN jsonb_build_object(
    'success',         true,
    'codigo',          v_resgate.codigo_gerado,
    'status',          v_resgate.status,
    'parceiro_nome',   COALESCE(v_parceiro.name, 'Parceiro GSA'),
    'parceiro_slug',   COALESCE(v_parceiro.slug, ''),
    'parceiro_logo',   v_parceiro.logo_url,
    'nome_completo',   v_resgate.nome_completo,
    'telefone',        v_resgate.telefone,
    'email',           v_resgate.email,
    'tipo_resgate',    v_resgate.tipo_resgate,
    'link_ativacao',   v_resgate.link_ativacao,
    'created_at',      v_resgate.created_at,
    'data_ativacao',   v_resgate.data_ativacao
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Erro interno ao consultar protocolo. Tente novamente.'
  );
END;
$$;

-- Permissões: qualquer visitante (anon) pode consultar
GRANT EXECUTE ON FUNCTION gsa_public_consultar_protocolo(text)
  TO anon, authenticated, service_role;

-- Notifica o PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
