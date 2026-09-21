import fs from 'node:fs';
const p='scratch/publish-editorial-ep01.mjs';
let s=fs.readFileSync(p,'utf8');
s=s.replace('psql "$dburl" -X -At -c "insert into public.gsa_tv_jobs', 'psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs');
s=s.replace("sleep 10\necho '=== final state ==='", "for i in 1 2 3 4 5 6 7 8 9 10; do state=$(sudo docker run --rm --network host postgres:15-alpine psql \"$dburl\" -X -qAt -c \"select status from public.gsa_tv_jobs where id='$reload_id'\"); [ \"$state\" = completed ] && break; [ \"$state\" = failed ] && break; sleep 3; done\necho '=== final state ==='");
fs.writeFileSync(p,s);
console.log('hardened');
