token=$(sudo grep ENCODER_ENGINE_TOKEN /opt/gsa-tv/control-plane/.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status
echo ""
