import os

path = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py'
with open(path, 'r') as f:
    content = f.read()

# Hardcode the Pexels and Pixabay keys to avoid empty environment variables overriding the defaults
old_pexels_env = "pexels_key = os.environ.get('PEXELS_API_KEY', 'vzRYUjFgGAouI5uYTbjlvonzRU2kiefK0P7JRPyf0Iq7CcDzU5gOZUbz')"
new_pexels_env = "pexels_key = 'vzRYUjFgGAouI5uYTbjlvonzRU2kiefK0P7JRPyf0Iq7CcDzU5gOZUbz'"

old_pixabay_env = "pixabay_key = os.environ.get('PIXABAY_API_KEY', '57596721-7e8e67b2aa9e242e8ade98871')"
new_pixabay_env = "pixabay_key = '57596721-7e8e67b2aa9e242e8ade98871'"

content = content.replace(old_pexels_env, new_pexels_env)
content = content.replace(old_pixabay_env, new_pixabay_env)

with open(path, 'w') as f:
    f.write(content)
print('Patched renderer with hardcoded keys.')
