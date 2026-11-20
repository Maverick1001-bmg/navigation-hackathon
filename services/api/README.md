# services/api

Routing API. `GET /api/route?from=lat,lng&to=lat,lng` returns a `Route` (see `docs/CONTRACTS.md`).
Switch engines with `ROUTING_PROVIDER=graphhopper|valhalla` (default graphhopper). `npm start` serves on :8080.

## Data (gitignored, in `data/`)
Put an OSM extract at `data/malaysia-singapore-brunei.osm.pbf` (Geofabrik, ODbL), and
copy it to `data/valhalla/` for Valhalla.

## GraphHopper (:8989) — needs Java 17+
    curl -L -o data/graphhopper-web-11.1.jar https://github.com/graphhopper/graphhopper/releases/download/11.1/graphhopper-web-11.1.jar
    java -Xmx3g -jar data/graphhopper-web-11.1.jar server engines/graphhopper/config.yml
First start imports the data (~2 min for Malaysia); later starts are fast.

## Valhalla (:8002) — needs Docker
    docker compose -f engines/valhalla/docker-compose.yml up -d
First start builds tiles (~15 min for Malaysia, ~3 GB RAM); later starts are fast.

## Switches
`ROUTING_PROVIDER=graphhopper|valhalla`, `INCIDENTS=off` (disable incident reports: GET returns [], POST returns 403).
