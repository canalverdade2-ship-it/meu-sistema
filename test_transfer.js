import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ocgajvagxagutfvgxwsy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ2FqdmFneGFndXRmdmd4d3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTY0MDksImV4cCI6MjA4OTUzMjQwOX0.1OXsjDAsGl82u6ytGQ5iX2vroXjhmqUoFkbOLKbO6XI'
);

async function testFetch() {
  const { data, error } = await supabase
    .from('transferencias')
    .select(
      '*, cliente_origem:clientes!cliente_origem_id(nome, cpf, data_cadastro, saldo_carteira, saldo_pontos), cliente_destino:clientes!cliente_destino_id(nome, cpf, data_cadastro, saldo_carteira, saldo_pontos)'
    )
    .order('data_solicitacao', { ascending: false });

  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('SUCCESS, count:', data?.length);
    console.log('First record:', data?.[0]);
  }
}

testFetch();
