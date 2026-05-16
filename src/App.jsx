import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { seedIfEmpty, saveSnapshot, computeGrowth } from "./lib/followerSnapshots.js";
import { loadTags, setTag, computeCategoryBreakdown, runMigrations as runPostTagMigrations } from "./lib/postTags.js";
import { formatPattern, dayPattern, timePattern, captionPattern, territoryPattern } from "./lib/patternAnalysis.js";

// ── Google Fonts ─────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ── Design tokens — Salmon + Cream ───────────────────────────────────────────
const T = {
  bg: "#FAF4ED",
  card: "#FFFFFF",
  cardHover: "#FDF8F2",
  border: "#E8DDD0",
  borderStrong: "#D8C8B5",
  salmon: "#E8896E",
  salmonLight: "#F2A98C",
  salmonDim: "rgba(232,137,110,0.12)",
  text: "#2A2420",
  textSoft: "#6B5D52",
  muted: "#9A8B7E",
  navy: "#3C5A6B",
  finance: "#C97B5C",
  lifestyle: "#9C7B4A",
  community: "#7A8B6B",
  relationships: "#8E6F8E",
  positive: "#5C8B6F",
  warn: "#C28A4E",
};

const T_dealTypeColor = {
  Paid: T.salmon,
  Affiliate: T.community,
  "Gifted + Paid": T.warn,
  Gifted: T.lifestyle,
};

const INITIAL_DEALS = { inbound: [], negotiating: [], active: [], completed: [] };

const CATEGORIES = ["Home / Property", "Finance", "Lifestyle", "Community", "Relationships"];
const CATEGORY_COLORS = {
  "Home / Property": T.navy,
  Finance: T.finance,
  Lifestyle: T.lifestyle,
  Community: T.community,
  Relationships: T.relationships,
};

const NAV = [
  { id: "audience",   label: "Audience",       icon: "◈" },
  { id: "deals",      label: "Brand Deals",    icon: "◆" },
  { id: "calendar",   label: "Content",        icon: "▦" },
  { id: "patterns",   label: "What's Working", icon: "✺" },
  { id: "money",      label: "Monetisation",   icon: "◎" },
  { id: "mediakit",   label: "Media Kit",      icon: "✦" },
];

const INITIAL_POSTS = {};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const fmtGBP = n => `£${Number(n).toLocaleString()}`;
const fmtPct = n => `${(n).toFixed(1)}%`;

// Calendar-store migrations. Lives next to the calendar's localStorage key so
// a failure in postTag migrations doesn't block calendar migrations and vice
// versa. Keep idempotent: each migration tag runs at most once per device.
const CALENDAR_KEY = "bcs.posts.v1";
const CALENDAR_MIGRATIONS_KEY = "bcs.posts.migrations.v1";

function runCalendarMigrations() {
  let applied = [];
  try {
    applied = JSON.parse(localStorage.getItem(CALENDAR_MIGRATIONS_KEY) || "[]");
  } catch { applied = []; }

  // Migration 1.4.1b — rename calendar entries' category "Real Estate" → "Home / Property"
  if (!applied.includes("1.4.1b")) {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(CALENDAR_KEY) || "null"); }
    catch { raw = null; }
    if (raw && typeof raw === "object") {
      let changed = false;
      for (const monthKey of Object.keys(raw)) {
        const month = raw[monthKey];
        if (!month || typeof month !== "object") continue;
        for (const day of Object.keys(month)) {
          const entry = month[day];
          if (entry && entry.category === "Real Estate") {
            month[day] = { ...entry, category: "Home / Property" };
            changed = true;
          }
        }
      }
      if (changed) localStorage.setItem(CALENDAR_KEY, JSON.stringify(raw));
    }
    applied.push("1.4.1b");
  }

  localStorage.setItem(CALENDAR_MIGRATIONS_KEY, JSON.stringify(applied));
}

// Pull a stable post identifier (the shortcode) out of either a permalink
// or a raw shortcode. Returns null if the input is unrecognisable.
function parseInstagramMediaId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const m = trimmed.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

// Determine what to show in the post-type badge for the tagger.
function postTypeLabel(post) {
  if (post.media_product_type === "REELS") return "Reel";
  if (post.media_type === "CAROUSEL_ALBUM") return "Carousel";
  if (post.media_type === "VIDEO") return "Video";
  return "Single Post";
}

function useStored(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ }
  }, [key, val]);
  return [val, setVal];
}

// ── Shared UI components ──────────────────────────────────────────────────────
function Tag({ children, color }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 3,
      background: color + "22", color, border: `1px solid ${color}55`,
    }}>{children}</span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 22px", transition: "border-color 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.salmon + "66"; e.currentTarget.style.boxShadow = `0 4px 14px ${T.salmonDim}`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: accent || T.text, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function GrowthCard({ label, growth, target }) {
  if (!growth || growth.insufficient) {
    return (
      <StatCard
        label={label}
        value="—"
        sub={`Tracking… ${growth?.daysCollected ?? 0}/${target} days`}
        accent={T.muted}
      />
    );
  }
  const sign = growth.pct >= 0 ? "+" : "";
  return (
    <StatCard
      label={label}
      value={`${sign}${growth.pct.toFixed(1)}%`}
      sub={`vs ${growth.basis.date}`}
      accent={growth.pct >= 0 ? T.positive : T.warn}
    />
  );
}

function SectionHeader({ title, sub, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 28 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: T.text, fontWeight: 700, margin: 0, marginBottom: 6 }}>{title}</h2>
      {sub && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.textSoft, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(42,36,32,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 32, width: 480, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(42,36,32,0.18)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", options }) {
  const s = { width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px", color: T.text, fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</label>
      {options
        ? <select value={value} onChange={e => onChange(e.target.value)} style={s}>{options.map(o => <option key={o}>{o}</option>)}</select>
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} style={s} />}
    </div>
  );
}

