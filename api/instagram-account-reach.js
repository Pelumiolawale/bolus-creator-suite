// api/instagram-account-reach.js
// Account-level reach over a time window, broken down by follow_type
// (FOLLOWER vs NON_FOLLOWER). Per-post `reach` with breakdown=follow_type is
// rejected by the Graph API ("Incompatible breakdowns"), but the account-level
// /me/insights endpoint supports it on `reach` with period=day. Sum across the
// window to derive non-follower %.
//
// Query: GET /api/instagram-account-reach?days=90
// Returns: { days, since, until, followerReach, nonFollowerReach, totalReach, nonFollowerPct }
//
// Non-follower % powers the Media Kit's "Why Brands Work With Me" bullet.
// If the API errors (token scope, account type), the endpoint returns 200 with
// nulls — the consumer omits the tile rather than fakes a number.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "INSTAGRAM_TOKEN environment variable not set" });
  }

  // Cap days to avoid pulling huge windows. 90 is what the Media Kit headline
  // strip uses; allow up to 365 in case we surface different windows later.
  const days = Math.min(Math.max(parseInt(req.query.days || "90", 10), 1), 365);
  const now = new Date();
  const until = Math.floor(now.getTime() / 1000);
  const since = Math.floor(now.getTime() / 1000) - days * 24 * 60 * 60;

  try {
    const url = `https://graph.instagram.com/me/insights?metric=reach&period=day&since=${since}&until=${until}&breakdown=follow_type&metric_type=total_value&access_token=${token}`;
    const r = await fetch(url);
    const j = await r.json();

    if (j.error) {
      return res.status(200).json({
        days,
        since: new Date(since * 1000).toISOString(),
        until: new Date(until * 1000).toISOString(),
        followerReach: null,
        nonFollowerReach: null,
        totalReach: null,
        nonFollowerPct: null,
        error: j.error.message,
      });
    }

    // Expected shape: data[0].total_value.breakdowns[0].results[]
    // with dimension_values: ["FOLLOWER"] or ["NON_FOLLOWER"].
    const results = j?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
    let followerReach = null;
    let nonFollowerReach = null;
    for (const x of results) {
      const dim = x.dimension_values?.[0];
      if (dim === "FOLLOWER")     followerReach    = x.value ?? null;
      if (dim === "NON_FOLLOWER") nonFollowerReach = x.value ?? null;
    }
    const totalReach = (followerReach ?? 0) + (nonFollowerReach ?? 0);
    const nonFollowerPct = totalReach > 0 && nonFollowerReach != null
      ? +(nonFollowerReach / totalReach * 100).toFixed(1)
      : null;

    return res.status(200).json({
      days,
      since: new Date(since * 1000).toISOString(),
      until: new Date(until * 1000).toISOString(),
      followerReach,
      nonFollowerReach,
      totalReach: totalReach || null,
      nonFollowerPct,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
