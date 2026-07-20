ALTER TABLE public.ticket_mensagens
  ADD COLUMN IF NOT EXISTS anexo_nome text;

COMMENT ON COLUMN public.ticket_mensagens.anexo_nome IS
  'Nome original do arquivo anexado; a referência de armazenamento fica em anexo_url.';
