#!/usr/bin/env python3
"""
Fix script for 2026-09-15 production JSON.
- incomplete_duration -> approved
- failed_autonomous -> pending (clear error)
- missing_eligible_media -> pending
- Clear finished_at
"""
import json

PATH = "/opt/gsa-tv/runtime/production/2026-09-15.json"

with open(PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

changed = []

for block in data.get("programs", []):
    st = block.get("state")
    bid = block.get("block_id", "")[:8]
    prog = block.get("program", "?")
    if st == "incomplete_duration":
        block["state"] = "approved"
        changed.append(f"  {prog} ({bid}): incomplete_duration -> approved")
    elif st == "failed_autonomous":
        block["state"] = "pending"
        block.pop("error", None)
        changed.append(f"  {prog} ({bid}): failed_autonomous -> pending")
    elif st == "missing_eligible_media":
        block["state"] = "pending"
        changed.append(f"  {prog} ({bid}): missing_eligible_media -> pending")

# Clear finished_at so the script re-runs
if "finished_at" in data:
    del data["finished_at"]
    changed.append("  [meta] finished_at cleared")

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("=== Changes applied ===")
for c in changed:
    print(c)
print(f"\nTotal: {len(changed)} changes saved to {PATH}")
