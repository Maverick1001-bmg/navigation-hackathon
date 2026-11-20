// GraphHopper adapter. GET {url}/route?point=lat,lng&point=lat,lng&profile=car&points_encoded=false
export async function route(from, to, { url, profile = "car" }) {
  const q = new URLSearchParams({ profile, points_encoded: "false", instructions: "true" });
  q.append("point", `${from.lat},${from.lng}`);
  q.append("point", `${to.lat},${to.lng}`);
  const res = await fetch(`${url}/route?${q}`);
  if (!res.ok) throw new Error(`graphhopper ${res.status}`);
  const path = (await res.json()).paths?.[0];
  if (!path) throw new Error("graphhopper: no route");
  const polyline = path.points.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const steps = (path.instructions ?? []).map((i) => ({
    text: i.text,
    distanceM: i.distance,
    durationS: i.time / 1000, // ms -> s
    location: polyline[i.interval[0]] ?? polyline[0],
  }));
  return {
    polyline,
    distanceM: path.distance,
    durationS: path.time / 1000, // GraphHopper time is in ms
    incidentsOnRoute: [],
    steps,
  };
}
