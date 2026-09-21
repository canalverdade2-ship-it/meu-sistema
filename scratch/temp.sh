ffmpeg -nostdin -y -ss 45 -i /opt/gsa-tv/cache/media/1/program-masters/gsa-sabor-master-1080p.mp4 -frames:v 1 /tmp/def_sabor_b1.jpg
ffmpeg -nostdin -y -ss 945 -i /opt/gsa-tv/cache/media/1/program-masters/gsa-sabor-master-1080p.mp4 -frames:v 1 /tmp/def_sabor_b2.jpg
ffmpeg -nostdin -y -ss 1845 -i /opt/gsa-tv/cache/media/1/program-masters/gsa-sabor-master-1080p.mp4 -frames:v 1 /tmp/def_sabor_b3.jpg
ffmpeg -nostdin -y -ss 2745 -i /opt/gsa-tv/cache/media/1/program-masters/gsa-sabor-master-1080p.mp4 -frames:v 1 /tmp/def_sabor_b4.jpg
ls -lh /tmp/def_sabor_*.jpg
