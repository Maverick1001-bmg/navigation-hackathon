// Pick the routing engine at runtime: ROUTING_PROVIDER=graphhopper|valhalla
// Both return the shared `Route` shape from docs/CONTRACTS.md.
import * as graphhopper from "./graphhopper.js";
import * as valhalla from "./valhalla.js";

const providers = {
  graphhopper: { impl: graphhopper, url: () => process.env.GRAPHHOPPER_URL ?? "http://localhost:8989" },
  valhalla: { impl: valhalla, url: () => process.env.VALHALLA_URL ?? "http://localhost:8002" },
};

export function getRoute(from, to, env = process.env) {
  const name = env.ROUTING_PROVIDER ?? "graphhopper";
  const p = providers[name];
  if (!p) throw new Error(`Unknown ROUTING_PROVIDER "${name}" (use graphhopper or valhalla)`);
  return p.impl.route(from, to, { url: p.url() });
}
