import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

// ── Google Fonts ─────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: "#111110", card: "#1C1C1A", cardHover: "#222220",
  border: "#2A2A28", gold: "#C9A84C", goldLight: "#E2C06A",
  goldDim: "rgba(201,168,76,0.15)", text: "#F0EDE6", muted: "#8A8780",
  navy: "#1B3A5C", finance: "#C9A84C", lifestyle: "#B85C38",
  community: "#4A7C59", relationships: "#7B5EA7",
};

// ── Static mock data (non-Instagram sections) ─────────────────────────────────
const MOCK = {
  growth30: 18.4, growth60: 42.1, growth90: 112.3,
  estReach: 384000, engagementRate: 6.8,
  categories: [
    { name: "Real Estate", pct: 38, color: T.navy },
    { name: "Finance",     pct: 29, color: T.gold },
    { name: "Community",  pct: 20, color: T.community },
    { name: "Relationships", pct: 13, color: T.relationships },
  ],
};

const INITIAL_DEALS = {
  inbound: [
    { id: "d1", brand: "Monzo",  type: "Paid",         value: 2800, deliverables: "2× Reels + Story",         deadline: "2025-02-14" },
    { id: "d2", brand: "Nutmeg", type: "Affiliate",     value: 1200, deliverables: "1× Reel + Bio link",       deadline: "2025-02-28" },
  ],
  negotiating: [
    { id: "d3", brand: "Cult Furniture", type: "Gifted + Paid", value: 3500, deliverables: "3× Reels + 5× Stories", deadline: "2025-03-10" },
  ],
  active: [
    { id: "d4", brand: "Habito", type: "Paid", value: 4200, deliverables: "2× Reels", deadline: "2025-02-05" },
  ],
  completed: [
    { id: "d5", brand: "Chip App",  type: "Affiliate", value: 950,  deliverables: "1× Reel",           deadline: "2025-01-20" },
    { id: "d6", brand: "Atom Bank", type: "Paid",      value: 3100, deliverables: "2× Reels + Blog",   deadline: "2025-01-31" },
  ],
};

const EARNINGS = [
  { month: "Aug", brandDeals: 2100, affiliate: 420,  ugc: 600  },
  { month: "Sep", brandDeals: 2800, affiliate: 580,  ugc: 800  },
  { month: "Oct", brandDeals: 3400, affiliate: 710,  ugc: 950  },
  { month: "Nov", brandDeals: 4200, affiliate: 890,  ugc: 1100 },
  { month: "Dec", brandDeals: 5800, affiliate: 1200, ugc: 1400 },
  { month: "Jan", brandDeals: 7250, affiliate: 1580, ugc: 1800 },
];

const CATEGORIES = ["Real Estate", "Finance", "Lifestyle", "Community", "Relationships"];
const CATEGORY_COLORS = {
  "Real Estate": T.navy, Finance: T.gold, Lifestyle: T.lifestyle,
  Community: T.community, Relationships: T.relationships,
};

const NAV = [
  { id: "audience", label: "Audience",     icon: "◈" },
  { id: "deals",    label: "Brand Deals",  icon: "◆" },
  { id: "calendar", label: "Content",      icon: "▦" },
  { id: "money",    label: "Monetisation", icon: "◎" },
  { id: "pitch",    label: "AI Pitch",     icon: "✦" },
];

