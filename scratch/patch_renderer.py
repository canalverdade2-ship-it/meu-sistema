import urllib.request, urllib.parse, json, os, traceback
from pathlib import Path

# Open render-generic-program.py
path = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py'
with open(path, 'r') as f:
    content = f.read()

# Replace Pexels Request creation
old_pexels = """            req = urllib.request.Request(
                f'https://api.pexels.com/v1/search?query={query_encoded}&per_page=15&orientation=landscape',
                headers={'Authorization': pexels_key}
            )"""
new_pexels = """            req = urllib.request.Request(
                f'https://api.pexels.com/v1/search?query={query_encoded}&per_page=15&orientation=landscape',
                headers={'Authorization': pexels_key, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )"""
content = content.replace(old_pexels, new_pexels)

# Replace Pixabay URL opening
old_pixabay = """            with urllib.request.urlopen(url, timeout=5) as response:"""
new_pixabay = """            req2 = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req2, timeout=5) as response:"""
content = content.replace(old_pixabay, new_pixabay)

with open(path, 'w') as f:
    f.write(content)
print('Patched renderer.')
