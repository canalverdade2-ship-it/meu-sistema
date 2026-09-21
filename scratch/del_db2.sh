#!/bin/bash
docker exec evo-postgres psql -U postgres -d gsa_tv -c "DELETE FROM gsa_tv_media_items WHERE internal_name LIKE 'gsa-mundo-%';"
