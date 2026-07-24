BEGIN;

-- A elegibilidade de clientes passa a ser uma regra fixa do produto:
-- cadastro ativo + pelo menos uma fatura paga.
UPDATE public.gsa_calculator_pro_products
   SET liberar_cliente_com_fatura_paga = true;

ALTER TABLE public.gsa_calculator_pro_products
  ALTER COLUMN liberar_cliente_com_fatura_paga SET DEFAULT true;

COMMENT ON COLUMN public.gsa_calculator_pro_products.liberar_cliente_com_fatura_paga IS
  'Compatibilidade legada. A regra é obrigatoriamente verdadeira: cliente ativo com ao menos uma fatura paga recebe acesso Pro automático.';

-- Liberações manuais individuais deixam de existir e não podem manter sessões ativas.
UPDATE public.gsa_calculator_pro_sessions
   SET revoked_at = COALESCE(revoked_at, now())
 WHERE source = 'manual'
   AND revoked_at IS NULL;

DELETE FROM public.gsa_calculator_pro_grants
 WHERE source = 'manual';

ALTER TABLE public.gsa_calculator_pro_grants
  DROP CONSTRAINT IF EXISTS gsa_calculator_pro_grants_source_check;

ALTER TABLE public.gsa_calculator_pro_grants
  ADD CONSTRAINT gsa_calculator_pro_grants_source_check
  CHECK (source IN ('payment','voucher','client_paid_invoice','free_period'));

-- O painel continua salvando preço, duração, ativação e promoção,
-- mas não pode desligar o benefício automático dos clientes.
CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_product(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_inicio timestamptz;
  v_fim timestamptz;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;

  v_inicio := nullif(p_payload->>'gratuito_inicio','')::timestamptz;
  v_fim := nullif(p_payload->>'gratuito_fim','')::timestamptz;

  IF v_inicio IS NOT NULL AND v_fim IS NOT NULL AND v_fim <= v_inicio THEN
    RAISE EXCEPTION 'O término da promoção precisa ser posterior ao início' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_calculator_pro_products
     SET ativo = COALESCE((p_payload->>'ativo')::boolean, ativo),
         preco_centavos = GREATEST(0, COALESCE((p_payload->>'preco_centavos')::integer, preco_centavos)),
         duracao_acesso_minutos = LEAST(525600, GREATEST(15, COALESCE((p_payload->>'duracao_acesso_minutos')::integer, duracao_acesso_minutos))),
         liberar_cliente_com_fatura_paga = true,
         gratuito_inicio = v_inicio,
         gratuito_fim = v_fim
   WHERE tool_id = p_tool_id
   RETURNING to_jsonb(gsa_calculator_pro_products.*) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Configuração não encontrada' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

-- Remove as operações administrativas de concessão individual.
DROP FUNCTION IF EXISTS public.gsa_admin_search_calculator_pro_clients(uuid, text, text);
DROP FUNCTION IF EXISTS public.gsa_admin_grant_calculator_pro(uuid, text, uuid, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.gsa_admin_revoke_calculator_pro_grant(uuid, text, uuid, text);

COMMIT;
