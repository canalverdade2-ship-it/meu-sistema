python3 << 'EOF'
import subprocess, json
mp4 = '/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.mp4'
res = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', mp4], capture_output=True, text=True)
print('RETURN CODE:', res.returncode)
if res.returncode == 0:
    data = json.loads(res.stdout)
    print('DURATION:', data['format']['duration'])
    print('STREAMS:', len(data['streams']))
else:
    print('STDERR:', res.stderr)
EOF
