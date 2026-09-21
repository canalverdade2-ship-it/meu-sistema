sudo docker exec n8n n8n export:workflow --all > /tmp/wfs.raw
python3 -c "
import json,sys,re
data = open('/tmp/wfs.raw').read()
match = re.search(r'\[.*\]', data, re.DOTALL)
if match:
    j = json.loads(match.group(0))
    for w in j:
        webhooks=[]
        for n in w.get('nodes',[]):
            if 'webhook' in n.get('type','').lower():
                webhooks.append(n.get('parameters',{}).get('path','?'))
        if webhooks:
            print(f'ID: {w[\"id\"]} | {w[\"name\"]} | ACTIVE: {w[\"active\"]} | WEBHOOKS: {webhooks}')
else:
    print('No json found')
"