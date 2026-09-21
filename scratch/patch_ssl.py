import os

path = '/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py'
with open(path, 'r') as f:
    content = f.read()

import_str = "import argparse\nimport hashlib"
new_import_str = "import argparse\nimport hashlib\nimport ssl\nssl._create_default_https_context = ssl._create_unverified_context"
content = content.replace(import_str, new_import_str)

with open(path, 'w') as f:
    f.write(content)
print('Patched SSL verification.')
