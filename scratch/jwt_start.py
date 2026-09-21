import jwt
import urllib.request
import time
import json

secret = "1ESNAo4SFbIUapTbheVvzw39M3blnPRtJVhHGQNEvkXnL2xQZa7nM873G55kwgYWiOO8zTkmSqdsrIvB"
payload = {
    "sub": "admin",
    "exp": int(time.time()) + 3600
}
token = jwt.encode(payload, secret, algorithm="HS256")
print("Token:", token)

# Start channel 1
req2 = urllib.request.Request('http://127.0.0.1:8787/api/control/1/play', data=b'', headers={'Authorization': 'Bearer ' + token})
try:
    with urllib.request.urlopen(req2) as r2:
        print('Started:', r2.read().decode('utf-8'))
except Exception as e:
    print(e)
