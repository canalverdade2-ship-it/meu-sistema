import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://api.147-15-43-141.nip.io';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWZlcmVuY2VfaWQiOiJnc2FodWIiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNTcwODgwMCwiZXhwIjoyMDUxMjg0ODAwfQ.dUMqF_T2rQ8_4k7cT5m8n_L5n7f4K1m9g4c6a2z1y0w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Testing anon select on gsa_tv_jobs...');
  const { data, error } = await supabase
    .from('gsa_tv_jobs')
    .select('id, status, progress, current_stage, payload, created_at, finished_at, error_message')
    .eq('job_type', 'ai_flow_vids_generate')
    .order('created_at', { ascending: false });

  console.log('Table select result:', { error, dataCount: data?.length });
  if (error) {
    console.error('Table select error:', error);
  } else {
    console.log('Sample rows:', data?.slice(0, 2));
  }

  console.log('\nTesting rpc gsa_tv_get_recent_ai_jobs...');
  const { data: rpcData, error: rpcErr } = await supabase.rpc('gsa_tv_get_recent_ai_jobs', {
    p_sessao_id: null,
    p_session_token: null,
  });
  console.log('RPC result:', { error: rpcErr, rpcData });
}

main().catch(console.error);