function SalmonBtn({ onClick, children, full, disabled, loading }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      background: disabled || loading ? T.border : `linear-gradient(135deg, ${T.salmon}, ${T.salmonLight})`,
      border: "none", borderRadius: 6, padding: "11px 20px",
      color: disabled || loading ? T.muted : "#FFFFFF",
      cursor: disabled || loading ? "not-allowed" : "pointer",
      fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13,
      width: full ? "100%" : "auto", letterSpacing: "0.03em",
      transition: "opacity 0.2s, transform 0.1s",
      boxShadow: disabled || loading ? "none" : `0 2px 8px ${T.salmonDim}`,
    }}
    onMouseEnter={e => !disabled && !loading && (e.currentTarget.style.transform = "translateY(-1px)")}
    onMouseLeave={e => (e.currentTarget.style.transform = "none")}
    >
      {loading ? "Working…" : children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Audience Overview
// ══════════════════════════════════════════════════════════════════════════════
function AudienceSection({ onIgData, onInsightsData, onInsightsLoad, onInsightsErr, onDemographicsData, onOpenTagger }) {
  const [ig, setIg]         = useState(null);
  const [igErr, setIgErr]   = useState("");
  const [loading, setLoading] = useState(true);

  const [insights, setInsights]       = useState(null);
  const [insightsErr, setInsightsErr] = useState("");
  const [insightsLoad, setInsightsLoad] = useState(true);

  const [demos, setDemos]     = useState(null);
  const [demosErr, setDemosErr] = useState("");
  const [demosLoad, setDemosLoad] = useState(true);

  useEffect(() => {
    fetch("/api/instagram")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setIg(data); if (onIgData) onIgData(data);
      })
      .catch(e => setIgErr(e.message))
      .finally(() => setLoading(false));

    if (onInsightsLoad) onInsightsLoad(true);
    fetch("/api/instagram-insights?limit=50")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setInsights(data); if (onInsightsData) onInsightsData(data);
      })
      .catch(e => {
        setInsightsErr(e.message);
        if (onInsightsErr) onInsightsErr(e.message);
      })
      .finally(() => {
        setInsightsLoad(false);
        if (onInsightsLoad) onInsightsLoad(false);
      });

    fetch("/api/instagram-demographics")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDemos(data); if (onDemographicsData) onDemographicsData(data);
      })
      .catch(e => setDemosErr(e.message))
      .finally(() => setDemosLoad(false));
  }, [onIgData, onInsightsData, onInsightsLoad, onInsightsErr, onDemographicsData]);

  const followers      = ig?.followers      ?? null;
  const mediaCount     = ig?.mediaCount     ?? "—";
  const username       = ig?.username       ?? "bybolutife";

  // Persist a daily snapshot once we have a real follower count.
  useEffect(() => {
    if (typeof followers === "number" && followers > 0) saveSnapshot(followers);
  }, [followers]);

  const g30 = followers !== null ? computeGrowth(followers, 30) : null;
  const g60 = followers !== null ? computeGrowth(followers, 60) : null;
  const g90 = followers !== null ? computeGrowth(followers, 90) : null;

  // Global time-window selector for the Audience tab. Default 30 — matches
  // what Pels checks in the IG app most often. State only (no persistence) —
  // a reload back to 30 days is the simpler behaviour and the brief was
  // explicit about that.
  const [windowDays, setWindowDays] = useState(30);

  const allPosts = insights?.posts || [];
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  const postsInWindow = allPosts.filter(p => p.timestamp && new Date(p.timestamp).getTime() >= cutoff);
  const allowedIds = new Set(postsInWindow.map(p => p.id));
  const dataLimited = postsInWindow.length < 12;

  // Engagement rate, recomputed client-side from the windowed posts so it
  // tracks the selector. Falls back to the server's "last 20 posts" number
  // if we have no windowed posts at all (cold start).
  let engagementRate = null;
  if (postsInWindow.length > 0 && followers) {
    const totalEng = postsInWindow.reduce((s, p) => s + (p.like_count || 0) + (p.comments_count || 0), 0);
    const avgEng = totalEng / postsInWindow.length;
    engagementRate = +(avgEng / followers * 100).toFixed(2);
  } else if (ig?.engagementRate != null) {
    engagementRate = ig.engagementRate;
  }

  const reachPosts = postsInWindow.filter(p => p.insights?.reach != null);
  const avgReach = reachPosts.length
    ? Math.round(reachPosts.reduce((s, p) => s + p.insights.reach, 0) / reachPosts.length)
    : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <SectionHeader
          title="Audience Overview"
          sub={ig ? `@${username} · Live from Instagram` : "Connecting to Instagram…"}
          noMargin
        />
        <div>
          {loading  && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>Fetching live data…</span>}
          {!loading && !igErr && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.positive }}>● Live · Instagram</span>}
          {!loading && igErr  && <span title={igErr} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.warn }}>⚠ {igErr.slice(0, 60)}</span>}
        </div>
      </div>

      {/* Time-window selector — scopes top posts, categories, engagement rate.
          Growth tiles and demographics are deliberately not affected (see brief). */}
      <TimeWindowSelector
        value={windowDays}
        onChange={setWindowDays}
        postCount={postsInWindow.length}
        dataLimited={dataLimited && allPosts.length > 0}
      />

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Followers"  value={loading ? "…" : (followers !== null ? fmt(followers) : "—")} sub={ig ? "Live · Instagram" : "Connect Instagram"} accent={T.salmon} />
        <StatCard label="Total Posts"      value={loading ? "…" : String(mediaCount)} sub="Published media" accent={T.salmon} />
        <GrowthCard label="30-Day Growth"  growth={g30} target={30} />
        <GrowthCard label="60-Day Growth"  growth={g60} target={60} />
        <GrowthCard label="90-Day Growth"  growth={g90} target={90} />
        <StatCard
          label="Avg. Reach"
          value={avgReach === null ? "…" : fmt(avgReach)}
          sub={avgReach === null ? "Loading…" : `Avg of ${reachPosts.length} posts in window`}
        />
        <StatCard label="Engagement Rate"  value={loading ? "…" : (engagementRate !== null ? `${engagementRate}%` : "—")} sub={`Last ${windowDays} days · ${postsInWindow.length} posts`} accent={T.salmon} />
      </div>

      {/* Top performing posts — scoped to window */}
      <TopPerformingPosts insights={insights} insightsLoad={insightsLoad} insightsErr={insightsErr} postsInWindow={postsInWindow} windowDays={windowDays} />

      {/* Audience demographics — exempt from selector, snapshot of recent followers */}
      <DemographicsBlock demos={demos} demosLoad={demosLoad} demosErr={demosErr} />

      {/* Category breakdown — driven by user-tagged posts, scoped to window */}
      <CategoryBreakdownCard onOpenTagger={onOpenTagger} allowedMediaIds={allowedIds} windowDays={windowDays} />
    </div>
  );
}

// ── Time-window selector (Audience tab only) ─────────────────────────────────
const WINDOW_OPTIONS = [30, 60, 90, 180, 360];
function TimeWindowSelector({ value, onChange, postCount, dataLimited }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, padding: "10px 14px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Window</span>
        <select
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, padding: "5px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, cursor: "pointer" }}
        >
          {WINDOW_OPTIONS.map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: dataLimited ? T.warn : T.muted }}>
        {postCount} post{postCount === 1 ? "" : "s"} in window{dataLimited && " · data-limited (API returns ~50 most recent)"}
      </span>
    </div>
  );
}

// ── Content Category Breakdown — real percentages from tagged posts ──────────
function CategoryBreakdownCard({ onOpenTagger, allowedMediaIds, windowDays }) {
  const breakdown = computeCategoryBreakdown(CATEGORIES, allowedMediaIds);
  const { totalTagged, percentages } = breakdown;

  if (totalTagged === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginTop: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 12 }}>Content Category Breakdown</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.textSoft, lineHeight: 1.55, marginBottom: 18 }}>
          {windowDays
            ? `No tagged posts in the last ${windowDays} days. Widen the window or tag more recent posts.`
            : "No posts tagged yet. Tag your last 50 posts in 5 minutes to see your real category split."}
        </div>
        <SalmonBtn onClick={onOpenTagger}>Tag My Posts</SalmonBtn>
      </div>
    );
  }

  const lowSample = totalTagged < 5;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginTop: 16 }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 20 }}>
        Content Category Breakdown
        {windowDays && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, marginLeft: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Last {windowDays} days</span>}
      </div>
      {CATEGORIES.map(cat => {
        const pct = percentages[cat] || 0;
        const color = CATEGORY_COLORS[cat];
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text }}>{cat}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: T.border }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 1s ease" }} />
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 16, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: lowSample ? T.warn : T.muted, fontStyle: "italic" }}>
        {lowSample
          ? `Based on ${totalTagged} tagged post${totalTagged === 1 ? "" : "s"} in window — tag a few more for a more accurate picture.`
          : `Based on ${totalTagged} tagged posts in window.`}
      </div>
    </div>
  );
}

