sudo cp /opt/gsa-tv/fallback/gsa-tv-fallback-1080p30.mp4 /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4
sudo cp /opt/gsa-tv/fallback/gsa-tv-continuity-1080p30.mp4 /opt/gsa-tv/fallback/gsa-tv-continuity-720p30.mp4
sudo cp /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-1080p30.mp4 /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4
sudo cp /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-1080p30.mp4 /opt/gsa-tv/cache/media/1/identity/gsa-tv-fallback-720p30.mp4
sudo chown oracle-cloud-agent-updater:gsa-tv /opt/gsa-tv/cache/media/1/identity/gsa-tv-*-720p30.mp4
sudo chown root:docker /opt/gsa-tv/fallback/gsa-tv-*-720p30.mp4
ls -la /opt/gsa-tv/fallback/
