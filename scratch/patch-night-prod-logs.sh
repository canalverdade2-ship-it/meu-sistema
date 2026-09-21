sudo python3 -c "
path = '/opt/gsa-tv/bin/night-production.py'
with open(path, 'r', encoding='utf8') as f:
    content = f.read()

target1 = '''            if name not in available:
                item['state']='autonomous_generation';save(state)'''

replacement1 = '''            if name not in available:
                item['state']='autonomous_generation';save(state)
                print(f'[Night Production] Starting autonomous generation for {block[\"name\"]} (budget: {budget}s)...', flush=True)'''

target2 = '''                    item.update(state='validated',master=result['output'],duration=result['duration_s'],media_id=result['media_id'])'''

replacement2 = '''                    item.update(state='validated',master=result['output'],duration=result['duration_s'],media_id=result['media_id'])
                    print(f'[Night Production] Program {block[\"name\"]} validated: {result[\"media_id\"]} ({result[\"duration_s\"]}s)', flush=True)'''

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1, 1)
    content = content.replace(target2, replacement2, 1)
    with open(path, 'w', encoding='utf8') as f:
        f.write(content)
    print('night-production.py logging patched')
else:
    print('Targets not found or already patched')
"
