
ssh -o StrictHostKeyChecking=no -i "C:\Users\Adriano Farias\Downloads\CLOUD\ssh-key-2026-07-30.key" opc@147.15.43.141 "sudo systemctl daemon-reload; sudo systemctl restart gsa-webhook; sleep 2; sudo systemctl status gsa-webhook --no-pager"

