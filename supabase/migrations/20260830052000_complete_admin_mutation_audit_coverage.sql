BEGIN;

-- Complete the audit trail for tables still mutated directly by authorized
-- administrative screens. Existing business triggers are preserved.
DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'contratos',
    'demanda_comentarios',
    'gsa_tv_media_items',
    'gsa_tv_schedule_slots',
    'gsa_whatsapp_ramais',
    'loja_categorias',
    'prestador_historico',
    'prestador_premios',
    'prestador_promocoes',
    'viagens_pacote_imagens',
    'vouchers',
    'suporte_mensagens',
    'prestador_suporte_demandas'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE;
    END IF;

    v_trigger := 'trg_gsa_admin_audit_' || v_table;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.gsa_admin_sensitive_change_audit()',
      v_trigger,
      v_table
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
