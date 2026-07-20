-- Segurança do GSA Viagens alinhada ao modelo de sessão personalizada do portal.
-- A identidade do ator vem do JWT assinado emitido pelo gateway GSA.

ALTER TABLE public.viagens_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_pacotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_pacote_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_solicitacoes_reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_passageiro_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagens_cancelamentos ENABLE ROW LEVEL SECURITY;

-- Remove políticas históricas que dependiam de clientes.user_id.
DROP POLICY IF EXISTS "Leitura pública configuracoes" ON public.viagens_configuracoes;
DROP POLICY IF EXISTS "Leitura pacotes publicados" ON public.viagens_pacotes;
DROP POLICY IF EXISTS "Leitura imagens pacotes" ON public.viagens_pacote_imagens;
DROP POLICY IF EXISTS "Cliente ve seus orcamentos" ON public.viagens_orcamentos;
DROP POLICY IF EXISTS "Cliente ve suas reservas" ON public.viagens_solicitacoes_reserva;
DROP POLICY IF EXISTS "Cliente ve suas propostas" ON public.viagens_propostas;
DROP POLICY IF EXISTS "Cliente ve seus passageiros" ON public.viagens_passageiros;
DROP POLICY IF EXISTS "Cliente ve documentos seus passageiros" ON public.viagens_passageiro_documentos;
DROP POLICY IF EXISTS "Cliente ve suas transacoes" ON public.viagens_transacoes;
DROP POLICY IF EXISTS "Cliente ve seus vouchers" ON public.viagens_vouchers;
DROP POLICY IF EXISTS "Cliente ve seus cancelamentos" ON public.viagens_cancelamentos;
DROP POLICY IF EXISTS "Cliente insere orcamentos" ON public.viagens_orcamentos;
DROP POLICY IF EXISTS "Cliente ou visitante insere orcamentos" ON public.viagens_orcamentos;
DROP POLICY IF EXISTS "Cliente insere reservas" ON public.viagens_solicitacoes_reserva;
DROP POLICY IF EXISTS "Cliente atualiza reservas" ON public.viagens_solicitacoes_reserva;
DROP POLICY IF EXISTS "Cliente atualiza suas propostas (aceite)" ON public.viagens_propostas;
DROP POLICY IF EXISTS "Cliente insere passageiros" ON public.viagens_passageiros;
DROP POLICY IF EXISTS "Cliente atualiza passageiros" ON public.viagens_passageiros;
DROP POLICY IF EXISTS "Cliente deleta passageiros" ON public.viagens_passageiros;
DROP POLICY IF EXISTS "Cliente insere documentos passageiros" ON public.viagens_passageiro_documentos;
DROP POLICY IF EXISTS "Cliente deleta documentos passageiros" ON public.viagens_passageiro_documentos;
DROP POLICY IF EXISTS "Cliente solicita cancelamento" ON public.viagens_cancelamentos;

-- Catálogo público.
CREATE POLICY "Leitura pública configuracoes"
  ON public.viagens_configuracoes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Leitura pacotes publicados"
  ON public.viagens_pacotes
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('publicado', 'disponibilidade_sob_consulta', 'esgotado'));

CREATE POLICY "Leitura imagens pacotes"
  ON public.viagens_pacote_imagens
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Leitura do próprio cliente com identidade derivada do JWT GSA.
CREATE POLICY "Cliente ve seus orcamentos"
  ON public.viagens_orcamentos
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente ve suas reservas"
  ON public.viagens_solicitacoes_reserva
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente ve suas propostas"
  ON public.viagens_propostas
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente ve seus passageiros"
  ON public.viagens_passageiros
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente ve documentos seus passageiros"
  ON public.viagens_passageiro_documentos
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      WHERE passageiro.id = passageiro_id
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
    )
  );

CREATE POLICY "Cliente ve suas transacoes"
  ON public.viagens_transacoes
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente ve seus vouchers"
  ON public.viagens_vouchers
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_transacoes transacao
      WHERE transacao.id = transacao_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
    )
  );

CREATE POLICY "Cliente ve seus cancelamentos"
  ON public.viagens_cancelamentos
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- Orçamento pode ser enviado por visitante ou pelo cliente autenticado.
CREATE POLICY "Cliente ou visitante insere orcamentos"
  ON public.viagens_orcamentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (
      cliente_id IS NULL
      AND NULLIF(trim(nome), '') IS NOT NULL
      AND NULLIF(trim(email), '') IS NOT NULL
      AND NULLIF(trim(telefone), '') IS NOT NULL
    )
    OR (
      public.gsa_jwt_session_is_valid()
      AND public.gsa_jwt_actor_type() = 'cliente'
      AND cliente_id = public.gsa_jwt_actor_id()
    )
  );

CREATE POLICY "Cliente insere reservas"
  ON public.viagens_solicitacoes_reserva
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente atualiza reservas"
  ON public.viagens_solicitacoes_reserva
  FOR UPDATE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  )
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente insere passageiros"
  ON public.viagens_passageiros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1
      FROM public.viagens_propostas proposta
      WHERE proposta.id = proposta_id
        AND proposta.cliente_id = public.gsa_jwt_actor_id()
    )
  );

CREATE POLICY "Cliente atualiza passageiros"
  ON public.viagens_passageiros
  FOR UPDATE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  )
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente deleta passageiros"
  ON public.viagens_passageiros
  FOR DELETE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

CREATE POLICY "Cliente insere documentos passageiros"
  ON public.viagens_passageiro_documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      WHERE passageiro.id = passageiro_id
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
    )
  );

CREATE POLICY "Cliente deleta documentos passageiros"
  ON public.viagens_passageiro_documentos
  FOR DELETE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      WHERE passageiro.id = passageiro_id
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
    )
  );

-- Administração e colaboradores operacionais podem gerenciar o módulo.
DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'viagens_configuracoes',
    'viagens_fornecedores',
    'viagens_pacotes',
    'viagens_pacote_imagens',
    'viagens_orcamentos',
    'viagens_solicitacoes_reserva',
    'viagens_propostas',
    'viagens_passageiros',
    'viagens_passageiro_documentos',
    'viagens_transacoes',
    'viagens_vouchers',
    'viagens_cancelamentos'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Operacao GSA gerencia ' || tabela, tabela);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.gsa_jwt_session_is_valid() AND public.gsa_jwt_actor_type() IN (''admin'', ''colaborador'')) WITH CHECK (public.gsa_jwt_session_is_valid() AND public.gsa_jwt_actor_type() IN (''admin'', ''colaborador''))',
      'Operacao GSA gerencia ' || tabela,
      tabela
    );
  END LOOP;
END;
$$;

GRANT SELECT ON public.viagens_configuracoes, public.viagens_pacotes, public.viagens_pacote_imagens
  TO anon, authenticated;
GRANT INSERT ON public.viagens_orcamentos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.viagens_configuracoes,
  public.viagens_fornecedores,
  public.viagens_pacotes,
  public.viagens_pacote_imagens,
  public.viagens_orcamentos,
  public.viagens_solicitacoes_reserva,
  public.viagens_propostas,
  public.viagens_passageiros,
  public.viagens_passageiro_documentos,
  public.viagens_transacoes,
  public.viagens_vouchers,
  public.viagens_cancelamentos
TO authenticated;
