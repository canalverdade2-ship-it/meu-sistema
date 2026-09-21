import json
d = json.load(open("/opt/gsa-tv/runtime/production/2026-09-15.json"))
states = {}
for b in d["programs"]:
    s = b["state"]
    states[s] = states.get(s, 0) + 1
    
print("=== Block States ===")
for state, count in sorted(states.items()):
    print(f"  {state}: {count}")
print(f"\nTotal: {len(d['programs'])} programs")
print(f"finished_at: {d.get('finished_at', 'NOT SET')}")
print(f"updated_at: {d.get('updated_at', 'N/A')}")
print()
print("=== Pending / In Progress ===")
for b in d["programs"]:
    if b["state"] not in ("completed", "approved"):
        print(f"  [{b['state']}] {b['program']} ({b.get('block_id','')[:8]})")
