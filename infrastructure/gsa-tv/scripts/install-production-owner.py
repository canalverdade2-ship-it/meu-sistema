#!/usr/bin/env python3
"""Deploy after uploading scripts to /opt/gsa-tv/bin. No streaming restart."""
from pathlib import Path
import shutil
import subprocess
import datetime

backup=Path('/opt/gsa-tv/backups')/('automation-owner-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(mode=0o700,parents=True,exist_ok=False)

def write(path,content,mode=0o644):
    p=Path(path)
    if p.exists():
        old=backup/str(p).lstrip('/')
        old.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,old)
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(content)
    p.chmod(mode)

write('/usr/local/bin/ffmpeg',Path('/opt/gsa-tv/bin/ffmpeg-production-wrapper.sh').read_text(),0o755)
write('/etc/systemd/system/gsa-tv-night-factory.service.d/96-production-owner.conf','''[Service]
ExecStart=
ExecStart=/usr/bin/python3 /opt/gsa-tv/bin/night-production.py
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=GSA_PRODUCTION_OWNER=night-factory
WorkingDirectory=/opt/gsa-tv
KillMode=control-group
TimeoutStopSec=30
ExecStopPost=/opt/gsa-tv/bin/stop-production-renders.sh
''')
write('/etc/systemd/system/gsa-tv-production-deadline.service','''[Unit]
Description=End GSA TV production window without touching the broadcast
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl stop gsa-tv-night-factory.service
ExecStart=/opt/gsa-tv/bin/stop-production-renders.sh
''')
write('/etc/systemd/system/gsa-tv-production-deadline.timer','''[Unit]
Description=GSA TV production cutoff 05h59 Brasilia
[Timer]
OnCalendar=*-*-* 05:59:00 America/Sao_Paulo
Persistent=false
AccuracySec=1s
[Install]
WantedBy=timers.target
''')
write('/etc/systemd/system/gsa-tv-production-readiness.service','''[Unit]
Description=Check actual GSA TV schedule readiness
[Service]
Type=oneshot
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/python3 /opt/gsa-tv/bin/night-production.py --reconcile --require-ready
''')
write('/etc/systemd/system/gsa-tv-production-readiness.timer','''[Unit]
Description=GSA TV checkpoints 05h00, 05h30 and 05h50 Brasilia
[Timer]
OnCalendar=*-*-* 05:00:00 America/Sao_Paulo
OnCalendar=*-*-* 05:30:00 America/Sao_Paulo
OnCalendar=*-*-* 05:50:00 America/Sao_Paulo
Persistent=false
AccuracySec=1s
[Install]
WantedBy=timers.target
''')
# The installed release transmits through ffplayout; the old 9210 encoder is gone.
assert Path('/opt/gsa-tv/bin/night-controller.py').is_file()
write('/opt/gsa-tv/bin/gsa-tv-night-controller.sh','''#!/usr/bin/env bash
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin
exec /usr/bin/python3 /opt/gsa-tv/bin/night-controller.py "$@"
''',0o750)
write('/etc/systemd/system/gsa-tv-signoff.timer.d/96-window.conf','''[Timer]
OnCalendar=
OnCalendar=*-*-* 23:50:00 America/Sao_Paulo
Persistent=false
AccuracySec=1s
''')
subprocess.run(['bash','-n','/opt/gsa-tv/bin/gsa-tv-night-controller.sh'],check=True)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','gsa-tv-production-deadline.timer','gsa-tv-production-readiness.timer'],check=True)
subprocess.run(['systemctl','restart','gsa-tv-signoff.timer'],check=True)
(backup/'RESTORE.txt').write_text('Restore mirrored original files from this directory. Remove newly created 96-production-owner.conf and production-{deadline,readiness}.{service,timer}, stop/disable those timers and run systemctl daemon-reload. Do not restart broadcasting services. Older factory remains in the phase2 backup; restoring it also restores its known defects.\n')
print('BACKUP='+str(backup))
