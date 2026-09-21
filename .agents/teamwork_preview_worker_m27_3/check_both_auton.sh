#!/usr/bin/env bash
ls -l /opt/gsa-tv/bin/autonomous-script.cjs /opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs
diff -u /opt/gsa-tv/bin/autonomous-script.cjs /opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs || true
