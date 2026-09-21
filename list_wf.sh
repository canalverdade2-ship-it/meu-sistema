sudo docker exec n8n n8n export:workflow --all 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for w in data:
    webhooks=[]
    for n in w.get('nodes',[]):
        if 'webhook' in n.get('type','').lower():
            webhooks.append(n.get('parameters',{}).get('path','?'))
    print(f'{w[\"id\"]} | {w[\"name\"]} | active={w[\"active\"]} | webhooks={webhooks}')
"