// ── Top Performing Posts (uses /api/instagram-insights) ──────────────────────
function TopPerformingPosts({ insights, insightsLoad, insightsErr, postsInWindow, windowDays }) {
  // Server already sorted by performance score; respect that ordering after filtering.
  const sourcePosts = postsInWindow ?? (insights?.posts || []);
  const top = sourcePosts.slice(0, 4);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text }}>Top Performing Posts</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, marginTop: 4 }}>
            Ranked by saves + shares — the metrics the algorithm rewards
            {windowDays && ` · Last ${windowDays} days`}
          </div>
        </div>
        {insights && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.positive }}>● {sourcePosts.length} of {insights.analysed} in window</span>}
      </div>

      {insightsLoad && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted, padding: "20px 0" }}>Loading post insights…</div>}
      {insightsErr && !insightsLoad && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.warn, padding: "12px 14px", background: T.salmonDim, borderRadius: 6 }}>
          ⚠ {insightsErr}
          <div style={{ fontSize: 11, color: T.textSoft, marginTop: 6 }}>If this says insufficient permissions, your token needs the <code>instagram_manage_insights</code> scope.</div>
        </div>
      )}
      {!insightsLoad && !insightsErr && top.length === 0 && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted, padding: "20px 0", fontStyle: "italic" }}>No posts analysed yet.</div>
      )}

      {top.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
          {top.map(p => {
            const i = p.insights || {};
            const captionPreview = (p.caption || "(no caption)").slice(0, 80) + (p.caption?.length > 80 ? "…" : "");
            const date = p.timestamp ? new Date(p.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
            return (
              <a key={p.id} href={p.permalink || "#"} target="_blank" rel="noopener noreferrer"
                 style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: 14, textDecoration: "none", color: "inherit", display: "block", transition: "border-color 0.2s, transform 0.15s" }}
                 onMouseEnter={e => { e.currentTarget.style.borderColor = T.salmon + "70"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                 onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <Tag color={T.salmon}>{p.media_product_type === "REELS" ? "Reel" : (p.media_type || "Post")}</Tag>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted }}>{date}</span>
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.text, lineHeight: 1.5, minHeight: 50, marginBottom: 12 }}>
                  {captionPreview}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 11 }}>
                  <div><span style={{ color: T.muted }}>Reach </span><span style={{ color: T.text, fontWeight: 600 }}>{i.reach != null ? fmt(i.reach) : "—"}</span></div>
                  <div><span style={{ color: T.muted }}>Saves </span><span style={{ color: T.salmon, fontWeight: 600 }}>{i.saved != null ? fmt(i.saved) : "—"}</span></div>
                  <div><span style={{ color: T.muted }}>Shares </span><span style={{ color: T.salmon, fontWeight: 600 }}>{i.shares != null ? fmt(i.shares) : "—"}</span></div>
                  <div><span style={{ color: T.muted }}>Likes </span><span style={{ color: T.text, fontWeight: 600 }}>{i.likes != null ? fmt(i.likes) : (p.like_count != null ? fmt(p.like_count) : "—")}</span></div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Demographics block (uses /api/instagram-demographics) ────────────────────
function DemographicsBlock({ demos, demosLoad, demosErr }) {
  const hasData = demos && (demos.age?.length || demos.gender?.length || demos.country?.length);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text }}>
            Audience Demographics
            <span title="Follower demographics are a snapshot from Instagram's Graph API and aren't affected by the window selector above." style={{ display: "inline-block", marginLeft: 8, width: 14, height: 14, borderRadius: "50%", border: `1px solid ${T.muted}`, color: T.muted, fontSize: 10, lineHeight: "12px", textAlign: "center", cursor: "help", fontFamily: "'DM Sans',sans-serif" }}>i</span>
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, marginTop: 4 }}>Recent followers · IG-provided snapshot (not affected by window)</div>
        </div>
        {hasData && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.positive }}>● Live</span>}
      </div>

      {demosLoad && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted, padding: "20px 0" }}>Loading demographics…</div>}
      {demosErr && !demosLoad && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.warn, padding: "12px 14px", background: T.salmonDim, borderRadius: 6 }}>
          ⚠ {demosErr}
          <div style={{ fontSize: 11, color: T.textSoft, marginTop: 6 }}>This requires the <code>instagram_manage_insights</code> scope on your token. If the error mentions permissions, regenerate the token in Meta Developer Portal with that scope enabled.</div>
        </div>
      )}

      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 24 }}>
          <DemoBars title="Age" rows={demos.age} />
          <GenderBars gender={demos.gender} />
          <DemoBars title="Top Countries" rows={demos.country} />
          <DemoBars title="Top Cities" rows={demos.city} />
        </div>
      )}
    </div>
  );
}

// IG's app reports gender as a share of (Men + Women), excluding the "Undisclosed"
// bucket the API returns as key "U". Including U in the denominator under-counted
// Women by ~17pp vs the IG app (66% vs 83.4%). Render M/F normalised to each
// other, and surface Undisclosed separately when it's material (>5%).
function splitGender(gender) {
  const find = k => (gender || []).find(g => g.key?.toUpperCase() === k)?.value || 0;
  const f = find("F"), m = find("M"), u = find("U");
  const grand = f + m + u;
  const bars = [];
  if (f) bars.push({ key: "Women", value: f });
  if (m) bars.push({ key: "Men", value: m });
  return { bars, undisclosedPct: grand ? (u / grand) * 100 : 0 };
}

function GenderBars({ gender }) {
  const { bars, undisclosedPct } = splitGender(gender);
  if (bars.length === 0) return null;
  return (
    <div>
      <DemoBars title="Gender" rows={bars} />
      {undisclosedPct > 5 && (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, marginTop: 4 }}>
          Undisclosed: {undisclosedPct.toFixed(1)}% (IG users who haven't set a gender)
        </div>
      )}
    </div>
  );
}

function DemoBars({ title, rows }) {
  if (!rows || rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + (r.value || 0), 0) || 1;
  return (
    <div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>{title}</div>
      {rows.slice(0, 6).map(r => {
        const pct = (r.value / total) * 100;
        return (
          <div key={r.key} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: T.text }}>{r.key}</span>
              <span style={{ color: T.salmon, fontWeight: 600 }}>{fmtPct(pct)}</span>
            </div>
            <div style={{ height: 4, background: T.border, borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.salmon}, ${T.salmonLight})`, borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Brand Deals Tracker
// ══════════════════════════════════════════════════════════════════════════════
const COL_ORDER = ["inbound", "negotiating", "active", "completed"];
const COLUMNS   = [{ id: "inbound", label: "Inbound" }, { id: "negotiating", label: "Negotiating" }, { id: "active", label: "Active" }, { id: "completed", label: "Completed" }];

function DealCard({ deal, colId, onMove, onDelete }) {
  const typeColor = T_dealTypeColor[deal.type] || T.salmon;
  return (
    <div
      style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "14px 16px", marginBottom: 10, transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.salmon + "70"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${T.salmonDim}`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: T.text }}>{deal.brand}</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: T.salmon, fontWeight: 600 }}>{fmtGBP(deal.value)}</div>
      </div>
      <div style={{ marginBottom: 10 }}><Tag color={typeColor}>{deal.type}</Tag></div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.textSoft, marginBottom: 8 }}>{deal.deliverables}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted }}>Due {deal.deadline || "—"}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {colId !== "inbound"   && <button onClick={() => onMove(deal.id, colId, -1)} style={{ background: T.border, border: "none", borderRadius: 4, color: T.textSoft, cursor: "pointer", padding: "2px 7px", fontSize: 12 }}>←</button>}
          {colId !== "completed" && <button onClick={() => onMove(deal.id, colId,  1)} style={{ background: T.salmonDim, border: "none", borderRadius: 4, color: T.salmon, cursor: "pointer", padding: "2px 7px", fontSize: 12 }}>→</button>}
          <button onClick={() => onDelete(deal.id, colId)} title="Delete" style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: "2px 5px", fontSize: 12 }}>✕</button>
        </div>
      </div>
    </div>
  );
}

