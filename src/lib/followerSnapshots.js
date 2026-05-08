// followerSnapshots.js
// Stores { date: 'YYYY-MM-DD', count: number } entries in localStorage.
// Seeded once with known historical anchors; auto-appends a daily snapshot
// every time the dashboard loads.

const KEY = "bcs.followerSnapshots.v1";
const SEED_KEY = "bcs.followerSnapshots.seeded.v1";

const SEED_SNAPSHOTS = [
  { date: "2025-09-08", count: 4000  },
  { date: "2026-02-07", count: 10000 },
  { date: "2026-03-09", count: 14000 },
  { date: "2026-04-08", count: 17000 },
];

export function loadSnapshots() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Run once per device — installs the seed values if no snapshots exist yet.
// Idempotent: never overwrites real snapshots once they've started accruing.
export function seedIfEmpty() {
  if (localStorage.getItem(SEED_KEY)) return; // already seeded on this device
  const existing = loadSnapshots();
  if (existing.length > 0) {
    // Snapshots exist but the seed flag was cleared — leave existing data alone.
    localStorage.setItem(SEED_KEY, "1");
    return;
  }
  const sorted = [...SEED_SNAPSHOTS].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(KEY, JSON.stringify(sorted));
  localStorage.setItem(SEED_KEY, "1");
}

// Append today's snapshot. Deduped: only one snapshot per calendar day.
export function saveSnapshot(count) {
  if (typeof count !== "number" || count <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const snapshots = loadSnapshots().filter(s => s.date !== today);
  snapshots.push({ date: today, count });
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  // Bound storage at 365 entries
  const trimmed = snapshots.slice(-365);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
  return trimmed;
}

// Returns { pct, basis } where basis is the snapshot used for comparison,
// or { insufficient: true, daysCollected } if we don't have enough history.
export function computeGrowth(currentCount, daysBack) {
  const snapshots = loadSnapshots();
  if (snapshots.length === 0) return { insufficient: true, daysCollected: 0 };

  const target = new Date();
  target.setDate(target.getDate() - daysBack);
  const targetTs = target.getTime();

  // Acceptable window scales with the period being compared.
  // Daily-ish windows for 30-day, wider for longer periods.
  const windowDays = daysBack <= 30 ? 7 : daysBack <= 90 ? 14 : 30;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const candidates = snapshots
    .map(s => ({ ...s, ts: new Date(s.date).getTime() }))
    .filter(s => Math.abs(s.ts - targetTs) <= windowMs);

  if (candidates.length === 0) {
    const oldest = new Date(snapshots[0].date).getTime();
    const daysCollected = Math.floor((Date.now() - oldest) / (24 * 60 * 60 * 1000));
    return { insufficient: true, daysCollected };
  }

  candidates.sort((a, b) => Math.abs(a.ts - targetTs) - Math.abs(b.ts - targetTs));
  const basis = candidates[0];
  if (basis.count === 0) return { insufficient: true, daysCollected: 0 };
  const pct = ((currentCount - basis.count) / basis.count) * 100;
  return { pct, basis };
}
