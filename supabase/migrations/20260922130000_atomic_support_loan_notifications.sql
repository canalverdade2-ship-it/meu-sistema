BEGIN;
CREATE OR REPLACE FUNCTION public.gsa_notify_support_loan_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_client uuid; v_item uuid; v_module text; v_title text; v_text text;
 v_admin boolean:=true; v_customer boolean:=true;
 v_previous text:=current_setting('gsa.system_override',true);
BEGIN
 IF TG_TABLE_NAME='tickets' THEN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  v_client:=NEW.cliente_id; v_item:=NEW.id; v_module:='suporte';
  v_title:='Ticket de suporte aberto'; v_text:='O chamado foi registrado e está disponível para atendimento.';
 ELSIF TG_TABLE_NAME='ticket_mensagens' THEN
  SELECT cliente_id INTO v_client FROM public.tickets WHERE id=NEW.ticket_id;
  IF v_client IS NULL THEN RETURN NEW; END IF;
  v_item:=NEW.ticket_id; v_module:='suporte';
  v_admin:=NEW.tipo='cliente'; v_customer:=NEW.tipo IN ('admin','colaborador');
  v_title:='Nova mensagem no suporte'; v_text:='Uma nova mensagem foi registrada no chamado. Abra a conversa para ler.';
 ELSE
  IF TG_OP='UPDATE' THEN
   IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  END IF;
  v_client:=NEW.cliente_id; v_item:=NEW.id; v_module:='emprestimos';
  v_title:=CASE WHEN TG_OP='INSERT' THEN 'Solicitação de empréstimo registrada' ELSE 'Atualização do empréstimo' END;
  v_text:='Solicitação ' || coalesce(NEW.codigo_emprestimo,NEW.id::text) || '. Situação: ' || replace(NEW.status,'_',' ') || '.';
 END IF;
 PERFORM set_config('gsa.system_override','on',true);
 IF v_admin THEN
  INSERT INTO public.notificacoes(titulo,mensagem,modulo,item_id,destinatario_tipo,tipo,acao_origem,contexto,lida,data_criacao)
  VALUES(v_title,v_text,v_module,v_item::text,'admin','sistema','evento_'||TG_TABLE_NAME,
   jsonb_build_object('source_id',NEW.id,'cliente_id',v_client,'transactional',true),false,now());
 END IF;
 IF v_customer AND v_client IS NOT NULL THEN
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,item_id,destinatario_tipo,tipo,acao_origem,contexto,lida,data_criacao)
  VALUES(v_client,v_title,v_text,v_module,v_item::text,'cliente','sistema','evento_'||TG_TABLE_NAME,
   jsonb_build_object('source_id',NEW.id,'transactional',true),false,now());
 END IF;
 PERFORM set_config('gsa.system_override',coalesce(v_previous,''),true);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.gsa_notify_support_loan_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_atomic_notification AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_support_loan_event();
CREATE TRIGGER trg_atomic_notification AFTER INSERT ON public.ticket_mensagens FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_support_loan_event();
CREATE TRIGGER trg_atomic_notification AFTER INSERT OR UPDATE OF status ON public.emprestimos FOR EACH ROW EXECUTE FUNCTION public.gsa_notify_support_loan_event();
COMMIT;
