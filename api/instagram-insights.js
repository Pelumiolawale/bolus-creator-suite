// api/instagram-insights.js
// Per-post insights: reach, saves, shares, total interactions, views (Reels).
// Combines /me/media with a /{media-id}/insights call per post.
//
// Notes on metric availability (as of Graph API v22+):
//  - reach, saves, shares, total_interactions, likes, comments: Feed posts, Reels, Carousels
//  - views: Reels only (the legacy video_views metric was deprecated for non-Reels in Jan 2025)
//  - profile_views: deprecated at the post level — only available account-level over time windows
//
// We request a permissive metric set per post type. If the Graph API rejects a metric for a
// given post type it returns an error block that we silently swallow per-post; the dashboard
// still gets every metric the post does support.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "INSTAGRAM_TOKEN environment variable not set" });
  }

  // How many recent posts to analyse. Keep small to stay within rate limits.
  const LIMIT = Math.min(parseInt(req.query.limit || "12", 10), 25);

  try {
    // 1. Get the recent media list (with permalink + thumbnail so we can render cards)
    const mediaRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=${LIMIT}&access_token=${token}`
    );
    const mediaData = await mediaRes.json();
    if (mediaData.error) {
      return res.status(401).json({ error: mediaData.error.message, code: mediaData.error.code });
    }

    const posts = mediaData.data || [];

    // 2. For each post, fetch its insights. Run in parallel.
    //    Different post types support different metric sets — we request a sensible
    //    union and tolerate per-post errors gracefully.
    const insightsPromises = posts.map(async post => {
      // Pick metrics by media_product_type:
      //   REELS -> reach, saves, shares, total_interactions, views, likes, comments
      //   FEED  -> reach, saves, shares, total_interactions, likes, comments
      //   STORY -> reach, replies (we don't request these here; usually expired)
      const isReel = post.media_product_type === "REELS";
      const metrics = isReel
        ? "reach,saved,shares,total_interactions,views,likes,comments"
        : "reach,saved,shares,total_interactions,likes,comments";

      try {
        const r = await fetch(
          `https://graph.instagram.com/${post.id}/insights?metric=${metrics}&access_token=${token}`
        );
        const j = await r.json();
        if (j.error) return { ...post, insightsError: j.error.message };

        // Flatten the insight values into a single object: { reach: 1234, saved: 22, ... }
        const flat = {};
        (j.data || []).forEach(metric => {
          // Each metric returns an array of values; first entry is the lifetime/total value.
          flat[metric.name] = metric.values?.[0]?.value ?? null;
        });

        return { ...post, insights: flat };
      } catch (err) {
        return { ...post, insightsError: err.message };
      }
    });

    const enriched = await Promise.all(insightsPromises);

    // 3. Compute a "performance score" per post for sorting.
    //    Saves + shares weighted heavily because Pels' strategy explicitly tracks these
    //    as the algorithm-friendly metrics. Tweak weights here if priorities change.
    const scored = enriched.map(p => {
      const i = p.insights || {};
      const score =
        (i.saved || 0) * 3 +
        (i.shares || 0) * 3 +
        (i.total_interactions || 0) * 1 +
        (i.reach || 0) * 0.01;
      return { ...p, performanceScore: Math.round(score) };
    });

    // 4. Sort by score (descending) — top performers first.
    scored.sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0));

    return res.status(200).json({
      posts: scored,
      analysed: scored.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
