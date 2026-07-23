-- Comprovante obrigatorio e conclusao financeira do fornecedor.

BEGIN;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/xml',
      'text/xml',
      'image/png',
      'image/jpeg'
    ]
WHERE id = 'documentos_fornecedor';

CREATE OR REPLACE FUNCTION public.gsa_admin_update_supplier_payable(
  p_sessao_id uuid, p_session_token text, p_payable_id uuid,
  p_action text, p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_payable public.contas_pagar%rowtype;
  v_method text := trim(coalesce(p_payload->>'forma_pagamento', ''));
  v_proof text := nullif(trim(p_payload->>'comprovante'), '');
BEGIN
  IF NOT (public.gsa_admin_has_module('fornecedores') OR public.gsa_admin_has_module('financeiro')) THEN
    RAISE EXCEPTION 'Sem permissao financeira.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_payable FROM public.contas_pagar WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar nao encontrada.'; END IF;

  IF lower(p_action) = 'pagar' THEN
    IF v_payable.status = 'pago' THEN RETURN jsonb_build_object('success', true, 'already_processed', true); END IF;
    IF v_payable.status = 'cancelado' THEN RAISE EXCEPTION 'Conta cancelada.'; END IF;
    IF length(v_method) < 2 OR length(v_method) > 80 THEN RAISE EXCEPTION 'Informe a forma de pagamento.'; END IF;
    IF v_proof IS NULL THEN RAISE EXCEPTION 'O comprovante de pagamento e obrigatorio.'; END IF;
    IF v_proof NOT LIKE ('storage://documentos_fornecedor/' || v_payable.fornecedor_id::text || '/comprovantes-pagamento/' || p_payable_id::text || '/%') THEN
      RAISE EXCEPTION 'Referencia de comprovante invalida.';
    END IF;
    IF lower(v_proof) !~ '\.(pdf|png|jpg|jpeg)$' THEN RAISE EXCEPTION 'Formato de comprovante invalido.'; END IF;

    UPDATE public.contas_pagar
    SET status = 'pago',
        valor_pendente = 0,
        data_pagamento = now(),
        forma_pagamento = v_method,
        comprovante = v_proof,
        observacoes = nullif(trim(p_payload->>'observacoes'), '')
    WHERE id = p_payable_id;

    INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
    VALUES (
      v_payable.fornecedor_id,
      'Pagamento confirmado',
      'O pagamento da nota fiscal ' || v_payable.numero_documento || ' foi confirmado.',
      'financeiro', p_payable_id
    );

    INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, ator_nome, acao, entidade, entidade_id, detalhes)
    VALUES (
      v_payable.fornecedor_id,
      v_actor->>'actor_type',
      (v_actor->>'actor_id')::uuid,
      v_actor->>'actor_name',
      'PAGAR_CONTA_FORNECEDOR',
      'contas_pagar',
      p_payable_id,
      jsonb_build_object('forma_pagamento', v_method, 'valor', v_payable.valor_pendente)
    );
  ELSIF lower(p_action) = 'cancelar' THEN
    IF length(trim(coalesce(p_payload->>'motivo', ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
    IF v_payable.status = 'pago' THEN RAISE EXCEPTION 'Conta paga nao pode ser cancelada.'; END IF;
    UPDATE public.contas_pagar
    SET status = 'cancelado', observacoes = trim(p_payload->>'motivo')
    WHERE id = p_payable_id;
  ELSE
    RAISE EXCEPTION 'Acao invalida.';
  END IF;

  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

COMMIT;
