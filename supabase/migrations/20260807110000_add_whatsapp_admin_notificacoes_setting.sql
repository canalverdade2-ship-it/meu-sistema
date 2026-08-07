BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_allowed_setting_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'codigo_cadastro_padrao_ativo',
    'codigo_cadastro_padrao',
    'bonus_cadastro_tipo',
    'bonus_cadastro_valor',
    'valor_minimo_saque',
    'vencimento_padrao_servicos',
    'vencimento_padrao_produtos',
    'loja_taxa_entrega_padrao',
    'indicador_recompensa_tipo',
    'indicador_limite_carteira',
    'indicador_valor_pontos',
    'indicado_recompensa_tipo',
    'indicado_desconto_porcentagem',
    'indicado_valor_pontos',
    'template_mensagem_indicacao',
    'bonus_indicador',
    'desconto_indicado_porcentagem',
    'whatsapp_float_ativo',
    'whatsapp_float_telefone',
    'whatsapp_float_mensagem',
    'whatsapp_float_tamanho',
    'whatsapp_float_posicao',
    'whatsapp_float_tooltip',
    'whatsapp_admin_notificacoes',
    'whatsapp_n8n_webhook_url',
    'modal_indicacao_ativo',
    'modal_indicacao_titulo',
    'modal_indicacao_descricao',
    'modal_indicacao_url_botao',
    'modal_indicacao_acao_botao',
    'modal_indicacao_modulo_destino',
    'modal_indicacao_texto_botao',
    'modal_indicacao_tamanho',
    'loja_credito_juros_avista',
    'loja_credito_juros_parcelado',
    'cobranca_multa_porcentagem',
    'cobranca_juros_mensal',
    'cobranca_juros_tipo'
  ]::text[];
$$;

INSERT INTO public.system_settings (key, value)
VALUES 
  ('whatsapp_admin_notificacoes', '5511920857756'),
  ('whatsapp_n8n_webhook_url', 'http://163.176.97.152:5678/webhook/send-whatsapp')
ON CONFLICT (key) DO NOTHING;

COMMIT;
