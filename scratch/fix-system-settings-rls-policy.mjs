import { runSshScript } from './ssh2-run.mjs';

async function main() {
  try {
    const res = await runSshScript(`
      sudo -u postgres psql -p 5433 -d gsahub -c "
        DROP POLICY IF EXISTS system_settings_public_read ON public.system_settings;
        CREATE POLICY system_settings_public_read ON public.system_settings
          FOR SELECT
          TO anon, authenticated
          USING (
            key = ANY (ARRAY[
              'afiliado_bonus_boas_vindas_ativo'::text,
              'afiliado_bonus_boas_vindas_valor'::text,
              'afiliado_pontos_ativo'::text,
              'afiliado_pontos_minimo_resgate'::text,
              'afiliado_pontos_resgate_taxa'::text,
              'afiliado_saque_minimo'::text,
              'bonus_cadastro_tipo'::text,
              'bonus_cadastro_valor'::text,
              'bonus_indicador'::text,
              'codigo_cadastro_padrao_ativo'::text,
              'codigo_cadastro_padrao'::text,
              'credito_saque_taxa_tipo'::text,
              'credito_saque_taxa_valor'::text,
              'desconto_indicado_porcentagem'::text,
              'indicado_desconto_porcentagem'::text,
              'indicado_recompensa_tipo'::text,
              'indicado_valor_pontos'::text,
              'indicador_limite_carteira'::text,
              'indicador_recompensa_tipo'::text,
              'indicador_valor_pontos'::text,
              'loja_credito_juros_avista'::text,
              'loja_credito_juros_parcelado'::text,
              'loja_taxa_entrega_padrao'::text,
              'modal_indicacao_acao_botao'::text,
              'modal_indicacao_ativo'::text,
              'modal_indicacao_descricao'::text,
              'modal_indicacao_modulo_destino'::text,
              'modal_indicacao_tamanho'::text,
              'modal_indicacao_texto_botao'::text,
              'modal_indicacao_titulo'::text,
              'modal_indicacao_url_botao'::text,
              'modulo_area_vip_ativo'::text,
              'modulo_area_vip_oculto'::text,
              'template_mensagem_indicacao'::text,
              'valor_minimo_saque'::text,
              'whatsapp_float_ativo'::text,
              'whatsapp_float_mensagem'::text,
              'whatsapp_float_posicao'::text,
              'whatsapp_float_tamanho'::text,
              'whatsapp_float_telefone'::text,
              'whatsapp_float_tooltip'::text,
              'loja_pix_desconto_ativo'::text,
              'loja_pix_desconto_porcentagem'::text,
              'loja_pix_desconto_tipo_aplicacao'::text,
              'loja_pix_desconto_categorias'::text,
              'loja_pix_desconto_produtos'::text,
              'loja_pix_desconto_permitir_pontos'::text,
              'loja_pix_desconto_permitir_saldo_carteira'::text
            ])
          );
      "
    `, 20000);
    console.log(res.stdout);
    if (res.stderr) console.error('STDERR:', res.stderr);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
