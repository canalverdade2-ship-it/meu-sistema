BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_notify_admin_partner_appeal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resgate public.parceiros_resgates%ROWTYPE;
BEGIN
  SELECT *
    INTO v_resgate
    FROM public.parceiros_resgates
   WHERE id = NEW.resgate_id;

  INSERT INTO public.notificacoes(
    titulo,
    mensagem,
    modulo,
    tab,
    item_id,
    tipo,
    destinatario_tipo,
    prioridade,
    acao_origem,
    contexto
  )
  SELECT
    'Novo recurso de beneficio recebido',
    COALESCE(NULLIF(trim(v_resgate.nome_completo), ''), 'Cliente') ||
      ' apresentou recurso para a solicitacao ' ||
      COALESCE(NULLIF(trim(v_resgate.codigo_gerado), ''), v_resgate.id::text) || '.',
    'parceiros',
    'resgates',
    NEW.resgate_id::text,
    'sistema',
    'admin',
    'alta',
    'recurso_parceiro_aberto',
    jsonb_build_object(
      'resgate_id', NEW.resgate_id,
      'recurso_id', NEW.id,
      'protocolo_recurso', NEW.protocolo_recurso,
      'prazo_analise_em', NEW.prazo_analise_em
    )
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.notificacoes n
     WHERE n.acao_origem = 'recurso_parceiro_aberto'
       AND n.contexto ->> 'recurso_id' = NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_partner_appeal
  ON public.parceiros_resgates_recursos;

CREATE TRIGGER trg_notify_admin_partner_appeal
AFTER INSERT ON public.parceiros_resgates_recursos
FOR EACH ROW
EXECUTE FUNCTION public.gsa_notify_admin_partner_appeal();

-- Backfill appeals created before this notification contract was installed.
INSERT INTO public.notificacoes(
  titulo,
  mensagem,
  modulo,
  tab,
  item_id,
  tipo,
  destinatario_tipo,
  prioridade,
  acao_origem,
  contexto,
  data_criacao
)
SELECT
  'Novo recurso de beneficio recebido',
  COALESCE(NULLIF(trim(r.nome_completo), ''), 'Cliente') ||
    ' apresentou recurso para a solicitacao ' ||
    COALESCE(NULLIF(trim(r.codigo_gerado), ''), r.id::text) || '.',
  'parceiros',
  'resgates',
  r.id::text,
  'sistema',
  'admin',
  'alta',
  'recurso_parceiro_aberto',
  jsonb_build_object(
    'resgate_id', a.resgate_id,
    'recurso_id', a.id,
    'protocolo_recurso', a.protocolo_recurso,
    'prazo_analise_em', a.prazo_analise_em
  ),
  a.aberto_em
FROM public.parceiros_resgates_recursos a
JOIN public.parceiros_resgates r ON r.id = a.resgate_id
WHERE NOT EXISTS (
  SELECT 1
    FROM public.notificacoes n
   WHERE n.acao_origem = 'recurso_parceiro_aberto'
     AND n.contexto ->> 'recurso_id' = a.id::text
);

REVOKE ALL ON FUNCTION public.gsa_notify_admin_partner_appeal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_notify_admin_partner_appeal() TO service_role;

COMMIT;
