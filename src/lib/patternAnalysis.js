// patternAnalysis.js
// Pure pattern analysis over posts returned from /api/instagram-insights.
// All metrics are normalised by reach where appropriate so we control for
// posts that simply got more eyeballs.

import { loadTags } from "./postTags.js";

// ── Per-post metrics ────────────────────────────────────────────────────────
// Save rate as % of reach. Why save rate (not absolute saves)? It controls
// for posts that simply got more reach. A post with 1000 saves on 100k reach
// is genuinely more "saveable" than 2000 saves on 500k reach.
function saveRate(post) {
  const reach = post.insights?.reach;
  const saves = post.insights?.saved;
  if (!reach || reach === 0 || saves == null) return null;
  return (saves / reach) * 100;
}

// eslint-disable-next-line no-unused-vars
function shareRate(post) {
  const reach = post.insights?.reach;
  const shares = post.insights?.shares;
  if (!reach || reach === 0 || shares == null) return null;
  return (shares / reach) * 100;
}

function reachOf(post) {
  return post.insights?.reach ?? null;
}

// ── Group + average ─────────────────────────────────────────────────────────
function groupAndAverage(posts, groupKeyFn, metricFn) {
  const groups = {};
  for (const p of posts) {
    const key = groupKeyFn(p);
    if (key == null) continue;
    const value = metricFn(p);
    if (value == null) continue;
    if (!groups[key]) groups[key] = { values: [] };
    groups[key].values.push(value);
  }
  const result = {};
  for (const [k, g] of Object.entries(groups)) {
    result[k] = {
      n: g.values.length,
      mean: g.values.reduce((s, v) => s + v, 0) / g.values.length,
    };
  }
  return result;
}

function confidenceFor(n) {
  if (n < 5)  return { confidence: "low",      label: "Too few posts" };
  if (n < 10) return { confidence: "early",    label: "Early signal"  };
  return            { confidence: "reliable", label: "Reliable signal" };
}

// ── Pattern functions — each returns the same shape ─────────────────────────

export function formatPattern(posts) {
  const groups = groupAndAverage(
    posts,
    p => p.media_product_type === "REELS"          ? "Reel"
       : p.media_type === "CAROUSEL_ALBUM"          ? "Carousel"
       : p.media_type === "IMAGE"                   ? "Single Post"
       : p.media_type === "VIDEO"                   ? "Video"
       : null,
    saveRate,
  );
  return summariseGroups(groups, "save rate", "%");
}

export function dayPattern(posts) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const groups = groupAndAverage(
    posts,
    p => p.timestamp ? days[new Date(p.timestamp).getDay()] : null,
    reachOf,
  );
  return summariseGroups(groups, "reach", "");
}

export function timePattern(posts) {
  // NOTE: Instagram's `timestamp` is ISO-8601 UTC, but `new Date(...).getHours()`
  // returns the *viewer's* local hour, which for Pels is London time — exactly
  // what we want here. Don't "fix" this with manual UTC adjustment; the JS
  // engine already does the right thing.
  function bucket(hour) {
    if (hour >= 6  && hour < 11) return "Morning (6–11)";
    if (hour >= 11 && hour < 14) return "Midday (11–14)";
    if (hour >= 14 && hour < 17) return "Afternoon (14–17)";
    if (hour >= 17 && hour < 21) return "Evening (17–21)";
    return "Late (21–6)";
  }
  const groups = groupAndAverage(
    posts,
    p => p.timestamp ? bucket(new Date(p.timestamp).getHours()) : null,
    reachOf,
  );
  return summariseGroups(groups, "reach", "");
}

export function captionPattern(posts) {
  const groups = groupAndAverage(
    posts,
    p => {
      const len = (p.caption || "").length;
      if (len < 100) return "Short (<100)";
      if (len < 300) return "Medium (100–300)";
      return "Long (>300)";
    },
    saveRate,
  );
  return summariseGroups(groups, "save rate", "%");
}

export function territoryPattern(posts) {
  // Look up category from the tag store keyed by the post's shortcode.
  // Permalinks look like /p/{shortcode}/, /reel/{shortcode}/, /tv/{shortcode}/
  const tags = loadTags();
  function shortcodeOf(post) {
    const m = (post.permalink || "").match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }
  const groups = groupAndAverage(
    posts,
    p => {
      const sc = shortcodeOf(p);
      return sc && tags[sc] ? tags[sc].category : null;
    },
    saveRate,
  );
  return summariseGroups(groups, "save rate", "%");
}

// ── Common summary shape ────────────────────────────────────────────────────
// Returns { rows, best, worst, headline, insufficient, reason, metricLabel, unit }
function summariseGroups(groups, metricLabel, unit) {
  const rows = Object.entries(groups)
    .map(([name, g]) => ({ name, n: g.n, mean: g.mean, ...confidenceFor(g.n) }))
    .sort((a, b) => b.mean - a.mean);

  const reliable = rows.filter(r => r.confidence !== "low");
  if (reliable.length < 2) {
    return {
      rows,
      headline: null,
      insufficient: true,
      reason: rows.length === 0
        ? "No data yet — keep posting and check back."
        : "Not enough posts in any group yet — keep posting and check back.",
      metricLabel,
      unit,
    };
  }
  const best  = reliable[0];
  const worst = reliable[reliable.length - 1];
  const ratio = worst.mean > 0 ? best.mean / worst.mean : null;
  return {
    rows,
    best,
    worst,
    headline: ratio
      ? `${best.name} outperforms ${worst.name} by ${ratio.toFixed(1)}× on ${metricLabel}`
      : `${best.name} leads on ${metricLabel}`,
    insufficient: false,
    metricLabel,
    unit,
  };
}
