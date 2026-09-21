import json, hashlib, os, re, unicodedata

manifest_path = '/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/manifest.json'
masters_dir = '/home/opc/gsa-ai/work/identity-flow-20260907/masters-final'

with open(manifest_path, 'r', encoding='utf-8') as f:
    items = json.load(f)

print(f"Total items in manifest: {len(items)}")

def slugify(name):
    name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII').lower()
    return re.sub(r'[^a-z0-9]+', '-', name).strip('-')

mismatches = []
missing = []
matched = 0

for item in items:
    slug = slugify(item['program'])
    filename = f"{slug}-{item['piece_type']}.mp4"
    filepath = os.path.join(masters_dir, filename)
    if not os.path.exists(filepath):
        missing.append((item['program'], item['piece_type'], filename))
        continue
    
    with open(filepath, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    
    if file_hash != item['sha256']:
        mismatches.append((filename, item['sha256'], file_hash))
    else:
        matched += 1

print(f"Matched sha256: {matched}/{len(items)}")
if missing:
    print(f"Missing files: {missing}")
if mismatches:
    print(f"Mismatches: {mismatches}")

dir_mp4s = {f for f in os.listdir(masters_dir) if f.endswith('.mp4')}
expected_files = {f"{slugify(item['program'])}-{item['piece_type']}.mp4" for item in items}
extra = dir_mp4s - expected_files
print(f"Total MP4s in directory: {len(dir_mp4s)}")
print(f"Extra mp4 files in dir: {extra}")
