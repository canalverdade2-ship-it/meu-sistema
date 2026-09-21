BEGIN;

-- Compatibility for already deployed clients sending p_tipo. The canonical RPC
-- still validates the actor and always creates a system notification.
CREATE OR REPLACE FUNCTION public.gsa_client_notify_admin(
 p_sessao_id uuid, p_session_token text, p_titulo text, p_mensagem text,
 p_modulo text, p_acao_origem text, p_tab text, p_item_id text,
 p_prioridade text, p_contexto jsonb, p_tipo text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp
AS $$ SELECT public.gsa_client_notify_admin(p_sessao_id,p_session_token,p_titulo,
 p_mensagem,p_modulo,p_acao_origem,p_tab,p_item_id,p_prioridade,p_contexto); $$;
REVOKE ALL ON FUNCTION public.gsa_client_notify_admin(uuid,text,text,text,text,text,text,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_notify_admin(uuid,text,text,text,text,text,text,text,text,jsonb,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_notify_marketplace_admin_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
 v_action text; v_title text; v_message text; v_module text; v_tab text;
 v_override text := current_setting('gsa.system_override',true);
BEGIN
 IF TG_ARGV[0] = 'order' THEN
   IF NOT coalesce(NEW.origem_gsa_store,false) THEN RETURN NEW; END IF;
   v_action := 'checkout_loja'; v_title := 'Nova compra no marketplace';
   v_message := 'Pedido ' || coalesce(NEW.codigo_orcamento,NEW.id::text) || ' registrado. Consulte o pedido para acompanhar o pagamento.';
   v_module := 'vendas'; v_tab := 'abertos';
 ELSE
   IF NEW.status IS DISTINCT FROM 'pago' THEN RETURN NEW; END IF;
   IF TG_OP = 'UPDATE' THEN
     IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
   END IF;
   v_action := 'pagamento_confirmado_admin'; v_title := 'Fatura quitada';
   v_message := 'A fatura ' || coalesce(NEW.codigo_fatura,NEW.id::text) || ' foi quitada. Consulte o financeiro para ver a composição do pagamento.';
   v_module := 'financeiro'; v_tab := 'faturas';
 END IF;
 -- Serialize the same event; retrying a webhook cannot create a second alert.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_action || ':' || NEW.id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.notificacoes WHERE destinatario_tipo='admin'
     AND item_id=NEW.id::text AND acao_origem=v_action) THEN
   PERFORM set_config('gsa.system_override','on',true);
   INSERT INTO public.notificacoes(titulo,mensagem,modulo,tab,item_id,tipo,
      destinatario_tipo,prioridade,acao_origem,contexto,lida,data_criacao)
   VALUES(v_title,v_message,v_module,v_tab,NEW.id::text,'sistema','admin','normal',
      v_action,jsonb_build_object('cliente_id',NEW.cliente_id,'entity_id',NEW.id,
      'source','database_event'),false,now());
   PERFORM set_config('gsa.system_override',coalesce(v_override,''),true);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_notify_marketplace_admin_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_marketplace_admin_order_created AFTER INSERT ON public.orcamentos
 FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_marketplace_admin_event('order');
CREATE TRIGGER trg_marketplace_admin_invoice_paid AFTER INSERT OR UPDATE OF status ON public.faturas
 FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_marketplace_admin_event('invoice');
NOTIFY pgrst, 'reload schema';
COMMIT;

