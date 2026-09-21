sudo -n -u postgres psql -p 5433 -d gsahub -Atc "SELECT pg_get_function_result(oid) FROM pg_proc WHERE proname='gsa_validate_session';"