const INITIAL_POSTS = {
  3:  { category: "Finance",      platform: "Instagram", caption: "5 ISA mistakes to avoid in 2025",         status: "Posted"    },
  7:  { category: "Real Estate",  platform: "TikTok",    caption: "Stamp duty explained in 60 seconds",      status: "Posted"    },
  11: { category: "Lifestyle",    platform: "Instagram", caption: "My morning routine as a creator",          status: "Posted"    },
  14: { category: "Finance",      platform: "YouTube",   caption: "Full mortgage breakdown for FTBs",         status: "Scheduled" },
  18: { category: "Real Estate",  platform: "Instagram", caption: "Cult Furniture collab — apartment reveal", status: "Scheduled" },
  22: { category: "Community",    platform: "TikTok",    caption: "Responding to your DMs on investing",     status: "Draft"     },
  25: { category: "Finance",      platform: "Instagram", caption: "Why I maxed out my pension at 27",         status: "Draft"     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const fmtGBP = n => `£${Number(n).toLocaleString()}`;

// ── Shared UI components ──────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: T.border, margin: "20px 0" }} />;
}

function Tag({ children, color }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 3,
      background: color + "22", color, border: `1px solid ${color}44`,
    }}>{children}</span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 22px", transition: "border-color 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = T.gold + "55"}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
    >
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: accent || T.text, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, sub, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 28 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: T.text, fontWeight: 700, margin: 0, marginBottom: 6 }}>{title}</h2>
      {sub && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 32, width: 480, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
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

function GoldBtn({ onClick, children, full, disabled, loading }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      background: disabled || loading ? T.border : `linear-gradient(135deg, ${T.gold}, ${T.goldLight})`,
      border: "none", borderRadius: 6, padding: "11px 20px",
      color: disabled || loading ? T.muted : "#111110",
      cursor: disabled || loading ? "not-allowed" : "pointer",
      fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13,
      width: full ? "100%" : "auto", letterSpacing: "0.03em", transition: "opacity 0.2s",
    }}>
      {loading ? "Generating…" : children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Audience Overview  (calls /api/instagram)
// ══════════════════════════════════════════════════════════════════════════════
function AudienceSection() {
  const [ig, setIg]         = useState(null);
  const [igErr, setIgErr]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instagram")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setIg(data);
      })
      .catch(e => setIgErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const followers      = ig?.followers      ?? 127400;
  const mediaCount     = ig?.mediaCount     ?? "—";
  const username       = ig?.username       ?? "bolus";
  const engagementRate = ig?.engagementRate ?? MOCK.engagementRate;

  return (
    <div>
      {/* Header + live status badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <SectionHeader
          title="Audience Overview"
          sub={ig ? `@${username} · Live from Instagram` : "Instagram · TikTok · YouTube"}
          noMargin
        />
        <div>
          {loading  && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>Fetching live data…</span>}
          {!loading && !igErr && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#4CAF9A" }}>● Live · Instagram</span>}
          {!loading && igErr  && (
            <span title={igErr} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#E28A4A" }}>
              ⚠ Showing cached — {igErr.slice(0, 60)}
            </span>
          )}
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Followers"  value={loading ? "…" : fmt(followers)}           sub={ig ? "Live · Instagram" : "Cached"} accent={T.gold} />
        <StatCard label="Total Posts"      value={loading ? "…" : String(mediaCount)}        sub="Published media"   accent={T.gold} />
        <StatCard label="30-Day Growth"    value={`+${MOCK.growth30}%`}                      sub="vs previous period" accent="#4CAF9A" />
        <StatCard label="60-Day Growth"    value={`+${MOCK.growth60}%`}                      sub="6,200 new followers" accent="#4CAF9A" />
        <StatCard label="Est. Reach"       value={fmt(MOCK.estReach)}                         sub="Average post reach" />
        <StatCard label="Engagement Rate"  value={loading ? "…" : `${engagementRate}%`}      sub="Industry avg: 2.4%" accent={T.gold} />
      </div>

      {/* Category breakdown */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 20 }}>Content Category Breakdown</div>
        {MOCK.categories.map(cat => (
          <div key={cat.name} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text }}>{cat.name}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: cat.color, fontWeight: 600 }}>{cat.pct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: T.border }}>
              <div style={{ height: "100%", width: `${cat.pct}%`, background: cat.color, borderRadius: 2, transition: "width 1s ease" }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 28 }}>📈</div>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: T.gold, marginBottom: 4 }}>Growth trajectory: Elite tier</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted }}>You're in the top 2% of creator growth rates in the UK personal finance space. At this pace, 250k followers by Q3 2025.</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Brand Deals Tracker
