curl -s -o /dev/null -w 'loopback private %{http_code}\n' http://127.0.0.1:9095/uploads/private/client-docs/audit-placeholder.pdf
curl -s -o /dev/null -w 'TLS private %{http_code}\n' https://api.147-15-43-141.nip.io/uploads/private/client-docs/audit-placeholder.pdf
curl -s -o /dev/null -w 'TLS invalid bearer %{http_code}\n' -H 'Authorization: Bearer invalid-audit-token' https://api.147-15-43-141.nip.io/uploads/private/client-docs/audit-placeholder.pdf
