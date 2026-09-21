#!/bin/bash

# Fix 2: B-Roll Missing Media
cat << 'EOF' > /tmp/gsa-broll-downloader.sh
#!/bin/bash
CATEGORIES=("agro" "cidades" "economia" "tecnologia" "saude" "natureza" "esportes" "geral")
URL="https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4"

TMP_FILE="/tmp/broll_sample.mp4"
echo "Downloading base video from $URL..."
wget -q -c -O "$TMP_FILE" "$URL"

for CAT in "${CATEGORIES[@]}"; do
  DIR="/opt/gsa-tv/cache/media/1/broll/$CAT/raw"
  mkdir -p "$DIR"
  echo "Copying video for $CAT to $DIR/archive_video.mp4"
  cp "$TMP_FILE" "$DIR/archive_video.mp4"
done
echo "All broll videos downloaded and populated."
EOF

sudo mv /tmp/gsa-broll-downloader.sh /opt/gsa-tv/bin/gsa-broll-downloader.sh
sudo chmod +x /opt/gsa-tv/bin/gsa-broll-downloader.sh
sudo chown opc:opc /opt/gsa-tv/bin/gsa-broll-downloader.sh

echo "Running the downloader:"
/opt/gsa-tv/bin/gsa-broll-downloader.sh

# Verify files were placed
ls -la /opt/gsa-tv/cache/media/1/broll/*/raw/archive_video.mp4
