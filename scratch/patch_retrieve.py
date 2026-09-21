import os

path = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py'
with open(path, 'r') as f:
    content = f.read()

# Replace Pexels urlretrieve
old_pexels_retrieve = """                            urllib.request.urlretrieve(url, out_path)"""
new_pexels_retrieve = """                            req_img = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                            with urllib.request.urlopen(req_img, timeout=10) as r, open(out_path, 'wb') as f_out:
                                f_out.write(r.read())"""

# Replace Pixabay urlretrieve
old_pixabay_retrieve = """                            urllib.request.urlretrieve(img_url, out_path)"""
new_pixabay_retrieve = """                            req_img = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                            with urllib.request.urlopen(req_img, timeout=10) as r, open(out_path, 'wb') as f_out:
                                f_out.write(r.read())"""

content = content.replace(old_pexels_retrieve, new_pexels_retrieve)
content = content.replace(old_pixabay_retrieve, new_pixabay_retrieve)

with open(path, 'w') as f:
    f.write(content)
print('Patched urlretrieve.')
