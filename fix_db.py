import os
import urllib.request
import json

data = json.dumps({
  "query": "SELECT id, duration_s, drive_path, state, approval_state FROM gsa_tv_media_items WHERE id = 'media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf';"
}).encode('utf-8')

req = urllib.request.Request("http://127.0.0.1:3000/api/some-endpoint", data=data)
# Not a good idea, don't know API endpoints.