function DealsSection() {
  const [deals, setDeals]    = useStored("bcs.deals.v1", INITIAL_DEALS);
  const [showModal, setShow] = useState(false);
  const [form, setForm]      = useState({ brand: "", type: "Paid", value: "", deliverables: "", deadline: "" });
  // Completion-date confirmation modal state.
  // Holds { id, fromCol, date } when a deal is being moved INTO Completed.
  const [pendingComplete, setPendingComplete] = useState(null);

  function applyMove(id, fromCol, toCol, patch) {
    setDeals(prev => {
      const card = prev[fromCol].find(d => d.id === id);
      if (!card) return prev;
      const updated = patch ? { ...card, ...patch } : card;
      return { ...prev, [fromCol]: prev[fromCol].filter(d => d.id !== id), [toCol]: [...prev[toCol], updated] };
    });
  }

  function moveCard(id, fromCol, dir) {
    const toCol = COL_ORDER[COL_ORDER.indexOf(fromCol) + dir];
    if (!toCol) return;
    if (toCol === "completed") {
      // Open the completion-date modal; don't move yet.
      const today = new Date().toISOString().slice(0, 10);
      setPendingComplete({ id, fromCol, date: today });
      return;
    }
    applyMove(id, fromCol, toCol);
  }

  function confirmComplete() {
    if (!pendingComplete) return;
    const { id, fromCol, date } = pendingComplete;
    applyMove(id, fromCol, "completed", { completedAt: date });
    setPendingComplete(null);
  }
  function deleteCard(id, col) {
    setDeals(prev => ({ ...prev, [col]: prev[col].filter(d => d.id !== id) }));
  }
  function addDeal() {
    if (!form.brand) return;
    setDeals(prev => ({ ...prev, inbound: [...prev.inbound, { id: `d${Date.now()}`, ...form, value: parseInt(form.value) || 0 }] }));
    setShow(false);
    setForm({ brand: "", type: "Paid", value: "", deliverables: "", deadline: "" });
  }

  const totalActive = (deals.active || []).reduce((s, d) => s + (d.value || 0), 0);
  const totalPipeline = COL_ORDER.reduce((s, c) => s + (deals[c] || []).reduce((ss, d) => ss + (d.value || 0), 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <SectionHeader title="Brand Deals Tracker" sub={`Pipeline value ${fmtGBP(totalPipeline)} · Active ${fmtGBP(totalActive)}`} noMargin />
        <SalmonBtn onClick={() => setShow(true)}>+ Add Deal</SalmonBtn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {COLUMNS.map(col => (
          <div key={col.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, minHeight: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{col.label}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, background: T.salmonDim, color: T.salmon, borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>{(deals[col.id] || []).length}</span>
            </div>
            {(deals[col.id] || []).map(deal => <DealCard key={deal.id} deal={deal} colId={col.id} onMove={moveCard} onDelete={deleteCard} />)}
            {(deals[col.id] || []).length === 0 && (
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, fontStyle: "italic", padding: "12px 4px" }}>No deals yet</div>
            )}
          </div>
        ))}
      </div>
      <Modal open={showModal} onClose={() => setShow(false)} title="New Brand Deal">
        <Input label="Brand Name"   value={form.brand}        onChange={v => setForm(f => ({ ...f, brand: v }))} />
        <Input label="Deal Type"    value={form.type}         onChange={v => setForm(f => ({ ...f, type: v }))}  options={["Paid", "Gifted", "Gifted + Paid", "Affiliate"]} />
        <Input label="Value (£)"    value={form.value}        onChange={v => setForm(f => ({ ...f, value: v }))} type="number" />
        <Input label="Deliverables" value={form.deliverables} onChange={v => setForm(f => ({ ...f, deliverables: v }))} />
        <Input label="Deadline"     value={form.deadline}     onChange={v => setForm(f => ({ ...f, deadline: v }))} type="date" />
        <SalmonBtn onClick={addDeal} full>Add to Pipeline</SalmonBtn>
      </Modal>

      <Modal open={!!pendingComplete} onClose={() => setPendingComplete(null)} title="When did this deal complete?">
        <div style={{ marginTop: -8, marginBottom: 14, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.textSoft, lineHeight: 1.5 }}>
          Used to track your earnings over time. Defaults to today — change if you got paid on a different date.
        </div>
        <Input
          label="Completion date"
          type="date"
          value={pendingComplete?.date || ""}
          onChange={v => setPendingComplete(p => p ? { ...p, date: v } : p)}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <SalmonBtn onClick={confirmComplete} full>Confirm</SalmonBtn>
          <button
            onClick={() => setPendingComplete(null)}
            style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, padding: "11px 20px" }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Content Calendar
// ══════════════════════════════════════════════════════════════════════════════
const STATUS_COLORS = { Posted: T.positive, Scheduled: T.salmon, Draft: T.muted };

function CalendarSection({ initialView = "calendar", onViewChange }) {
  const today = new Date();
  const [view, setView]           = useState(initialView); // 'calendar' | 'tagger'
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [posts, setPosts]         = useStored("bcs.posts.v1", INITIAL_POSTS);
  const [selected, setSel]        = useState(null);
  const [form, setForm]           = useState({ category: "Finance", platform: "Reel", caption: "", status: "Draft", instagramUrl: "" });

  // If the parent wants to change which view is shown (e.g. Audience CTA), reflect that here.
  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => { if (onViewChange) onViewChange(view); }, [view, onViewChange]);

  const days     = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthPosts = posts[monthKey] || {};
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

  function openDay(day) {
    setSel(day);
    const existing = monthPosts[day];
    setForm(existing
      ? { instagramUrl: "", ...existing }
      : { category: "Finance", platform: "Reel", caption: "", status: "Draft", instagramUrl: "" });
  }
  function save() {
    if (!form.caption) { setSel(null); return; }
    const mediaId = parseInstagramMediaId(form.instagramUrl);
    const entry = { ...form };
    if (mediaId) entry.instagramMediaId = mediaId;
    setPosts(p => ({ ...p, [monthKey]: { ...(p[monthKey] || {}), [selected]: entry } }));
    if (mediaId && form.category) setTag(mediaId, form.category);
    setSel(null);
  }
  function remove() {
    setPosts(p => {
      const m = { ...(p[monthKey] || {}) };
      delete m[selected];
      return { ...p, [monthKey]: m };
    });
    setSel(null);
  }
  function shiftMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  }
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  if (view === "tagger") {
    return <TagPostsView onDone={() => setView("calendar")} />;
  }

  // Flatten posts[monthKey][day] into a chronological list across all months.
  // Sort: drafts (no scheduled/posted date intent) at top, then dated entries
  // newest-first (so a post next month sits above one today, which sits above
  // one last week). Picked drafts-on-top per the brief's recommendation.
  const flatEntries = [];
  for (const [mKey, daysMap] of Object.entries(posts)) {
    const [yStr, mStr] = mKey.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    for (const [dStr, entry] of Object.entries(daysMap || {})) {
      const d = parseInt(dStr, 10);
      flatEntries.push({ ...entry, _year: y, _month: m, _day: d, _date: new Date(y, m, d) });
    }
  }
  flatEntries.sort((a, b) => {
    const aDraft = a.status === "Draft";
    const bDraft = b.status === "Draft";
    if (aDraft !== bDraft) return aDraft ? -1 : 1;
    return b._date - a._date;
  });

  function openEntryFromList(entry) {
    setViewYear(entry._year);
    setViewMonth(entry._month);
    setSel(entry._day);
    setForm({ instagramUrl: "", ...entry });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <SectionHeader title="Content Calendar" sub={`${monthName} — colour coded by category`} noMargin />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setView("tagger")} style={{ background: T.salmonDim, border: `1px solid ${T.salmon}55`, borderRadius: 6, padding: "6px 14px", color: T.salmon, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, marginRight: 6 }}>Tag My Posts</button>
          <button onClick={() => shiftMonth(-1)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>←</button>
          <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Today</button>
          <button onClick={() => shiftMonth(1)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>→</button>
        </div>
      </div>

      {flatEntries.length > 0 && (
        <EntriesList entries={flatEntries} onOpen={openEntryFromList} />
      )}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(CATEGORY_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: v }} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>{k}</span>
          </div>
        ))}
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, textAlign: "center", padding: "4px 0", letterSpacing: "0.05em" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            const post = day && monthPosts[day];
            return (
              <div key={i} onClick={() => day && openDay(day)} style={{
                minHeight: 70, borderRadius: 6, padding: 8, cursor: day ? "pointer" : "default",
                background: day ? (post ? CATEGORY_COLORS[post.category] + "1A" : T.bg) : "transparent",
                border: `1px solid ${day ? (post ? CATEGORY_COLORS[post.category] + "55" : T.border) : "transparent"}`,
                transition: "border-color 0.15s",
              }}
                onMouseEnter={e => day && (e.currentTarget.style.borderColor = T.salmon + "80")}
                onMouseLeave={e => day && (e.currentTarget.style.borderColor = post ? CATEGORY_COLORS[post.category] + "55" : T.border)}>
                {day && <>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: post ? T.text : T.textSoft, fontWeight: post ? 600 : 400, marginBottom: 4 }}>{day}</div>
                  {post && <>
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: CATEGORY_COLORS[post.category], marginBottom: 4 }} />
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.textSoft, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{post.caption}</div>
                    <div style={{ marginTop: 4, width: 8, height: 2, borderRadius: 1, background: STATUS_COLORS[post.status] }} />
                  </>}
                </>}
              </div>
            );
          })}
        </div>
      </div>
      <Modal open={!!selected} onClose={() => setSel(null)} title={selected ? `${monthName.split(" ")[0]} ${selected}, ${viewYear}` : ""}>
        <Input label="Category"          value={form.category}  onChange={v => setForm(f => ({ ...f, category: v }))}  options={CATEGORIES} />
        <Input label="Format"            value={form.platform}  onChange={v => setForm(f => ({ ...f, platform: v }))}  options={["Reel","Carousel","Single Post","Story"]} />
        <Input label="Caption / Concept" value={form.caption}   onChange={v => setForm(f => ({ ...f, caption: v }))} />
        <Input label="Instagram Post URL or ID" value={form.instagramUrl || ""} onChange={v => setForm(f => ({ ...f, instagramUrl: v }))} />
        <div style={{ marginTop: -10, marginBottom: 16, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, fontStyle: "italic", lineHeight: 1.5 }}>
          Optional — paste the Instagram URL of this post once published, so the dashboard can link your category to real performance data.
        </div>
        <Input label="Status"            value={form.status}    onChange={v => setForm(f => ({ ...f, status: v }))}    options={["Draft","Scheduled","Posted"]} />
        <div style={{ display: "flex", gap: 10 }}>
          <SalmonBtn onClick={save} full>Save</SalmonBtn>
          {monthPosts[selected] && <button onClick={remove} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Remove</button>}
        </div>
      </Modal>
    </div>
  );
}

