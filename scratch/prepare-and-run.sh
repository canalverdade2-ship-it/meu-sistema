sudo python3 << 'EOF'
import json, subprocess
PG = """const{Pool}=require('pg');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL});try{const q=JSON.parse(s);const r=await p.query(q.sql,q.params);console.log(JSON.stringify(r.rows||[]))}catch(e){console.error(e.message);process.exitCode=1}finally{await p.end()}});"""

def query(sql, params=None):
    r = subprocess.run(['docker','exec','-i','gsa-tv-control-plane','node','-e',PG], input=json.dumps({'sql':sql,'params':params or []}), text=True, capture_output=True, timeout=30, check=True)
    return json.loads(r.stdout)

# 1. Reset media_item_id on block
print("Resetting media_item_id on block 0f2f9292-a83b-462b-aab7-b09cbff27b8a...")
query("update gsa_tv_program_blocks set media_item_id = null where id = '0f2f9292-a83b-462b-aab7-b09cbff27b8a'")
query("delete from gsa_tv_media_items where id = 'media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf'")

# 2. Update /opt/gsa-tv/runtime/production/2026-09-15.json
state_path = '/opt/gsa-tv/runtime/production/2026-09-15.json'
with open(state_path, 'r', encoding='utf8') as f:
    state = json.load(f)

print("Current programs count:", len(state.get('programs', [])))
state['programs'] = [p for p in state.get('programs', []) if p.get('slug') != 'gsa-ta-na-rede']
print("Updated programs count (without gsa-ta-na-rede):", len(state.get('programs', [])))
state['state'] = 'running'

with open(state_path, 'w', encoding='utf8') as f:
    json.dump(state, f, indent=2, ensure_ascii=False)

print("Ready for night-production run!")
EOF
