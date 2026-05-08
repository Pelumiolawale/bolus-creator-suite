// api/instagram-demographics.js
// Audience demographics for the connected Instagram Business/Creator account.
// Returns age + gender split, top countries, top cities — the data brand
// partnerships actually want to see in a media kit.
//
// Endpoint reference: GET /{ig-user-id}/insights with metric=follower_demographics
// breakdown=age, gender, country, city respectively.
//
// Important: this requires a Business or Creator account (which Pels has) and the
// instagram_manage_insights scope on the token.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "INSTAGRAM_TOKEN environment variable not set" });
  }

  try {
    // Fetch four breakdowns in parallel — each is a separate API call because
    // Graph API only allows one breakdown dimension per request.
    const breakdowns = ["age", "gender", "country", "city"];
    const requests = breakdowns.map(b =>
      fetch(
        `https://graph.instagram.com/me/insights?metric=follower_demographics&period=lifetime&timeframe=last_90_days&breakdown=${b}&metric_type=total_value&access_token=${token}`
      ).then(r => r.json()).catch(err => ({ error: { message: err.message } }))
    );

    const [ageRes, genderRes, countryRes, cityRes] = await Promise.all(requests);

    function parseBreakdown(resp) {
      // Expected shape:
      // { data: [{ name: 'follower_demographics', total_value: { breakdowns: [{ results: [{ dimension_values: ['25-34'], value: 1234 }] }] } }] }
      try {
        const results = resp?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        return results.map(r => ({
          key: r.dimension_values?.[0] || "unknown",
          value: r.value || 0,
        })).sort((a, b) => b.value - a.value);
      } catch {
        return [];
      }
    }

    const age      = parseBreakdown(ageRes);
    const gender   = parseBreakdown(genderRes);
    const country  = parseBreakdown(countryRes);
    const city     = parseBreakdown(cityRes);

    // If all four came back empty AND any of them errored, surface the first error
    // so the frontend can show a helpful message (e.g. "needs instagram_manage_insights").
    const anyData = age.length || gender.length || country.length || city.length;
    if (!anyData) {
      const firstErr = [ageRes, genderRes, countryRes, cityRes]
        .find(r => r?.error)?.error?.message;
      if (firstErr) {
        return res.status(401).json({ error: firstErr });
      }
    }

    return res.status(200).json({
      age,
      gender,
      country: country.slice(0, 5),
      city: city.slice(0, 5),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
