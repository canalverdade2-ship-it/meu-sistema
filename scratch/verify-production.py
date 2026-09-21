import json
d = json.load(open("/opt/gsa-tv/runtime/production/2026-09-15.json"))
states = {}
for b in d["programs"]:
    s = b["state"]
    states[s] = states.get(s, 0) + 1
print("States:", states)
print("finished_at present:", "finished_at" in d)