// ══════════════════════════════════════════════════════════════════════════════
const COL_ORDER = ["inbound", "negotiating", "active", "completed"];
const COLUMNS   = [{ id: "inbound", label: "Inbound" }, { id: "negotiating", label: "Negotiating" }, { id: "active", label: "Active" }, { id: "completed", label: "Completed" }];

function DealCard({ deal, colId, onMove }) {
  const typeColor = deal.type === "Paid" ? T.gold : deal.type === "Affiliate" ? T.community : "#E28A4A";
  return (
    <div
      style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "14px 16px", marginBottom: 10, transition: "border-color 0.2s, transform 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold + "60"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: T.text }}>{deal.brand}</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: T.gold, fontWeight: 600 }}>{fmtGBP(deal.value)}</div>
      </div>
      <div style={{ marginBottom: 10 }}><Tag color={typeColor}>{deal.type}</Tag></div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, marginBottom: 8 }}>{deal.deliverables}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted }}>Due {deal.deadline}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {colId !== "inbound"    && <button onClick={() => onMove(deal.id, colId, -1)} style={{ background: T.border, border: "none", borderRadius: 4, color: T.muted, cursor: "pointer", padding: "2px 7px", fontSize: 12 }}>←</button>}
          {colId !== "completed"  && <button onClick={() => onMove(deal.id, colId,  1)} style={{ background: T.goldDim, border: "none", borderRadius: 4, color: T.gold, cursor: "pointer", padding: "2px 7px", fontSize: 12 }}>→</button>}
        </div>
      </div>
    </div>
  );
}

