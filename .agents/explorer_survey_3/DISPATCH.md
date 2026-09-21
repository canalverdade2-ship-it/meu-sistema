## 2026-08-28T14:13:12Z
Investigate Requirement R4 in `server_webhook_vps_live.cjs` and `server_webhook.cjs`:
1. SERVICE_ROLE_JWT fallback:
   - Check around line ~2902 in both files. Analyze how JWT is resolved, what fallback is missing or broken.
2. Race condition on simultaneous messages / concurrency per phone/session:
   - Check around line ~9153 in both files. Analyze message handling flow and propose a robust `SessionMutex` or in-memory Promise queue keyed by phone/session ID to serialize incoming messages for the same phone/session without blocking other users.
3. Atomic points conversion (RMW - Read-Modify-Write):
   - Check around line ~4990 in both files. Analyze how points are read, modified, and written. Propose an atomic strategy (e.g. Supabase RPC / SQL atomic decrement/increment or mutex lock).
4. File parity:
   - Compare `server_webhook_vps_live.cjs` and `server_webhook.cjs` to determine differences and ensure changes are correctly coordinated across both.
