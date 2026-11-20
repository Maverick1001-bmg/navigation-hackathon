import test from "node:test";
import assert from "node:assert/strict";
import { server } from "./server.js";
import * as inc from "./incidents.js";

const listen = () => new Promise((r) => server.listen(0, () => r(`http://localhost:${server.address().port}`)));

test("incidents API: seed, create, confirm, validate, bbox, CORS", async () => {
  inc.seed();
  const base = await listen();
  const j = (p, o) => fetch(base + p, o).then(async (r) => [r.status, await r.json().catch(() => null), r]);
  const post = (p, b) => j(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

  let [s, all] = await j("/api/incidents");
  assert.equal(s, 200);
  assert.ok(all.length >= 15);
  [s, all] = await j("/api/incidents?bbox=0,0,1,1");
  assert.equal(all.length, 0);
  assert.equal((await j("/api/incidents?bbox=bad"))[0], 400);

  const [cs, created] = await post("/api/incidents", { type: "jam", location: { lat: 3.14, lng: 101.69 }, note: "x" });
  assert.equal(cs, 201);
  const [, confirmed] = await post(`/api/incidents/${created.id}/confirm`);
  assert.equal(confirmed.confirmations, 1);
  assert.equal((await post("/api/incidents/nope/confirm"))[0], 404);
  assert.equal((await post("/api/incidents", { type: "cow", location: { lat: 1, lng: 1 } }))[0], 400);
  assert.equal((await post("/api/incidents", { type: "jam", location: { lat: "a", lng: 1 } }))[0], 400);

  const [hs, h] = await j("/api/health");
  assert.equal(hs, 200);
  assert.equal(h.ok, true);
  const opt = await fetch(base + "/api/incidents", { method: "OPTIONS" });
  assert.equal(opt.status, 204);
  assert.match(opt.headers.get("access-control-allow-headers"), /content-type/);
  server.close();
});

test("onRoute finds incidents within 50 m of the line", () => {
  const line = [{ lat: 3.1, lng: 101.6 }, { lat: 3.1, lng: 101.7 }];
  assert.ok(inc.distanceToLineM({ lat: 3.1002, lng: 101.65 }, line) < 25);
  assert.ok(inc.distanceToLineM({ lat: 3.11, lng: 101.65 }, line) > 1000);
});