// ── Chronological list of all calendar entries (sits above the month grid) ──
function EntriesList({ entries, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED = 6;
  const visible = expanded ? entries : entries.slice(0, COLLAPSED);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "16px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          All Entries · {entries.length}
        </div>
        {entries.length > COLLAPSED && (
          <button onClick={() => setExpanded(e => !e)} style={{ background: "none", border: "none", color: T.salmon, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}>
            {expanded ? "Show less" : `Show all (${entries.length})`}
          </button>
        )}
      </div>
      <div>
        {visible.map((e, i) => {
          const isDraft = e.status === "Draft";
          const isFuture = e._date > today;
          const dateLabel = e._date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          const color = CATEGORY_COLORS[e.category] || T.salmon;
          return (
            <div
              key={`${e._year}-${e._month}-${e._day}-${i}`}
              onClick={() => onOpen(e)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 2, transition: "background 0.15s" }}
              onMouseEnter={ev => { ev.currentTarget.style.background = T.bg; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, minWidth: 100, flexShrink: 0 }}>
                {isDraft ? "Draft" : dateLabel}
                {isFuture && !isDraft && <span style={{ marginLeft: 6, color: T.salmon, fontWeight: 600 }}>· upcoming</span>}
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, minWidth: 90, flexShrink: 0 }}>
                {e.category} · {e.platform}
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {e.caption || <span style={{ color: T.muted, fontStyle: "italic" }}>(no caption)</span>}
              </div>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[e.status] || T.muted, flexShrink: 0 }} title={e.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tag My Posts — retroactive categoriser for the last 50 published posts ───
function TagPostsView({ onDone }) {
  const [posts, setPosts]   = useState([]);
  const [loading, setLoad]  = useState(true);
  const [err, setErr]       = useState("");
  // Local mirror of localStorage so the UI updates without re-reading on every keystroke.
  const [tagMap, setTagMap] = useState(() => {
    const t = loadTags();
    const m = {};
    for (const [id, info] of Object.entries(t)) m[id] = info.category;
    return m;
  });
  // Per-row "Saved" badge timer.
  const [savedFlash, setSavedFlash] = useState({});

  useEffect(() => {
    fetch("/api/instagram-insights?limit=50")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setPosts(data.posts || []);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoad(false));
  }, []);

  function pickCategory(post, category) {
    // Use the shortcode parsed from the permalink as the stable identifier; fall
    // back to the API id if the permalink is missing for some reason.
    const id = parseInstagramMediaId(post.permalink) || post.id;
    if (!id) return;
    setTag(id, category || null);
    setTagMap(prev => ({ ...prev, [id]: category || undefined }));
    setSavedFlash(prev => ({ ...prev, [id]: Date.now() }));
    setTimeout(() => {
      setSavedFlash(prev => {
        if (prev[id] && Date.now() - prev[id] >= 1000) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return prev;
      });
    }, 1100);
  }

  const taggedCount = posts.reduce((n, p) => {
    const id = parseInstagramMediaId(p.permalink) || p.id;
    return id && tagMap[id] ? n + 1 : n;
  }, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <SectionHeader
          title="Tag My Posts"
          sub={loading ? "Loading your last 50 posts…" : `${taggedCount} of ${posts.length} tagged`}
          noMargin
        />
        <SalmonBtn onClick={onDone}>Done</SalmonBtn>
      </div>

      {err && (
        <div style={{ background: T.card, border: `1px solid ${T.warn}55`, borderRadius: 8, padding: "16px 20px", marginBottom: 18, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.warn }}>
          ⚠ {err}
        </div>
      )}

      {loading && !err && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 24px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted }}>
          Fetching posts from Instagram…
        </div>
      )}

      {!loading && !err && posts.length === 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 24px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted }}>
          No posts returned by Instagram.
        </div>
      )}

      {!loading && !err && posts.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          {posts.map(post => {
            const id = parseInstagramMediaId(post.permalink) || post.id;
            const currentCat = tagMap[id] || "";
            const thumb = post.thumbnail_url || post.media_url;
            const dateLabel = post.timestamp
              ? new Date(post.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "—";
            const captionPreview = (post.caption || "").slice(0, 80) + ((post.caption || "").length > 80 ? "…" : "");
            const showSaved = !!savedFlash[id];
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, minHeight: 80 }}>
                {thumb
                  ? <img src={thumb} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4, flexShrink: 0, background: T.bg }} />
                  : <div style={{ width: 60, height: 60, borderRadius: 4, flexShrink: 0, background: T.bg, border: `1px solid ${T.border}` }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Tag color={T.salmon}>{postTypeLabel(post)}</Tag>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted }}>{dateLabel}</span>
                  </div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {captionPreview || <span style={{ color: T.muted, fontStyle: "italic" }}>(no caption)</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {showSaved && (
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.positive, fontWeight: 600 }}>Saved</span>
                  )}
                  <select
                    value={currentCat}
                    onChange={e => pickCategory(post, e.target.value)}
                    style={{
                      background: T.bg, border: `1px solid ${currentCat ? CATEGORY_COLORS[currentCat] + "88" : T.border}`,
                      borderRadius: 6, padding: "8px 10px", color: T.text,
                      fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none", minWidth: 160,
                    }}
                  >
                    <option value="">— Untagged —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Monetisation
// ══════════════════════════════════════════════════════════════════════════════
const GOAL = 10000;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px 16px", boxShadow: `0 4px 12px ${T.salmonDim}` }}>
      <div style={{ fontFamily: "'Playfair Display',serif", color: T.text, marginBottom: 8 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: p.fill, marginBottom: 2 }}>{p.name}: £{p.value.toLocaleString()}</div>)}
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.salmon, marginTop: 6, fontWeight: 600 }}>Total: £{total.toLocaleString()}</div>
    </div>
  );
}

// Best-effort completion date for a deal:
//   v1.4.1+ deals carry an explicit completedAt
//   pre-v1.4.1 fall back to the deadline if present
//   anything else → null and gets dropped from the chart
function deriveCompletedAt(deal) {
  if (deal.completedAt) return deal.completedAt;
  if (deal.deadline)    return deal.deadline;
  return null;
}

