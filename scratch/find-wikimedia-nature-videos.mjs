import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
python3 - <<'PY'
import json,urllib.parse,urllib.request
for q in ['waterfall video','ocean waves video','forest stream video','mountain sunrise video']:
 u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','generator':'search','gsrsearch':q+' filetype:video','gsrnamespace':6,'gsrlimit':8,'prop':'imageinfo','iiprop':'url|extmetadata','format':'json','origin':'*'})
 req=urllib.request.Request(u,headers={'User-Agent':'GSA-TV/1.0 (editorial research)'})
 data=json.load(urllib.request.urlopen(req,timeout=30))
 print('QUERY',q)
 for p in data.get('query',{}).get('pages',{}).values():
  ii=(p.get('imageinfo') or [{}])[0];m=ii.get('extmetadata',{});lic=m.get('LicenseShortName',{}).get('value','')
  if lic in ('CC0','Public domain','CC BY 4.0','CC BY-SA 4.0'):
   print(json.dumps({'title':p.get('title'),'url':ii.get('url'),'descriptionurl':ii.get('descriptionurl'),'license':lic,'artist':m.get('Artist',{}).get('value','')[:120]},ensure_ascii=False))
PY
`;
const result=await runSshScript(script,120000);process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
