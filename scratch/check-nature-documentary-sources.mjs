import { runSshScript } from './ssh2-run.mjs';
const urls=[
['ocean02','https://upload.wikimedia.org/wikipedia/commons/9/9b/Ocean_surface_waves_02.ogv'],
['ocean04','https://upload.wikimedia.org/wikipedia/commons/d/d4/Ocean_surface_waves_04.ogv'],
['waterfall','https://upload.wikimedia.org/wikipedia/commons/9/9e/Video_of_the_waterfall_of_Seythenex.ogv'],
['forestdoc','https://upload.wikimedia.org/wikipedia/commons/2/23/Flathead_National_Forest-_Your_Forests_Your_Future_%2848765341522%29.webm'],
['plateaudoc','https://upload.wikimedia.org/wikipedia/commons/3/32/South_Plateau_Project_Overview_Video_%2852408796424%29.webm']
];
const lines=urls.map(([n,u])=>`echo -n '${n}|' ; curl -fsSIL --max-time 30 '${u}' | awk 'BEGIN{IGNORECASE=1}/^content-length:|^content-type:/{gsub("\\r","");printf "%s ",$0}END{print ""}'`).join('\n');
const result=await runSshScript(`set -euo pipefail\n${lines}`,120000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
