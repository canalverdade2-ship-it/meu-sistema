PGPASSWORD=GSA_SENHA_FORTE_2026 psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -tAc "SELECT status, data_pagamento FROM faturas WHERE codigo_fatura = 'FAT-FB17E81CC3';"
