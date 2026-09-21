select bucket_key, attempt_count, window_started_at, blocked_until, updated_at
from public.gsa_auth_rate_limits
where updated_at > now() - interval '15 minutes'
order by updated_at desc;
