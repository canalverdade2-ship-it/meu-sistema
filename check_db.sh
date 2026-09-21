#!/bin/bash
docker exec -e PGPASSWORD=GSA_SENHA_FORTE_2026 evo-postgres psql -h 172.17.0.1 -p 5433 -U supabase_admin -d gsahub -c "SELECT id, media_item_id FROM gsa_tv_program_blocks WHERE id = '0f2f9292-a83b-462b-aab7-b09cbff27b8a';"
docker exec -e PGPASSWORD=GSA_SENHA_FORTE_2026 evo-postgres psql -h 172.17.0.1 -p 5433 -U supabase_admin -d gsahub -c "SELECT id, duration_s, drive_path, state, approval_state FROM gsa_tv_media_items WHERE id = 'media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf';"
