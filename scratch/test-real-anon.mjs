import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://api.147-15-43-141.nip.io';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzczOTU2NDA5LCJleHAiOjIwODk1MzI0MDl9.05kQchOXKH2S062F8SJsb-bmnh3pni-RJE1P0jo0Igs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Testing table query...');
  const { data: tableData, error: tableErr } = await supabase
    .from('gsa_tv_jobs')
    .select('id, status, progress, payload')
    .limit(3);
  console.log('Table result:', { error: tableErr, count: tableData?.length });

  console.log('\nTesting RPC gsa_tv_get_recent_ai_jobs with no params...');
  const { data: rpcData1, error: rpcErr1 } = await supabase.rpc('gsa_tv_get_recent_ai_jobs');
  console.log('RPC result 1:', { error: rpcErr1, count: rpcData1?.length, data: rpcData1 });

  console.log('\nTesting RPC gsa_tv_get_recent_ai_jobs with auth params...');
  const { data: rpcData2, error: rpcErr2 } = await supabase.rpc('gsa_tv_get_recent_ai_jobs', {
    p_sessao_id: '00000000-0000-0000-0000-000000000000',
    p_session_token: 'dummy',
  });
  console.log('RPC result 2:', { error: rpcErr2, count: rpcData2?.length, data: rpcData2 });
}

main().catch(console.error);
