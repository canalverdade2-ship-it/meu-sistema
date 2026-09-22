BEGIN;
CREATE OR REPLACE FUNCTION public.gsa_notify_protection_quote_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_domain text := CASE TG_TABLE_NAME WHEN 'saude_cotacoes' THEN 'saude' ELSE 'seguros' END;
 v_previous text := current_setting('gsa.system_override',true);
BEGIN
 PERFORM set_config('gsa.system_override','on',true);
 INSERT INTO public.notificacoes(titulo,mensagem,modulo,tab,item_id,destinatario_tipo,tipo,acao_origem,contexto,lida,data_criacao)
 VALUES('Nova cotação de ' || CASE v_domain WHEN 'saude' THEN 'saúde' ELSE 'seguros' END,
 'Cotação ' || NEW.protocolo || ' recebida. Acesse o módulo para analisar a solicitação.',
 v_domain,'cotacoes',NEW.id::text,'admin','sistema','cotacao_recebida',jsonb_build_object('cliente_id',NEW.cliente_id,'cotacao_id',NEW.id),false,now());
 INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,tipo,acao_origem,lida,data_criacao)
 VALUES(NEW.cliente_id,'Cotação recebida','Recebemos sua solicitação. Protocolo: ' || NEW.protocolo || '.',
 v_domain,'minhas-cotacoes',NEW.id::text,'cliente','sistema','cotacao_enviada',false,now());
 PERFORM set_config('gsa.system_override',coalesce(v_previous,''),true);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.gsa_notify_protection_quote_created() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_notify_quote_created AFTER INSERT ON public.saude_cotacoes FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_protection_quote_created();
CREATE TRIGGER trg_notify_quote_created AFTER INSERT ON public.seguros_cotacoes FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_protection_quote_created();
COMMIT;
