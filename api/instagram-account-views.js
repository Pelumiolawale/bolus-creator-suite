// api/instagram-account-views.js
// Account-level views over a time window. This is what IG's app shows as
// "Views (last N days)" — total views received across all content (Reels,
// Feed, Carousels) during the window, regardless of when each piece was
// published. Replaces the old per-post-lifetime-sum approach, which under-
// counted by missing views that older posts accrued during the window.
//
// Query: GET /api/instagram-account-views?days=90
// Returns: { days, since, until, totalViews, fetchedAt }
//
// If the API rejects or the metric is unavailable, returns 200 with
// totalViews: null so the consumer can render "—" instead of a fake number.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "INSTAGRAM_TOKEN environment variable not set" });
  }

  const days = Math.min(Math.max(parseInt(req.query.days || "90", 10), 1), 365);
  const now = new Date();
  const until = Math.floor(now.getTime() / 1000);
  const since = until - days * 24 * 60 * 60;

  try {
    const url = `https://graph.instagram.com/me/insights?metric=views&period=day&since=${since}&until=${until}&metric_type=total_value&access_token=${token}`;
    const r = await fetch(url);
    const j = await r.json();

    if (j.error) {
      return res.status(200).json({
        days,
        since: new Date(since * 1000).toISOString(),
        until: new Date(until * 1000).toISOString(),
        totalViews: null,
        error: j.error.message,
      });
    }

    // Two possible response shapes:
    //   A (preferred): data[0].total_value.value — single aggregated number.
    //   B (fallback):  data[0].values[]          — daily entries; sum .value.
    const node = j?.data?.[0];
    let totalViews = node?.total_value?.value ?? null;
    if (totalViews == null && Array.isArray(node?.values)) {
      totalViews = node.values.reduce((s, v) => s + (v?.value || 0), 0);
    }

    return res.status(200).json({
      days,
      since: new Date(since * 1000).toISOString(),
      until: new Date(until * 1000).toISOString(),
      totalViews: totalViews ?? null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
