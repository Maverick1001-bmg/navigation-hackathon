#!/usr/bin/env bash
# Roadmap step 1: download the Malaysia/Singapore/Brunei OSM extract from Geofabrik (EU/German host).
# Data © OpenStreetMap contributors (ODbL).
set -euo pipefail
cd "$(dirname "$0")/../data"
URL="https://download.geofabrik.de/asia/malaysia-singapore-brunei/malaysia-singapore-brunei-latest.osm.pbf"
curl -fL -C - -o malaysia-singapore-brunei.osm.pbf "$URL"
ls -lh malaysia-singapore-brunei.osm.pbf
