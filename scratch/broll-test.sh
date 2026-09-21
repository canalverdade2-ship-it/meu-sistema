#!/bin/bash
curl -s "https://archive.org/metadata/Allyson_Green_and_Marisa_Benasutti_Campus_Kitchen_-_ZERO_WASTE_SUMMIT_2016" | jq -r '.files[] | select(.name | endswith(".mp4")) | .name' | head -n 1
