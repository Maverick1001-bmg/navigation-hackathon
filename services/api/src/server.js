// API: /api/health, /api/route, /api/incidents (see docs/CONTRACTS.md)
import http from "node:http";
import { pathToFileURL } from "node:url";
import { getRoute } from "./routing/index.js";
import * as incidents from "./incidents.js";

const parse = (s) => {
  const [lat, lng] = (s ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e5) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
  });

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const path = url.pathname;
  try {
    if (path === "/api/health" && req.method === "GET") {
      return send(200, { ok: true, routing: process.env.ROUTING_PROVIDER ?? "graphhopper" });
    }

    if (path === "/api/route" && req.method === "GET") {
      const from = parse(url.searchParams.get("from"));
      const to = parse(url.searchParams.get("to"));
      if (!from || !to) return send(400, { error: "from and to must be lat,lng" });
      let route;
      try {
        route = await getRoute(from, to);
      } catch (e) {
        return send(502, { error: e.message });
      }
      route.incidentsOnRoute = incidents.onRoute(route.polyline);
      return send(200, route);
    }

    if (path === "/api/incidents" && req.method === "GET") {
      const bbox = incidents.parseBbox(url.searchParams.get("bbox"));
      if (bbox === undefined) return send(400, { error: "bbox must be minLng,minLat,maxLng,maxLat" });
      return send(200, incidents.list(bbox));
    }

    if (path === "/api/incidents" && req.method === "POST") {
      const body = await readJson(req);
      const err = incidents.validate(body);
      if (err) return send(400, { error: err });
      return send(201, incidents.add(body));
    }

    const m = path.match(/^\/api\/incidents\/([^/]+)\/confirm$/);
    if (m && req.method === "POST") {
      const i = incidents.confirm(m[1]);
      return i ? send(200, i) : send(404, { error: "incident not found" });
    }

    send(404, { error: "not found" });
  } catch (e) {
    send(400, { error: e.message });
  }
});

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  incidents.seed();
  const port = Number(process.env.PORT ?? 8080);
  server.listen(port, () => console.log(`api on :${port}, routing=${process.env.ROUTING_PROVIDER ?? "graphhopper"}`));
}
