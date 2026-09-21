# Upload service authentication remediation

Applied to `/home/opc/gsa-upload-service/server.cjs` on the VPS.
Backup: `server.cjs.before-auth-fix-20260913` alongside the service.
Reproduction/application script: `scratch/fix-vps-upload-auth.sh` (one-shot backup guard).
Verification script: `scratch/verify-vps-upload-auth.sh`.

The previous upload authentication returned true without credentials and accepted any nonempty Bearer token. DELETE did not invoke authentication.

Both operations now require a database-validated GSA session or a JWT verified against the local GoTrue `/user` endpoint. Validation failures deny access. Syntax check passed; PM2 restarted successfully. Live loopback probes returned 401 for anonymous and invalid-Bearer requests to both routes (four checks), and health returned 200. Probes used empty path lists; no user file was deleted.

Not yet proved: valid-user end-to-end upload/delete, per-file ownership authorization, protection of existing private files served through `/uploads`, private-file viewing and PDF sharing. Authentication alone does not resolve those issues. The active service currently writes uploads under `/var/www/uploads` and reports them public even for private prefixes. Treat this as an urgent remaining issue; do not certify document privacy based on this patch.

## Private reads follow-up

The Nginx `/uploads/private/` location now proxies to an authenticated handler instead of the public static alias. The helper source is `infrastructure/upload/private-files.cjs`; it was installed beside the active upload service. Nginx backup: `/etc/nginx/nginx.conf.before-private-20260913`. Service backup: `server.cjs.before-private-read-20260913`. Both syntax checks passed and services reloaded. After reload, loopback anonymous, public TLS anonymous and public TLS invalid-Bearer probes returned 401.

The handler binds valid sessions to an actor, allows administrators and matching owners in supported client/provider scopes, rejects path traversal and symlink escape, and sends no-store responses. Five ownership checks passed locally. Cross-scope collaborators and relationship-based access still require explicit implementation and verification.

Local frontend `getPrivateR2Url` now sends authentication in headers and returns a temporary blob URL. It does not fall back after a 403. Nine combined private-read/deletion tests passed. This frontend change is not deployed. Legacy direct URLs still need routing through the authenticated viewer. Positive authenticated end-to-end access remains unverified. Private upload metadata, per-file write/delete ownership, R2 authorization and PDF sharing remain open.
