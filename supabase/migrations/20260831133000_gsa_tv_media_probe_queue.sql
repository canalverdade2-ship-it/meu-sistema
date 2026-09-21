BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_tv_enqueue_media_probe()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.state='processing' AND (TG_OP='INSERT' OR OLD.state IS DISTINCT FROM NEW.state OR OLD.drive_path IS DISTINCT FROM NEW.drive_path) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.gsa_tv_jobs
      WHERE job_type='probe_media' AND status IN ('pending','running')
        AND payload->>'media_item_id'=NEW.id
    ) THEN
      INSERT INTO public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
      VALUES(NEW.channel_id,'probe_media','pending',0,jsonb_build_object('media_item_id',NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_tv_enqueue_media_probe ON public.gsa_tv_media_items;
CREATE TRIGGER trg_gsa_tv_enqueue_media_probe
AFTER INSERT OR UPDATE OF state,drive_path ON public.gsa_tv_media_items
FOR EACH ROW EXECUTE FUNCTION public.gsa_tv_enqueue_media_probe();

REVOKE ALL ON FUNCTION public.gsa_tv_enqueue_media_probe() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_tv_enqueue_media_probe() TO service_role;

COMMIT;
