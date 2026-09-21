import json
with open("/opt/gsa-tv/runtime/production/2026-09-15.json", "r") as f:
    data = json.load(f)
print("Top keys:", list(data.keys()))
for key in data:
    val = data[key]
    if isinstance(val, list):
        print(f"List key '{key}' has {len(val)} items")
        if val:
            print("First item keys:", list(val[0].keys()))
            print("First item sample:", json.dumps(val[0], ensure_ascii=False)[:300])