function DealsSection() {
  const [deals, setDeals]     = useState(INITIAL_DEALS);
  const [showModal, setShow]  = useState(false);
  const [form, setForm]       = useState({ brand: "", type: "Paid", value: "", deliverables: "", deadline: "" });

  function moveCard(id, fromCol, dir) {
    const toCol = COL_ORDER[COL_ORDER.indexOf(fromCol) + dir];
    if (!toCol) return;
    setDeals(prev => {
      const card = prev[fromCol].find(d => d.id === id);
      return { ...prev, [fromCol]: prev[fromCol].filter(d => d.id !== id), [toCol]: [...prev[toCol], card] };
    });
  }

  function addDeal() {
    if (!form.brand) return;
    setDeals(prev => ({ ...prev, inbound: [...prev.inbound, { id: `d${Date.now()}`, ...form, value: parseInt(form.value) || 0 }] }));
    setShow(false);
    setForm({ brand: "", type: "Paid", value: "", deliverables: "", deadline: "" });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <SectionHeader title="Brand Deals Tracker" sub="Active pipeline & historical partnerships" noMargin />
        <GoldBtn onClick={() => setShow(true)}>+ Add Deal</GoldBtn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {COLUMNS.map(col => (
          <div key={col.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, minHeight: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{col.label}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, background: T.goldDim, color: T.gold, borderRadius: 10, padding: "2px 8px" }}>{deals[col.id].length}</span>
            </div>
            {deals[col.id].map(deal => <DealCard key={deal.id} deal={deal} colId={col.id} onMove={moveCard} />)}
          </div>
        ))}
      </div>
      <Modal open={showModal} onClose={() => setShow(false)} title="New Brand Deal">
        <Input label="Brand Name"   value={form.brand}        onChange={v => setForm(f => ({ ...f, brand: v }))} />
        <Input label="Deal Type"    value={form.type}         onChange={v => setForm(f => ({ ...f, type: v }))}  options={["Paid", "Gifted", "Gifted + Paid", "Affiliate"]} />
        <Input label="Value (£)"    value={form.value}        onChange={v => setForm(f => ({ ...f, value: v }))} type="number" />
        <Input label="Deliverables" value={form.deliverables} onChange={v => setForm(f => ({ ...f, deliverables: v }))} />
        <Input label="Deadline"     value={form.deadline}     onChange={v => setForm(f => ({ ...f, deadline: v }))} type="date" />
        <GoldBtn onClick={addDeal} full>Add to Pipeline</GoldBtn>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Content Calendar
// ══════════════════════════════════════════════════════════════════════════════
const STATUS_COLORS = { Posted: "#4CAF9A", Scheduled: T.gold, Draft: T.muted };

function CalendarSection() {
  const [posts, setPosts]   = useState(INITIAL_POSTS);
  const [selected, setSel]  = useState(null);
  const [form, setForm]     = useState({ category: "Finance", platform: "Instagram", caption: "", status: "Draft" });
  const year = 2025; const month = 1;
  const days     = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  function openDay(day) { setSel(day); setForm(posts[day] || { category: "Finance", platform: "Instagram", caption: "", status: "Draft" }); }
  function save()   { if (form.caption) setPosts(p => ({ ...p, [selected]: form })); setSel(null); }
  function remove() { setPosts(p => { const n = { ...p }; delete n[selected]; return n; }); setSel(null); }

  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div>
      <SectionHeader title="Content Calendar" sub="February 2025 — colour coded by category" />
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
            const post = day && posts[day];
            return (
              <div key={i} onClick={() => day && openDay(day)} style={{
                minHeight: 70, borderRadius: 6, padding: 8, cursor: day ? "pointer" : "default",
                background: day ? (post ? CATEGORY_COLORS[post.category] + "22" : T.bg) : "transparent",
                border: `1px solid ${day ? (post ? CATEGORY_COLORS[post.category] + "55" : T.border) : "transparent"}`,
                transition: "border-color 0.15s",
              }}
                onMouseEnter={e => day && (e.currentTarget.style.borderColor = T.gold + "80")}
                onMouseLeave={e => day && (e.currentTarget.style.borderColor = post ? CATEGORY_COLORS[post.category] + "55" : T.border)}
              >
                {day && <>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: post ? T.text : T.muted, fontWeight: post ? 600 : 400, marginBottom: 4 }}>{day}</div>
                  {post && <>
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: CATEGORY_COLORS[post.category], marginBottom: 4 }} />
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{post.caption}</div>
                    <div style={{ marginTop: 4, width: 8, height: 2, borderRadius: 1, background: STATUS_COLORS[post.status] }} />
                  </>}
                </>}
              </div>
            );
          })}
        </div>
      </div>
      <Modal open={!!selected} onClose={() => setSel(null)} title={`February ${selected}, 2025`}>
        <Input label="Category"        value={form.category}  onChange={v => setForm(f => ({ ...f, category: v }))}  options={CATEGORIES} />
        <Input label="Platform"        value={form.platform}  onChange={v => setForm(f => ({ ...f, platform: v }))}  options={["Instagram","TikTok","YouTube","LinkedIn"]} />
        <Input label="Caption / Concept" value={form.caption} onChange={v => setForm(f => ({ ...f, caption: v }))} />
        <Input label="Status"          value={form.status}    onChange={v => setForm(f => ({ ...f, status: v }))}    options={["Draft","Scheduled","Posted"]} />
        <div style={{ display: "flex", gap: 10 }}>
          <GoldBtn onClick={save} full>Save</GoldBtn>
          {posts[selected] && <button onClick={remove} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Remove</button>}
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Monetisation
// ══════════════════════════════════════════════════════════════════════════════
const GOAL       = 10000;
const THIS_MONTH = EARNINGS[EARNINGS.length - 1];
const MONTH_TOTAL = THIS_MONTH.brandDeals + THIS_MONTH.affiliate + THIS_MONTH.ugc;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px 16px" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", color: T.text, marginBottom: 8 }}>{label}</div>
      {payload.map(p => <div key={p.name} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: p.fill, marginBottom: 2 }}>{p.name}: £{p.value.toLocaleString()}</div>)}
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.gold, marginTop: 6, fontWeight: 600 }}>Total: £{total.toLocaleString()}</div>
    </div>
  );
}

