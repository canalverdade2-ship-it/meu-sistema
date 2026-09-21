python3 -c "
with open('/opt/gsa-tv/bin/night-production.py') as f:
    lines = f.readlines()
for i, l in enumerate(lines[:140], 1):
    print(f'{i}: {l}', end='')
"
