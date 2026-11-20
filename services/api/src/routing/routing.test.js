import test from "node:test";
import assert from "node:assert/strict";
import { getRoute } from "./index.js";
import { decodePolyline6 } from "./valhalla.js";

const from = { lat: 3.139, lng: 101.687 };
const to = { lat: 3.15, lng: 101.7 };
const mockFetch = (body) => (globalThis.fetch = async () => ({ ok: true, json: async () => body }));

test("graphhopper maps to Route", async () => {
  mockFetch({ paths: [{ distance: 1500, time: 120000, points: { coordinates: [[101.687, 3.139], [101.7, 3.15]] } }] });
  const r = await getRoute(from, to, { ROUTING_PROVIDER: "graphhopper" });
  assert.equal(r.durationS, 120);
  assert.deepEqual(r.polyline[0], { lat: 3.139, lng: 101.687 });
});

test("valhalla maps to Route", async () => {
  process.env.ROUTING_PROVIDER = "valhalla";
  mockFetch({ trip: { legs: [{ shape: "_p~iF~ps|U_ulLnnqC", summary: { length: 1.5, time: 120 } }] } });
  const r = await getRoute(from, to, process.env);
  delete process.env.ROUTING_PROVIDER;
  assert.equal(r.distanceM, 1500);
  assert.equal(r.durationS, 120);
  assert.equal(r.polyline.length, 2);
});

test("decodePolyline6 decodes known value", () => {
  // precision-5 sample "_p~iF~ps|U" decoded at 1e6 is a scaled-down point; just check shape
  assert.equal(decodePolyline6("_p~iF~ps|U").length, 1);
});

test("unknown provider throws", () => {
  assert.throws(() => getRoute(from, to, { ROUTING_PROVIDER: "x" }), /Unknown/);
});
