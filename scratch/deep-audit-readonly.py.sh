python3 - <<'PY'
import re,json,os,hashlib,collections,subprocess
p='/opt/gsa-tv/bin/gsa-tv-night-controller.sh'
s=open(p).read()
print('CONTROLLER SHA256',hashlib.sha256(s.encode()).hexdigest())
for n,line in enumerate(s.splitlines(),1):
 if re.search(r'token|secret|password|authorization|bearer|rtmp|api.?key|DB_URL|postgresql',line,re.I):
  print(str(n)+': [REDACTED sensitive line]')
 else: print(str(n)+': '+line)
for p in ['/opt/gsa-tv/playlists/1/2026/09/2026-09-10.json','/opt/gsa-tv/playlists/1/2026-09-10.json']:
 d=json.load(open(p)); print('PLAYLIST',p,'mtime',os.stat(p).st_mtime,'keys',list(d))
 print('META', {k:v for k,v in d.items() if k!='program'})
 arr=d.get('program',[]); print('ITEMS',len(arr))
 print('TOTAL_SECONDS',sum(float(r.get('out',r.get('duration',0)))-float(r.get('in',0)) for r in arr))
 print('COUNTS',dict(collections.Counter(r.get('source') for r in arr)))
 for src in sorted(set(r.get('source','') for r in arr)):
  row=next(r for r in arr if r.get('source')==src)
  src=row.get('source',''); mapped='/opt/gsa-tv/cache'+src if src.startswith('/media/') else src
  print(json.dumps({'source':src,'mapped':mapped,'exists':os.path.isfile(mapped),'bytes':os.stat(mapped).st_size if os.path.isfile(mapped) else None}))
  if os.path.isfile(mapped):
   z=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',mapped],capture_output=True,text=True,timeout=30)
   print('FFPROBE',z.returncode,z.stdout)
PY
systemctl is-enabled gsa-tv-signoff.timer gsa-tv-night-stop.timer gsa-tv-morning-start.timer
sudo docker ps --format '{{.Names}}' | grep -E 'gsa|playout'
bash -n /opt/gsa-tv/bin/gsa-tv-night-controller.sh && echo SHELL_SYNTAX_OK
