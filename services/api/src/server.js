// Minimal API: GET /api/route?from=lat,lng&to=lat,lng -> Route (see docs/CONTRACTS.md)
import http from "node:http";
import { getRoute } from "./routing/index.js";

const parse = (s) => {
  const [lat, lng] = (s ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("content-type", "application/json");
  if (url.pathname !== "/api/route") {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "not found" }));
  }
  const from = parse(url.searchParams.get("from"));
  const to = parse(url.searchParams.get("to"));
  if (!from || !to) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "from and to must be lat,lng" }));
  }
  try {
    res.end(JSON.stringify(await getRoute(from, to)));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: e.message }));
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8080);
  server.listen(port, () => console.log(`api on :${port}, routing=${process.env.ROUTING_PROVIDER ?? "graphhopper"}`));
}
