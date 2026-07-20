-- Grant permissions for new tables to anon and authenticated roles
GRANT ALL ON TABLE promocoes TO anon, authenticated;
GRANT ALL ON TABLE cliente_promocoes TO anon, authenticated;
GRANT ALL ON TABLE prestadores TO anon, authenticated;
GRANT ALL ON TABLE prestador_demandas TO anon, authenticated;
GRANT ALL ON TABLE prestador_faturas TO anon, authenticated;
GRANT ALL ON TABLE prestador_documentos TO anon, authenticated;
GRANT ALL ON TABLE prestador_historico TO anon, authenticated;
GRANT ALL ON TABLE prestador_suporte_demandas TO anon, authenticated;
GRANT ALL ON TABLE prestador_transacoes TO anon, authenticated;
GRANT ALL ON TABLE prestador_saques TO anon, authenticated;
GRANT ALL ON TABLE suporte_mensagens TO anon, authenticated;

-- Also ensure older tables have grants
GRANT ALL ON TABLE ordens_servico TO anon, authenticated;
GRANT ALL ON TABLE clientes TO anon, authenticated;
GRANT ALL ON TABLE orcamentos TO anon, authenticated;
GRANT ALL ON TABLE servicos TO anon, authenticated;
GRANT ALL ON TABLE os_notas TO anon, authenticated;
GRANT ALL ON TABLE faturas TO anon, authenticated;
