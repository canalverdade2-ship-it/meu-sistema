#!/usr/bin/env python3
import json

PATH = "/opt/gsa-tv/runtime/production/2026-09-15.json"

with open(PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

progs = data.get("programs", [])
states = {}
for p in progs:
    st = p.get("state", "?")
    states[st] = states.get(st, 0) + 1

print("=== Production State ===")
print(f"Root state: {data.get('state', 'NOT SET')}")
print(f"finished_at: {data.get('finished_at', 'NOT SET')}")
print(f"Total programs: {len(progs)}")
print(f"States summary: {states}")
print()
print("--- Per-program ---")
for p in progs:
    bid = p.get("block_id", "")[:8]
    prog = p.get("program", "?")
    st = p.get("state", "?")
    err = p.get("error", "")[:60] if p.get("error") else ""
    print(f"  [{bid}] {prog}: {st}" + (f" | ERR: {err}" if err else ""))