function buildEarningsTrend(completedDeals, now = new Date()) {
  // Build the 6-month axis ending in `now`
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleString("en-GB", { month: "short" }),
      brandDeals: 0,
      affiliate: 0,
      ugc: 0,
    });
  }
  const byKey = Object.fromEntries(months.map(m => [m.key, m]));

  for (const d of completedDeals) {
    const dateStr = deriveCompletedAt(d);
    if (!dateStr) continue;
    const dt = new Date(dateStr);
    if (isNaN(dt)) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, "0")}`;
    const bucket = byKey[key];
    if (!bucket) continue; // outside the 6-month window
    const value = d.value || 0;
    if (d.type === "Paid" || d.type === "Gifted + Paid") bucket.brandDeals += value;
    else if (d.type === "Affiliate")                       bucket.affiliate  += value;
    else                                                    bucket.ugc        += value;
  }

  return months;
}

function MoneySection({ igData }) {
  const [deals] = useStored("bcs.deals.v1", INITIAL_DEALS);
  const completed = deals.completed || [];
  const earnedByType = completed.reduce((acc, d) => {
    const k = d.type === "Paid" || d.type === "Gifted + Paid" ? "brandDeals"
            : d.type === "Affiliate" ? "affiliate"
            : "ugc";
    acc[k] = (acc[k] || 0) + (d.value || 0);
    return acc;
  }, { brandDeals: 0, affiliate: 0, ugc: 0 });
  const monthTotal = earnedByType.brandDeals + earnedByType.affiliate + earnedByType.ugc;
  const pct = Math.min((monthTotal / GOAL) * 100, 100);

  return (
    <div>
      <SectionHeader title="Monetisation Dashboard" sub="Earnings tracked from your completed deals" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Brand Deals"   value={fmtGBP(earnedByType.brandDeals)} sub="Completed paid deals"  accent={T.salmon} />
        <StatCard label="Affiliate"     value={fmtGBP(earnedByType.affiliate)}   sub="Link commissions" />
        <StatCard label="UGC / Gifted"  value={fmtGBP(earnedByType.ugc)}         sub="Content licensing" />
        <StatCard label="Total Earned"  value={fmtGBP(monthTotal)}               sub={`vs ${fmtGBP(GOAL)} goal`} accent={T.positive} />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text }}>Monthly Goal Progress</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.salmon, fontWeight: 600 }}>{fmtGBP(monthTotal)} / {fmtGBP(GOAL)}</div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: T.border }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.salmon}, ${T.salmonLight})`, borderRadius: 4, transition: "width 1s ease" }} />
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, marginTop: 8 }}>{pct.toFixed(0)}% of goal · {fmtGBP(Math.max(0, GOAL - monthTotal))} remaining</div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 8 }}>6-Month Earnings Trend</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, marginBottom: 16, fontStyle: "italic" }}>Last 6 months — calculated from your completed deals.</div>
        {completed.length === 0 ? (
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.textSoft, lineHeight: 1.55, padding: "8px 0 4px" }}>
            No completed deals yet. As you mark deals complete on the Brand Deals tab, they'll appear here.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buildEarningsTrend(completed)} barCategoryGap="30%">
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v => `£${v / 1000}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: T.salmonDim }} />
              <Bar dataKey="brandDeals" stackId="a" fill={T.salmon}    name="Brand Deals" />
              <Bar dataKey="affiliate"  stackId="a" fill={T.community} name="Affiliate" />
              <Bar dataKey="ugc"        stackId="a" fill={T.lifestyle} name="UGC" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Media Kit (NEW — exportable to PDF)
// ══════════════════════════════════════════════════════════════════════════════
function MediaKitSection({ igData, insightsData, demosData }) {
  const kitRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [deals] = useStored("bcs.deals.v1", INITIAL_DEALS);
  const completedDeals = deals.completed || [];

  // Account-level reach with follow_type breakdown — drives the "Reach from
  // non-followers" headline tile and the "Why Brands Work With Me" bullet.
  // Per-post reach can't be broken down by follow_type (Graph API rejects it),
  // so we hit the account-level endpoint instead.
  const [accountReach, setAccountReach] = useState(null);
  useEffect(() => {
    fetch("/api/instagram-account-reach?days=90")
      .then(r => r.json())
      .then(setAccountReach)
      .catch(() => setAccountReach({ error: "fetch failed" }));
  }, []);

  // Top brands by total spend across completed deals — deduped by brand name so
  // a creator who's worked with the same brand twice gets one card with summed value.
  const byBrand = new Map();
  for (const d of completedDeals) {
    const key = (d.brand || "").trim();
    if (!key) continue;
    const existing = byBrand.get(key) || { brand: key, totalValue: 0, id: d.id };
    existing.totalValue += d.value || 0;
    byBrand.set(key, existing);
  }
  const topBrands = [...byBrand.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);

  const followers      = igData?.followers ?? null;
  const engagementRate = igData?.engagementRate ?? null;
  const username       = igData?.username ?? "bybolutife";

  const topPost = insightsData?.posts?.[0];

  // Window aggregations from per-post insights. The Media Kit uses fixed
  // windows (90d for reach/views, 30d for saves/shares) — these are
  // independent of the Audience tab's global window selector.
  const allPosts = insightsData?.posts || [];
  function sumIn(days, key) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const w = allPosts.filter(p => p.timestamp && new Date(p.timestamp).getTime() >= cutoff);
    let total = 0;
    let seen = false;
    for (const p of w) {
      const v = p.insights?.[key];
      if (v != null) { total += v; seen = true; }
    }
    return seen ? total : null;
  }
  const views90d  = sumIn(90, "views");
  const saves30d  = sumIn(30, "saved");
  const shares30d = sumIn(30, "shares");
  const reach90d  = accountReach?.totalReach ?? null;
  const nonFollowerPct = accountReach?.nonFollowerPct ?? null;

  // Demographic derivations for the audience profile sentence + the existing
  // women % calc. Everything traces back to /api/instagram-demographics — no
  // hardcoded values in the JSX.
  const _genderFind = k => (demosData?.gender || []).find(g => g.key?.toUpperCase() === k)?.value || 0;
  const _womenCount = _genderFind("F");
  const _menCount   = _genderFind("M");
  const womenPct = (_womenCount + _menCount) > 0
    ? Math.round((_womenCount / (_womenCount + _menCount)) * 100)
    : null;

  // UK %: country bucket lookup — IG returns ISO country codes ("GB" for UK).
  // Falls back through common variants so we don't miss the bucket if the API
  // shifts conventions.
  const countryTotal = (demosData?.country || []).reduce((s, c) => s + (c.value || 0), 0);
  const ukEntry = (demosData?.country || []).find(c => ["GB", "UK", "United Kingdom"].includes(c.key));
  const ukPct = ukEntry && countryTotal > 0 ? +(ukEntry.value / countryTotal * 100).toFixed(1) : null;

  // 25–44 share = (25-34 bucket + 35-44 bucket) / total ages.
  const ageTotal = (demosData?.age || []).reduce((s, a) => s + (a.value || 0), 0);
  const ageFind = k => (demosData?.age || []).find(a => a.key === k)?.value || 0;
  const age2544 = ageTotal > 0
    ? +((ageFind("25-34") + ageFind("35-44")) / ageTotal * 100).toFixed(1)
    : null;
  // 1-decimal women% for the Audience Profile sentence (whole-number womenPct
  // is still used elsewhere). Same source as womenPct; just different precision.
  const womenPctDecimal = (_womenCount + _menCount) > 0
    ? +(_womenCount / (_womenCount + _menCount) * 100).toFixed(1)
    : null;

  async function exportPDF() {
    if (!kitRef.current) return;
    setExporting(true);
    try {
      // Render the kit to canvas at 2x for crisp print quality
      const canvas = await html2canvas(kitRef.current, {
        scale: 2,
        backgroundColor: "#FAF4ED",
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pdfWidth  = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.height / canvas.width;
      const renderWidth  = pdfWidth - 40; // 20pt margin each side
      const renderHeight = renderWidth * imgRatio;

      let yPos = 20;
      let remaining = renderHeight;
      // If the kit is taller than one page, paginate
      if (renderHeight <= pdfHeight - 40) {
        pdf.addImage(imgData, "PNG", 20, 20, renderWidth, renderHeight);
      } else {
        // Slice across multiple pages
        const pageImgHeight = pdfHeight - 40;
        const sourcePxPerPdfPt = canvas.width / renderWidth;
        const pageSourceHeight = pageImgHeight * sourcePxPerPdfPt;
        let sourceY = 0;
        while (sourceY < canvas.height) {
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.min(pageSourceHeight, canvas.height - sourceY);
          const ctx = sliceCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
          const sliceData = sliceCanvas.toDataURL("image/png");
          const sliceRenderHeight = sliceCanvas.height / sourcePxPerPdfPt;
          if (sourceY > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", 20, 20, renderWidth, sliceRenderHeight);
          sourceY += pageSourceHeight;
        }
      }

      pdf.save(`ByBolutife-MediaKit-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <SectionHeader title="Media Kit" sub="One-click PDF for brand outreach. Auto-fills with live Instagram data." noMargin />
        <SalmonBtn onClick={exportPDF} loading={exporting} disabled={!igData}>
          {exporting ? "Exporting…" : "↓ Download PDF"}
        </SalmonBtn>
      </div>

      {/* The exportable card — wrapped in a container with the cream background so the PDF matches */}
      <div ref={kitRef} style={{ background: T.bg, padding: 32, borderRadius: 8, border: `1px solid ${T.border}` }}>

        {/* 1. Header */}
        <div style={{ borderBottom: `2px solid ${T.salmon}`, paddingBottom: 24, marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: T.text, fontWeight: 700, lineHeight: 1.1 }}>Bolu Faseun</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: T.salmon, marginTop: 6, letterSpacing: "0.04em" }}>UK Home and Finance Creator</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.textSoft, marginTop: 8 }}>
            @{username} · hello@bybolutife.com
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 16, color: T.textSoft, marginTop: 14, maxWidth: 540, lineHeight: 1.5 }}>
            Building a home and a life — one intentional decision at a time.
          </div>
        </div>

        {/* 2. Headline metrics strip — leads with what brands actually buy.
            Every number traces to a live API call; null shows "—" with no fake numbers. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
          {[
            { label: "Accounts reached (90 days)",      val: reach90d  != null ? fmt(reach90d)   : "—",
              note: reach90d  == null ? "Not returned by API" : null },
            { label: "Views (90 days)",                  val: views90d  != null ? fmt(views90d)   : "—",
              note: views90d  == null ? "Reels-only metric"  : null },
            { label: "Saves (30 days)",                  val: saves30d  != null ? fmt(saves30d)   : "—",
              note: saves30d  == null ? "No posts in window" : null },
            { label: "Reach from non-followers",         val: nonFollowerPct != null ? `${nonFollowerPct}%` : "—",
              note: nonFollowerPct == null ? "Account-level metric unavailable" : null },
          ].map(s => (
            <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "16px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.salmon, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
              {s.note && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: T.muted, marginTop: 4, fontStyle: "italic" }}>{s.note}</div>}
            </div>
          ))}
        </div>
        {/* Secondary line: followers · engagement · shares 30d */}
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.textSoft, marginBottom: 28, textAlign: "center" }}>
          {followers != null ? fmt(followers) : "—"} followers
          {" · "}
          {engagementRate != null ? `${engagementRate}%` : "—"} engagement
          {" · "}
          {shares30d != null ? fmt(shares30d) : "—"} shares (30 days)
        </div>

        {/* 3. Why Brands Work With Me */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "22px 26px", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.text, fontWeight: 700, marginBottom: 12 }}>Why Brands Work With Me</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, lineHeight: 1.65, marginBottom: 14 }}>
            I create high-trust content for women making intentional home, money and lifestyle decisions. My audience comes to me for honest, specific recommendations — not aspirational lifestyle content. That trust translates into discovery, saves and purchase intent.
          </div>
          <ul style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, lineHeight: 1.65, paddingLeft: 18, margin: 0 }}>
            {/* Bullet 1: live non-follower % when available; fall back to top-post-reach signal otherwise. */}
            {nonFollowerPct != null ? (
              <li><strong>{nonFollowerPct}% of my reach comes from people who don't follow me yet</strong> — my content travels.</li>
            ) : topPost?.insights?.reach != null ? (
              <li><strong>My top post in the last window reached {fmt(topPost.insights.reach)} accounts</strong> — discovery is the engine, not the follower count.</li>
            ) : null}
            <li><strong>Predominantly UK women aged 25–44</strong> — actively making home and financial decisions.</li>
            <li><strong>Unscripted, talking-to-camera content is my strongest format</strong> — it converts viewers to followers and followers to action.</li>
          </ul>
        </div>

        {/* 4. Audience profile — reframed copy with live numbers, gracefully omits clauses on missing data. */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Audience Profile</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, lineHeight: 1.6, marginBottom: 18 }}>
            Predominantly{ukPct != null ? ` UK-based (${ukPct}%)` : " UK-based"}
            {womenPctDecimal != null ? `, women (${womenPctDecimal}%)` : ", women"}
            {age2544 != null ? `, aged 25–44 (${age2544}% of total followers)` : ", aged 25–44"}
            . Engaged with home, property, money and intentional living content.
          </div>

          {/* Existing demographics breakdown chart — preserved below the new sentence */}
          {demosData && (demosData.age?.length || demosData.country?.length) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }}>
              <DemoBars title="Age" rows={demosData.age} />
              <DemoBars title="Top Cities" rows={demosData.city} />
            </div>
          )}
        </div>

        {/* 5. Content pillars — UNCHANGED per brief (positioning decisions handled separately) */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Brand Pillars</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {[
              { name: "Wealth",       desc: "Property, investing, career, earning power" },
              { name: "Lifestyle",    desc: "Home, design, peace, environment" },
              { name: "Relationships",desc: "Romantic alignment, friendships, standards" },
              { name: "Identity",     desc: "Confidence, boundaries, intentional choices" },
            ].map(p => (
              <div key={p.name} style={{ borderLeft: `3px solid ${T.salmon}`, paddingLeft: 12 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: T.text, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.textSoft, marginTop: 2 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Top performing post */}
        {topPost && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Top Performing Post</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, color: T.text, lineHeight: 1.55, marginBottom: 14, fontStyle: "italic" }}>
              "{(topPost.caption || "").slice(0, 180)}{topPost.caption?.length > 180 ? "…" : ""}"
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                { label: "Reach",  val: topPost.insights?.reach != null ? fmt(topPost.insights.reach) : "—" },
                { label: "Saves",  val: topPost.insights?.saved != null ? fmt(topPost.insights.saved) : "—" },
                { label: "Shares", val: topPost.insights?.shares != null ? fmt(topPost.insights.shares) : "—" },
                { label: "Likes",  val: topPost.insights?.likes != null ? fmt(topPost.insights.likes) : (topPost.like_count != null ? fmt(topPost.like_count) : "—") },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.salmon, fontWeight: 700 }}>{s.val}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Brands I've Worked With — only renders when there's at least one completed deal */}
        {topBrands.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              Brands I've Worked With
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {topBrands.map(b => (
                <div key={b.id} style={{
                  padding: "10px 12px",
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 5,
                  textAlign: "center",
                  fontFamily: "'Playfair Display',serif",
                  fontSize: 14,
                  color: T.text,
                }}>
                  {b.brand}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. Ways to Work Together — verbatim per brief. No rates (Pels prices per opportunity). */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "22px 26px", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.text, fontWeight: 700, marginBottom: 14 }}>Ways to Work Together</div>
          <ul style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
            <li><strong>Brand partnerships</strong> — Reels, carousels, integrated storytelling</li>
            <li><strong>UGC</strong> — content created for your channels</li>
            <li><strong>Long-term ambassadorships</strong> — multi-month partnerships</li>
            <li><strong>Product integration</strong> — featured naturally in home and lifestyle content</li>
            <li><strong>Events and brand experiences</strong> — IRL activations, brand trips</li>
            <li><strong>Affiliate and code-based partnerships</strong> — performance-led collaborations</li>
          </ul>
        </div>

        {/* 9. Footer */}
        <div style={{ paddingTop: 18, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted }}>
          <div>
            hello@bybolutife.com · @{username}
            <span style={{ marginLeft: 12, color: T.salmon }}>
              Available for partnerships from {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </span>
          </div>
          <div>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, fontStyle: "italic" }}>
        The PDF will mirror this layout exactly. Values that show "—" indicate Instagram hasn't returned data yet (or the metric isn't available for the connected account type).
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — What's Working (pattern analysis)
// ══════════════════════════════════════════════════════════════════════════════

// Small, plain status component to mirror AudienceSection's loading/error UX.
function SectionStatus({ message, error }) {
  const isError = !!error;
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${isError ? T.warn + "55" : T.border}`,
      borderRadius: 8,
      padding: "20px 24px",
      fontFamily: "'DM Sans',sans-serif",
      fontSize: 13,
      color: isError ? T.warn : T.muted,
    }}>
      {isError ? `⚠ ${error}` : message}
    </div>
  );
}

// Confidence pill — sage/positive for reliable, salmon for early, muted for low.
function ConfidencePill({ confidence, label }) {
  const palette = confidence === "reliable" ? T.positive
                : confidence === "early"    ? T.salmon
                : T.muted;
  return <Tag color={palette}>{label}</Tag>;
}

// One pattern card — title, headline (or insufficient reason), and a horizontal
// bar list. Bars are simple <div> width percentages; same visual language as
// the Content Category Breakdown in AudienceSection.
function PatternCard({ title, result }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: "24px 28px",
      marginBottom: 16,
    }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 14 }}>{title}</div>

      {result.insufficient ? (
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted, fontStyle: "italic", lineHeight: 1.55 }}>
          {result.reason}
        </div>
      ) : (
        <PatternBody result={result} />
      )}
    </div>
  );
}

function PatternBody({ result }) {
  const { rows, headline, best, unit } = result;
  const max = rows.reduce((m, r) => r.mean > m ? r.mean : m, 0);

  function formatValue(mean) {
    if (unit === "%") return `${mean.toFixed(1)}%`;
    // Reach values are integers in the thousands — fmt() abbreviates as "12.3k".
    return fmt(Math.round(mean));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: T.text, lineHeight: 1.5, flex: 1 }}>
          {headline}
        </div>
        {best && <ConfidencePill confidence={best.confidence} label={best.label} />}
      </div>

      {rows.map((row, i) => {
        const isTop = i === 0 && row.confidence !== "low";
        const widthPct = max > 0 ? (row.mean / max) * 100 : 0;
        const barColor = isTop ? T.salmon : T.borderStrong;
        return (
          <div key={row.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text }}>{row.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: isTop ? T.salmon : T.textSoft, fontWeight: 600 }}>
                  {formatValue(row.mean)}
                </span>
                <ConfidencePill confidence={row.confidence} label={`n=${row.n}`} />
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: T.border }}>
              <div style={{ height: "100%", width: `${widthPct}%`, background: barColor, borderRadius: 3, transition: "width 1s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WhatsWorkingSection({ insightsData, insightsLoad, insightsErr }) {
  const [localData, setLocalData] = useState(null);
  const [localLoad, setLocalLoad] = useState(false);
  const [localErr,  setLocalErr]  = useState("");

  // Only fetch ourselves if the parent didn't already kick off (or finish) a fetch.
  useEffect(() => {
    if (insightsData || insightsLoad) return;
    setLocalLoad(true);
    fetch("/api/instagram-insights?limit=50")
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setLocalData(d);
      })
      .catch(e => setLocalErr(e.message))
      .finally(() => setLocalLoad(false));
  }, [insightsData, insightsLoad]);

  const data    = insightsData || localData;
  const loading = insightsLoad  || localLoad;
  const err     = insightsErr   || localErr;

  if (loading)        return <SectionStatus message="Analysing your posts…" />;
  if (err)            return <SectionStatus error={err} />;
  if (!data?.posts?.length) {
    return <SectionStatus message="No posts to analyse yet — post a few and check back." />;
  }

  const posts = data.posts;
  const fmtRes  = formatPattern(posts);
  const days    = dayPattern(posts);
  const time    = timePattern(posts);
  const caps    = captionPattern(posts);
  const terr    = territoryPattern(posts);

  return (
    <div>
      <SectionHeader
        title="What's Working"
        sub={`Patterns from your last ${posts.length} posts. Updated live.`}
      />
      <PatternCard title="Best format"            result={fmtRes} />
      <PatternCard title="Best day to post"       result={days} />
      <PatternCard title="Best time to post"      result={time} />
      <PatternCard title="Best caption length"    result={caps} />
      <PatternCard title="Best content territory" result={terr} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [active, setActive] = useState("audience");
  const [collapsed, setCollapsed] = useStored("bcs.sidebar.collapsed.v1", false);
  const [igData, setIgData] = useState(null);
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoad, setInsightsLoad] = useState(false);
  const [insightsErr,  setInsightsErr]  = useState("");
  const [demosData, setDemosData] = useState(null);
  const [calendarView, setCalendarView] = useState("calendar");

  useEffect(() => {
    // Run migrations BEFORE seedIfEmpty so any pre-existing data is canonicalised
    // before snapshot logic touches localStorage. Each migration is wrapped in a
    // try/catch so a failure in one storage namespace doesn't block the others.
    try { runPostTagMigrations(); } catch (e) { console.warn("postTag migrations failed", e); }
    try { runCalendarMigrations(); } catch (e) { console.warn("calendar migrations failed", e); }
    seedIfEmpty();
  }, []);

  // Stable callbacks so AudienceSection's useEffect doesn't re-fire on every parent render
  const handleIg = useCallback(d => setIgData(d), []);
  const handleInsights = useCallback(d => setInsightsData(d), []);
  const handleInsightsLoad = useCallback(b => setInsightsLoad(b), []);
  const handleInsightsErr  = useCallback(e => setInsightsErr(e), []);
  const handleDemos = useCallback(d => setDemosData(d), []);
  const openTagger = useCallback(() => { setCalendarView("tagger"); setActive("calendar"); }, []);
  const handleCalendarView = useCallback(v => setCalendarView(v), []);

  const SECTIONS = {
    audience: <AudienceSection onIgData={handleIg} onInsightsData={handleInsights} onInsightsLoad={handleInsightsLoad} onInsightsErr={handleInsightsErr} onDemographicsData={handleDemos} onOpenTagger={openTagger} />,
    deals:    <DealsSection />,
    calendar: <CalendarSection initialView={calendarView} onViewChange={handleCalendarView} />,
    patterns: <WhatsWorkingSection insightsData={insightsData} insightsLoad={insightsLoad} insightsErr={insightsErr} />,
    money:    <MoneySection igData={igData} />,
    mediakit: <MediaKitSection igData={igData} insightsData={insightsData} demosData={demosData} />,
  };

  const followersLabel = igData?.followers ? fmt(igData.followers) + " followers" : "Connecting…";
  const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'DM Sans',sans-serif", color: T.text, overflow: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.borderStrong}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.salmon}; }
        select option { background: ${T.bg}; color: ${T.text}; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <aside style={{ width: collapsed ? 64 : 220, flexShrink: 0, background: T.card, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "20px 0 32px", transition: "width 0.2s ease" }}>
        {/* Header row: title (when expanded) + collapse toggle */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "0 0 24px" : "12px 16px 24px 24px", gap: 8 }}>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: T.salmon, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>Bolus Creator Suite</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 3, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Business Dashboard</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              flexShrink: 0,
              background: "transparent",
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              width: 28,
              height: 28,
              cursor: "pointer",
              color: T.muted,
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 14,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = T.salmon; e.currentTarget.style.borderColor = T.salmon + "55"; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.salmon}66, transparent)`, margin: "0 0 24px" }} />
        <nav style={{ flex: 1 }}>
          {NAV.map(item => {
            const on = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: collapsed ? "12px 0" : "12px 24px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: on ? T.salmonDim : "transparent",
                  border: "none",
                  borderLeft: `3px solid ${on ? T.salmon : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 14, color: on ? T.salmon : T.muted }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: on ? 600 : 400, color: on ? T.text : T.textSoft, whiteSpace: "nowrap" }}>{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: collapsed ? "20px 0 0" : "24px 20px 0", borderTop: `1px solid ${T.border}`, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: collapsed ? "center" : "flex-start" }} title={collapsed ? `ByBolutife · ${followersLabel}` : undefined}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${T.salmon}, ${T.salmonLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontSize: 14, color: "#FFFFFF", fontWeight: 700, flexShrink: 0 }}>B</div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, fontWeight: 500, whiteSpace: "nowrap" }}>ByBolutife</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, whiteSpace: "nowrap" }}>{followersLabel}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", padding: "40px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>{todayStr}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {igData?.engagementRate && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.salmon, fontWeight: 600 }}>{igData.engagementRate}% engagement</div>
            )}
          </div>
        </div>
        {SECTIONS[active]}
      </main>
    </div>
  );
}