function MoneySection() {
  const pct = Math.min((MONTH_TOTAL / GOAL) * 100, 100);
  return (
    <div>
      <SectionHeader title="Monetisation Dashboard" sub="January 2025 — monthly earnings & goal tracking" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Brand Deals"   value={fmtGBP(THIS_MONTH.brandDeals)} sub="This month"       accent={T.gold} />
        <StatCard label="Affiliate"     value={fmtGBP(THIS_MONTH.affiliate)}   sub="Link commissions" />
        <StatCard label="UGC Fees"      value={fmtGBP(THIS_MONTH.ugc)}         sub="Content licensing" />
        <StatCard label="Monthly Total" value={fmtGBP(MONTH_TOTAL)}            sub="vs £10k goal"     accent="#4CAF9A" />
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text }}>Monthly Goal Progress</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.gold, fontWeight: 600 }}>{fmtGBP(MONTH_TOTAL)} / {fmtGBP(GOAL)}</div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: T.border }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.gold}, ${T.goldLight})`, borderRadius: 4, transition: "width 1s ease" }} />
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted, marginTop: 8 }}>{pct.toFixed(0)}% of goal · {fmtGBP(GOAL - MONTH_TOTAL)} remaining</div>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 24 }}>6-Month Earnings Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={EARNINGS} barCategoryGap="30%">
            <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v => `£${v / 1000}k`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="brandDeals" stackId="a" fill={T.gold}      name="Brand Deals" />
            <Bar dataKey="affiliate"  stackId="a" fill={T.community} name="Affiliate" />
            <Bar dataKey="ugc"        stackId="a" fill={T.lifestyle}  name="UGC" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: `linear-gradient(135deg, #1C1C1A 0%, #252520 100%)`, border: `1px solid ${T.gold}44`, borderRadius: 8, padding: "28px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.text, marginBottom: 4 }}>Media Kit Snapshot</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>Key stats for brand pitches · Updated Feb 2025</div>
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.gold, border: `1px solid ${T.gold}`, borderRadius: 4, padding: "4px 10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ready to share</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 16 }}>
          {[
            { label: "Followers",      val: "127.4k" },
            { label: "Engagement",     val: "6.8%"   },
            { label: "Avg. Reach",     val: "384k"   },
            { label: "Monthly Growth", val: "+18.4%" },
            { label: "Niche",          val: "Finance & RE" },
            { label: "Avg. Deal",      val: "£3,200" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "14px 10px", background: T.bg + "aa", borderRadius: 6, border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.gold, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — AI Pitch Generator
// ══════════════════════════════════════════════════════════════════════════════
function PitchSection() {
  const [brand, setBrand]     = useState("");
  const [category, setCat]    = useState("Fintech");
  const [notes, setNotes]     = useState("");
  const [pitch, setPitch]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function generate() {
    if (!brand) return;
    setLoading(true); setError(""); setPitch("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content:
            `You are a brand partnerships expert writing on behalf of a UK-based social media creator called Mia. She is 27, based in London, creates content around personal finance, real estate, and aspirational lifestyle. She has 127,000 followers across Instagram, TikTok and YouTube, a 6.8% engagement rate, and has grown 8x in 6 months. Her audience is primarily women aged 22–34 interested in financial independence and property ownership. She has worked with Cult Furniture, Habito, and Chip App.

Write a professional, confident, concise brand pitch email FROM Mia TO the brand partnerships team at "${brand}" (a ${category} brand). Additional notes: "${notes || "No specific notes"}".

The email should: have a compelling subject line, open with a warm but authoritative tone, clearly state why Mia's audience is a perfect fit, mention key metrics naturally (not as a list), propose a specific collaboration idea, end with a confident CTA, be under 300 words, and sound like a real human wrote it.

Format:
SUBJECT: [subject line]

[email body]` }]
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setPitch(data.content?.find(b => b.type === "text")?.text || "");
    } catch (e) {
      setError("Failed to generate. Please try again.");
    }
    setLoading(false);
  }

  const lines      = pitch.split("\n");
  const subjectLine = lines.find(l => l.startsWith("SUBJECT:"))?.replace("SUBJECT:", "").trim();
  const bodyLines   = lines.filter(l => !l.startsWith("SUBJECT:"));

  return (
    <div>
      <SectionHeader title="AI Pitch Generator" sub="Generate personalised brand outreach in seconds" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 28 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 20 }}>Brand Details</div>
          <Input label="Brand Name"        value={brand}    onChange={setBrand} />
          <Input label="Product Category"  value={category} onChange={setCat}   options={["Fintech","Property","Furniture & Interiors","Beauty & Wellness","Fashion","Food & Drink","Travel","Technology","Financial Services"]} />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Notes & Ideas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Their new savings product would resonate with my first-time buyer audience…" style={{ width: "100%", height: 100, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px", color: T.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
          </div>
          <GoldBtn onClick={generate} full loading={loading} disabled={!brand}>Generate Pitch</GoldBtn>
          {error && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#E63946", marginTop: 10 }}>{error}</div>}
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 28 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.text, marginBottom: 20 }}>Generated Pitch</div>
          {!pitch && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12 }}>
              <div style={{ fontSize: 36 }}>✦</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.muted, textAlign: "center", maxWidth: 220 }}>Fill in the brand details and click Generate to create a personalised pitch email.</div>
            </div>
          )}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: T.gold, animation: "pulse 1.5s ease-in-out infinite" }}>Crafting your pitch…</div>
            </div>
          )}
          {pitch && (
            <div>
              {subjectLine && (
                <div style={{ background: T.goldDim, border: `1px solid ${T.gold}44`, borderRadius: 6, padding: "10px 14px", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Subject</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, color: T.text }}>{subjectLine}</div>
                </div>
              )}
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, lineHeight: 1.8, whiteSpace: "pre-line", maxHeight: 340, overflowY: "auto" }}>
                {bodyLines.join("\n")}
              </div>
              <Divider />
              <button onClick={() => navigator.clipboard.writeText(pitch)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 16px", color: T.muted, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = T.gold}
                onMouseLeave={e => e.currentTarget.style.color = T.muted}
              >Copy to clipboard</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [active, setActive] = useState("audience");
  const SECTIONS = {
    audience: <AudienceSection />,
    deals:    <DealsSection />,
    calendar: <CalendarSection />,
    money:    <MoneySection />,
    pitch:    <PitchSection />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'DM Sans',sans-serif", color: T.text, overflow: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        select option { background: #1C1C1A; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: T.card, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "32px 0" }}>
        <div style={{ padding: "0 24px 32px" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: T.gold, fontWeight: 700, letterSpacing: "0.02em" }}>Bolus Creator Suite</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Business Dashboard</div>
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.gold}66, transparent)`, margin: "0 0 24px" }} />
        <nav style={{ flex: 1 }}>
          {NAV.map(item => {
            const on = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 24px", background: on ? T.goldDim : "transparent", border: "none", borderLeft: `3px solid ${on ? T.gold : "transparent"}`, cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ fontSize: 14, color: on ? T.gold : T.muted }}>{item.icon}</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: on ? 600 : 400, color: on ? T.text : T.muted }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "24px 20px 0", borderTop: `1px solid ${T.border}`, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${T.gold}, ${T.lifestyle})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontSize: 14, color: "#111", fontWeight: 700, flexShrink: 0 }}>M</div>
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, fontWeight: 500 }}>Mia Clarke</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted }}>127.4k followers</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", padding: "40px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>Tuesday, 1 February 2025</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.gold }}>↑ 18.4% this month</div>
            <div style={{ background: T.goldDim, border: `1px solid ${T.gold}44`, borderRadius: 6, padding: "6px 14px", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.gold, fontWeight: 600 }}>£10,630 earned</div>
          </div>
        </div>
        {SECTIONS[active]}
      </main>
    </div>
  );
}
