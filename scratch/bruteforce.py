import urllib.request
import json

passwords = ['admin', 'password', 'admin123', '123456', 'ffplayout', 'gsa-tv', 'gsatv', 'root']

for p in passwords:
    data = json.dumps({'username': 'admin', 'password': p}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8787/auth/login', data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            token = res.get('access_token')
            print('SUCCESS with password:', p)
            
            # Start channel 1
            req2 = urllib.request.Request('http://127.0.0.1:8787/api/control/1/play', data=b'', headers={'Authorization': 'Bearer ' + token})
            with urllib.request.urlopen(req2) as r2:
                print('Started:', r2.read().decode('utf-8'))
            break
    except Exception as e:
        pass
