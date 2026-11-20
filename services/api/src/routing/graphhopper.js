// GraphHopper adapter. GET {url}/route?point=lat,lng&point=lat,lng&profile=car&points_encoded=false
export async function route(from, to, { url, profile = "car" }) {
  const q = new URLSearchParams({ profile, points_encoded: "false", instructions: "false" });
  q.append("point", `${from.lat},${from.lng}`);
  q.append("point", `${to.lat},${to.lng}`);
  const res = await fetch(`${url}/route?${q}`);
  if (!res.ok) throw new Error(`graphhopper ${res.status}`);
  const path = (await res.json()).paths?.[0];
  if (!path) throw new Error("graphhopper: no route");
  return {
    polyline: path.points.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceM: path.distance,
    durationS: path.time / 1000, // GraphHopper time is in ms
    incidentsOnRoute: [],
  };
}
