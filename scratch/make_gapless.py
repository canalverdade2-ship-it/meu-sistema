import json
import math

with open('scratch/2026-09-15.json', 'r') as f:
    pl = json.load(f)

programs = [p for p in pl['program'] if 'filler' not in p['source']]

# We need to fill exactly 86400 seconds (24 hours).
total_time = 0
new_program = []

# Keep looping through programs
while total_time < 86400:
    for p in programs:
        duration = float(p['duration'])
        # If adding this program exceeds 24h, we must trim it
        if total_time + duration > 86400:
            remaining = 86400 - total_time
            p_copy = dict(p)
            p_copy['out'] = p_copy['in'] + remaining
            p_copy['duration'] = remaining
            new_program.append(p_copy)
            total_time += remaining
            break
        else:
            new_program.append(dict(p))
            total_time += duration

pl['program'] = new_program

with open('scratch/2026-09-15-gapless.json', 'w') as f:
    json.dump(pl, f, indent=2)
