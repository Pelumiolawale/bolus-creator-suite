// api/instagram.js
// Vercel serverless function — proxies Instagram Graph API calls server-side
// so CORS is never an issue for the frontend dashboard.

export default async function handler(req, res) {
  // Allow requests from any origin (your dashboard)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const token = process.env.INSTAGRAM_TOKEN;

  if (!token) {
    return res.status(500).json({ error: "INSTAGRAM_TOKEN environment variable not set" });
  }

  try {
    // Fetch profile: followers, post count, username
    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,followers_count,media_count,biography,website&access_token=${token}`
    );
    const profile = await profileRes.json();

    if (profile.error) {
      return res.status(401).json({ error: profile.error.message, code: profile.error.code });
    }

    // Fetch recent media for engagement calculation
    const mediaRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,like_count,comments_count,timestamp,media_type&limit=20&access_token=${token}`
    );
    const mediaData = await mediaRes.json();

    // Calculate engagement rate from recent posts
    let engagementRate = null;
    if (mediaData.data && mediaData.data.length > 0 && profile.followers_count) {
      const totalEngagement = mediaData.data.reduce((sum, post) => {
        return sum + (post.like_count || 0) + (post.comments_count || 0);
      }, 0);
      const avgEngagement = totalEngagement / mediaData.data.length;
      engagementRate = ((avgEngagement / profile.followers_count) * 100).toFixed(2);
    }

    return res.status(200).json({
      username: profile.username,
      followers: profile.followers_count,
      mediaCount: profile.media_count,
      biography: profile.biography,
      website: profile.website,
      engagementRate: engagementRate ? parseFloat(engagementRate) : null,
      postsAnalysed: mediaData.data?.length ?? 0,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
