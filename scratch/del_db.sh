#!/bin/bash
docker exec gsa-tv-control-plane psql -U postgres -d gsa_tv -c "DELETE FROM gsa_tv_media_items WHERE internal_name LIKE 'gsa-mundo-%';"
