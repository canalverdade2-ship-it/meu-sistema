import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`set -u
echo '=== FISH REFERENCES ==='
rg -n -i --glob '*.js' --glob '*.mjs' --glob '*.py' --glob '*.md' 'fish.audio|fish audio|fish_speech|fishspeech|api.fish' /home/opc/gsa-ai /opt/gsa-tv 2>/dev/null | head -n 240 || true
echo '=== VIDS UPLOAD/ASSEMBLY REFERENCES ==='
for f in /home/opc/gsa-ai/{generate_vids_studio_master.js,setup_long_vids_project.js,create_fresh_vids_long.js,fill_vids_scripts.js,save_vids_studio_master_full.js}; do [ -f "$f" ] && { echo "===== $f ====="; sed -n '1,360p' "$f"; }; done
echo '=== CURRENT PROVIDERS (NO SECRETS) ==='
sudo docker exec gsa-tv-control-plane node - <<'NODE'
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});const r=await p.query("select provider, enabled, voice_model, speech_model, updated_at from public.gsa_tv_ai_provider_secrets where channel_id='ch-main' order by updated_at desc");console.log(JSON.stringify(r.rows,null,2));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)})
NODE
`;
const r=await runSshScript(remote,120000); process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
