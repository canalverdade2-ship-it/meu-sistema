BEGIN;

DROP INDEX IF EXISTS public.gsa_tv_jobs_one_active_per_type;

CREATE UNIQUE INDEX gsa_tv_jobs_one_active_per_type
  ON public.gsa_tv_jobs(channel_id, job_type)
  WHERE status IN ('pending', 'running')
    AND job_type <> 'probe_media';

COMMIT;
