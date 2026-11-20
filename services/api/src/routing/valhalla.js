// Valhalla adapter. POST {url}/route with locations; shape is an encoded polyline (precision 6).
export function decodePolyline6(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let shift = 0, result = 0, b;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    out.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }
  return out;
}

export async function route(from, to, { url, profile = "auto" }) {
  const res = await fetch(`${url}/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      locations: [{ lat: from.lat, lon: from.lng }, { lat: to.lat, lon: to.lng }],
      costing: profile,
    }),
  });
  if (!res.ok) throw new Error(`valhalla ${res.status}`);
  const leg = (await res.json()).trip?.legs?.[0];
  if (!leg) throw new Error("valhalla: no route");
  return {
    polyline: decodePolyline6(leg.shape),
    distanceM: leg.summary.length * 1000, // Valhalla default unit is km
    durationS: leg.summary.time,
    incidentsOnRoute: [],
  };
}
