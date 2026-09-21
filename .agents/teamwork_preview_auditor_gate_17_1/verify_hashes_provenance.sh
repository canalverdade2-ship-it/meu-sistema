python3 - << 'EOF'
import json
import hashlib
from pathlib import Path
import subprocess

DIR_FINAL = Path('/home/opc/gsa-ai/work/identity-flow-20260907/masters-final')
DIR_V1 = Path('/home/opc/gsa-ai/work/identity-flow-20260907/masters-v1')
DIR_REPL = Path('/home/opc/gsa-ai/work/identity-flow-20260907/replacements')
MANIFEST_PATH = DIR_FINAL / 'manifest.json'

manifest = json.loads(MANIFEST_PATH.read_text())
print(f"Total entries in manifest: {len(manifest)}")

mp4_files = sorted(list(DIR_FINAL.glob('*.mp4')))
print(f"Total mp4 files in masters-final: {len(mp4_files)}")

# Map from (program, piece_type) to filename convention
def get_filename(program, piece_type):
    slug = program.lower().replace(' ', '-')
    slug = slug.replace('é', 'e').replace('á', 'a').replace('í', 'i').replace('ã', 'a')
    # Special slug adjustments if needed
    suffix = 'opening' if piece_type == 'opening' else 'closing'
    candidates = list(DIR_FINAL.glob(f"*{slug}*{suffix}*.mp4"))
    if not candidates:
        # fallback broader search
        terms = [t for t in slug.split('-') if t not in ('gsa', 'da', 'de', 'do')]
        for c in DIR_FINAL.glob(f"*{suffix}*.mp4"):
            if any(term in c.name for term in terms):
                candidates.append(c)
    if len(candidates) == 1:
        return candidates[0]
    return None

hash_mismatches = []
source_counts = {'original': 0, 'regenerated': 0}
provenance_mismatches = []

for entry in manifest:
    prog = entry['program']
    ptype = entry['piece_type']
    source = entry['source']
    source_counts[source] = source_counts.get(source, 0) + 1
    expected_sha = entry['sha256']
    
    # Find matching file by hash
    matched_file = None
    for f in mp4_files:
        h = hashlib.sha256(f.read_bytes()).hexdigest()
        if h == expected_sha:
            matched_file = f
            break
            
    if not matched_file:
        hash_mismatches.append(f"{prog} {ptype}: hash {expected_sha} NOT FOUND in any file in masters-final")
    else:
        # Check provenance
        if source == 'original':
            v1_file = DIR_V1 / matched_file.name
            if v1_file.exists():
                v1_hash = hashlib.sha256(v1_file.read_bytes()).hexdigest()
                if v1_hash != expected_sha:
                    provenance_mismatches.append(f"Original {matched_file.name} hash != masters-v1 hash")
            else:
                provenance_mismatches.append(f"Original {matched_file.name} not found in masters-v1")
        elif source == 'regenerated':
            # Check if there's a matching replacement
            found_in_repl = False
            for rf in DIR_REPL.glob('*.mp4'):
                rf_hash = hashlib.sha256(rf.read_bytes()).hexdigest()
                if rf_hash == expected_sha:
                    found_in_repl = True
                    break
            if not found_in_repl:
                provenance_mismatches.append(f"Regenerated {matched_file.name} hash NOT FOUND in replacements/")

print("--- SUMMARY STATS ---")
print("Source counts:", source_counts)
print("Hash mismatches count:", len(hash_mismatches))
if hash_mismatches:
    for hm in hash_mismatches[:10]:
        print("  Mismatch:", hm)

print("Provenance mismatches count:", len(provenance_mismatches))
if provenance_mismatches:
    for pm in provenance_mismatches[:10]:
        print("  Mismatch:", pm)
EOF
