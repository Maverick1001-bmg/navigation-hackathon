// In-memory incident store (no DB). Shape per docs/CONTRACTS.md.
export const TYPES = ["accident", "police", "flood", "roadworks", "jam", "hazard"];
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

let seq = 0;
const incidents = [];

export function add({ type, location, note }, reportedAt = new Date(), confirmations = 0) {
  const i = { id: `inc-${++seq}`, type, location, reportedAt: reportedAt.toISOString(), confirmations };
  if (note) i.note = note;
  incidents.push(i);
  return i;
}

// Returns an error string, or null if the body is valid.
export function validate(b) {
  if (!b || !TYPES.includes(b.type)) return `type must be one of ${TYPES.join(", ")}`;
  const l = b.location;
  if (!l || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return "location must be { lat, lng } numbers";
  if (b.note !== undefined && typeof b.note !== "string") return "note must be a string";
  return null;
}

export function confirm(id) {
  const i = incidents.find((x) => x.id === id);
  if (i) i.confirmations += 1;
  return i;
}

// Hides reports older than 2 hours (seeded ones are stamped recent, so they stay visible at startup).
export function list(bbox) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return incidents.filter((i) => {
    if (Date.parse(i.reportedAt) < cutoff) return false;
    if (!bbox) return true;
    const { lat, lng } = i.location;
    return lng >= bbox[0] && lat >= bbox[1] && lng <= bbox[2] && lat <= bbox[3];
  });
}

export function parseBbox(s) {
  if (!s) return null;
  const b = s.split(",").map(Number);
  return b.length === 4 && b.every(Number.isFinite) ? b : undefined; // undefined = malformed
}

const mins = (m) => new Date(Date.now() - m * 60000);
export function seed() {
  const S = [
    ["jam", 3.1187, 101.6772, "Heavy traffic, Federal Highway near Mid Valley", 12, 4],
    ["jam", 3.1569, 101.7123, "Slow near KLCC, Jalan Ampang", 25, 2],
    ["jam", 3.1390, 101.6869, "Jalan Sultan Hishamuddin, KL Sentral area", 8, 6],
    ["flood", 3.1678, 101.7043, "Flash flood, Kampung Baru", 18, 9],
    ["flood", 3.1204, 101.6620, "Water on road, Bangsar", 40, 3],
    ["roadworks", 3.1668, 101.7228, "Lane closed, Jalan Tun Razak", 55, 5],
    ["roadworks", 3.1510, 101.6958, "Resurfacing, Jalan Raja Chulan", 70, 1],
    ["roadworks", 3.1045, 101.6710, "Roadworks, Jalan Pantai Baharu", 90, 0],
    ["police", 3.1015, 101.6931, "Roadblock, Sprint Expressway", 10, 7],
    ["police", 3.1790, 101.6840, "Police checkpoint, Jalan Kuching", 30, 2],
    ["police", 3.1433, 101.7120, "Speed trap, Jalan Pinang", 15, 3],
    ["accident", 3.1330, 101.6540, "Two cars, Jalan Klang Lama", 6, 5],
    ["accident", 3.1745, 101.6990, "Motorbike down, Jalan Tuanku Abdul Rahman", 22, 2],
    ["accident", 3.1250, 101.7180, "Collision, Jalan Cheras", 35, 4],
    ["hazard", 3.1470, 101.6760, "Debris on road, Jalan Travers", 14, 1],
    ["hazard", 3.1600, 101.6700, "Broken traffic light, Jalan Tun Sambanthan", 48, 6],
    ["hazard", 3.1130, 101.7010, "Pothole, Jalan Syed Putra", 100, 0],
    ["jam", 3.1900, 101.7110, "Stop-and-go, Jalan Genting Klang", 20, 3],
  ];
  for (const [type, lat, lng, note, ago, confirmations] of S) add({ type, location: { lat, lng }, note }, mins(ago), confirmations);
}

// Distance in metres from point p to the polyline; Infinity if fewer than 2 points.
export function distanceToLineM(p, line) {
  const k = 111320, cos = Math.cos((p.lat * Math.PI) / 180);
  const xy = (q) => [(q.lng - p.lng) * k * cos, (q.lat - p.lat) * k];
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = xy(line[i - 1]), [bx, by] = xy(line[i]);
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function onRoute(polyline, maxM = 50) {
  return list().filter((i) => distanceToLineM(i.location, polyline) <= maxM).map((i) => i.id);
}
