import { runPsql } from './query_vps.mjs';

console.log('--- Testing gsa_public_resgatar_beneficio_parceiro ---');
console.log(runPsql(`
SELECT public.gsa_public_resgatar_beneficio_parceiro(
  p_parceiro_slug => (SELECT slug FROM public.parceiros WHERE status = 'ativo' LIMIT 1),
  p_nome_completo => 'Teste Auditoria Explorer DB',
  p_telefone => '11999998888',
  p_email => 'teste.auditoria@gsa.com.br'
);
`));
