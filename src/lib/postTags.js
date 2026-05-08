// postTags.js
// Stores post-level metadata that the Instagram API doesn't expose:
// the user's own classification of each post into a content category.
// Keyed by Instagram media ID so it survives across calendar resets,
// account refreshes, and future API changes.

const KEY = "bcs.postTags.v1";

export function loadTags() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function getTag(mediaId) {
  return loadTags()[mediaId] || null;
}

export function setTag(mediaId, category) {
  if (!mediaId) return;
  const tags = loadTags();
  if (!category) {
    delete tags[mediaId];
  } else {
    tags[mediaId] = { category, taggedAt: new Date().toISOString() };
  }
  localStorage.setItem(KEY, JSON.stringify(tags));
  return tags;
}

export function setManyTags(mediaIdToCategory) {
  // Bulk write — used by the retroactive tagging UI.
  const tags = loadTags();
  const now = new Date().toISOString();
  for (const [id, cat] of Object.entries(mediaIdToCategory)) {
    if (cat) tags[id] = { category: cat, taggedAt: now };
  }
  localStorage.setItem(KEY, JSON.stringify(tags));
  return tags;
}

const MIGRATIONS_KEY = "bcs.postTags.migrations.v1";

export function runMigrations() {
  let applied = [];
  try {
    applied = JSON.parse(localStorage.getItem(MIGRATIONS_KEY) || "[]");
  } catch { applied = []; }

  // Migration 1.4.1a — rename "Real Estate" → "Home / Property"
  if (!applied.includes("1.4.1a")) {
    const tags = loadTags();
    let changed = false;
    for (const id of Object.keys(tags)) {
      if (tags[id]?.category === "Real Estate") {
        tags[id] = { ...tags[id], category: "Home / Property" };
        changed = true;
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(tags));
    applied.push("1.4.1a");
  }

  localStorage.setItem(MIGRATIONS_KEY, JSON.stringify(applied));
}

// Returns { totalTagged, byCategory: { [cat]: count }, percentages: { [cat]: pct } }
export function computeCategoryBreakdown(allCategories) {
  const tags = loadTags();
  const tagged = Object.values(tags);
  const byCategory = {};
  for (const cat of allCategories) byCategory[cat] = 0;
  for (const t of tagged) {
    if (byCategory[t.category] !== undefined) byCategory[t.category] += 1;
  }
  const total = tagged.length;
  const percentages = {};
  for (const cat of allCategories) {
    percentages[cat] = total > 0 ? (byCategory[cat] / total) * 100 : 0;
  }
  return { totalTagged: total, byCategory, percentages };
}
