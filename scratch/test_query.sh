docker run --rm --net host -i postgres:15 psql postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub -c "
SELECT 
  pb.id,
  pb.planned_start_offset_s,
  pb.planned_duration_s,
  p.name as program_name,
  pb.block_type,
  pb.media_item_id,
  m.drive_path
FROM public.gsa_tv_program_blocks pb
LEFT JOIN public.gsa_tv_programs p ON pb.program_id = p.id
LEFT JOIN public.gsa_tv_media_items m ON pb.media_item_id = m.id
WHERE pb.schedule_version_id = 'a59eb44c-332f-4663-9018-9f1f3fdccced'
ORDER BY pb.planned_start_offset_s;
"
