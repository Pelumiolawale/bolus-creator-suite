import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

// ── Google Fonts ─────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ── Design tokens — Salmon + Cream ───────────────────────────────────────────
// Warm, soft, lived-in. Cream as the primary surface, terracotta/salmon
// as the accent. No more black + gold.
const T = {
  bg: "#FAF4ED",          // page background — warm cream
  card: "#FFFFFF",         // card surface — clean white on cream
  cardHover: "#FDF8F2",
  border: "#E8DDD0",       // soft sand border
  borderStrong: "#D8C8B5",

  // Salmon family — primary accent
  salmon: "#E8896E",       // rich salmon
  salmonLight: "#F2A98C",  // lighter salmon for gradients
  salmonDim: "rgba(232,137,110,0.12)",

  // Text
  text: "#2A2420",         // deep warm brown — readable on cream
  textSoft: "#6B5D52",     // softer body
  muted: "#9A8B7E",        // muted warm grey

  // Category colours — chosen to live happily next to salmon
  navy: "#3C5A6B",         // slate teal — Real Estate
  finance: "#C97B5C",       // burnt sienna — Finance
  lifestyle: "#9C7B4A",     // warm tan — Lifestyle
  community: "#7A8B6B",     // sage olive — Community
  relationships: "#8E6F8E", // dusty mauve — Relationships

  // Status
  positive: "#5C8B6F",      // sage green for live / posted
  warn: "#C28A4E",          // muted amber for warnings
};

// Brand deals tracker uses these for type colouring
const T_dealTypeColor = {
  Paid: T.salmon,
  Affiliate: T.community,
  "Gifted + Paid": T.warn,
  Gifted: T.lifestyle,
};

// ── Static mock data (non-Instagram sections — kept until real sources wired) ─
const MOCK = {
  growth30: 18.4, growth60: 42.1, growth90: 112.3,
  estReach: 384000, engagementRate: 6.8,
  categories: [
    { name: "Real Estate",     pct: 38, color: T.navy },
    { name: "Finance",         pct: 29, color: T.finance },
    { name: "Community",       pct: 20, color: T.community },
    { name: "Relationships",   pct: 13, color: T.relationships },
  ],
};

const INITIAL_DEALS = {
  inbound: [],
  negotiating: [],
  active: [],
  completed: [],
};

const EARNINGS = [
  { month: "Aug", brandDeals: 0, affiliate: 0, ugc: 0 },
  { month: "Sep", brandDeals: 0, affiliate: 0, ugc: 0 },
  { month: "Oct", brandDeals: 0, affiliate: 0, ugc: 0 },
  { month: "Nov", brandDeals: 0, affiliate: 0, ugc: 0 },
  { month: "Dec", brandDeals: 0, affiliate: 0, ugc: 0 },
  { month: "Jan", brandDeals: 0, affiliate: 0, ugc: 0 },
];

const CATEGORIES = ["Real Estate", "Finance", "Lifestyle", "Community", "Relationships"];
const CATEGORY_COLORS = {
  "Real Estate": T.navy,
  Finance: T.finance,
  Lifestyle: T.lifestyle,
  Community: T.community,
  Relationships: T.relationships,
};

const NAV = [
  { id: "audience", label: "Audience",     icon: "◈" },
  { id: "deals",    label: "Brand Deals",  icon: "◆" },
  { id: "calendar", label: "Content",      icon: "▦" },
  { id: "money",    label: "Monetisation", icon: "◎" },
];

const INITIAL_POSTS = {};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const fmtGBP = n => `£${Number(n).toLocaleString()}`;

// localStorage hook — persists state across sessions so deals/calendar don't reset
function useStored(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore quota errors */ }
  }, [key, val]);
  return [val, setVal];
}

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
// SECTION 1 — Audience Overview  (calls /api/instagram)
// ══════════════════════════════════════════════════════════════════════════════
function AudienceSection({ onIgData }) {
  const [ig, setIg]         = useState(null);
  const [igErr, setIgErr]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instagram")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setIg(data);
        if (onIgData) onIgData(data);
      })
      .catch(e => setIgErr(e.message))
      .finally(() => setLoading(false));
  }, [onIgData]);

  const followers      = ig?.followers      ?? null;
  const mediaCount     = ig?.mediaCount     ?? "—";
  const username       = ig?.username       ?? "bybolutife";
  const engagementRate = ig?.engagementRate ?? null;

  return (
    <div>
      {/* Header + live status badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <SectionHeader
          title="Audience Overview"
          sub={ig ? `@${username} · Live from Instagram` : "Connecting to Instagram…"}
          noMargin
        />
        <div>
          {loading  && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>Fetching live data…</span>}
          {!loading && !igErr && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.positive }}>● Live · Instagram</span>}
          {!loading && igErr  && (
            <span title={igErr} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.warn }}>
              ⚠ {igErr.slice(0, 60)}
            </span>
          )}
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Followers"  value={loading ? "…" : (followers !== null ? fmt(followers) : "—")} sub={ig ? "Live · Instagram" : "Connect Instagram"} accent={T.salmon} />
        <StatCard label="Total Posts"      value={loading ? "…" : String(mediaCount)} sub="Published media" accent={T.salmon} />
        <StatCard label="30-Day Growth"    value={`+${MOCK.growth30}%`} sub="vs previous period (mock)" accent={T.positive} />
        <StatCard label="60-Day Growth"    value={`+${MOCK.growth60}%`} sub="6,200 new followers (mock)" accent={T.positive} />
        <StatCard label="Est. Reach"       value={fmt(MOCK.estReach)}    sub="Average post reach (mock)" />
        <StatCard label="Engagement Rate"  value={loading ? "…" : (engagementRate !== null ? `${engagementRate}%` : "—")} sub="Industry avg: 2.4%" accent={T.salmon} />
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
        <div style={{ marginTop: 16, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, fontStyle: "italic" }}>
          Note: category split is currently estimated — connect post tagging to make this live.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Brand Deals Tracker (now persisted to localStorage)
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

  function moveCard(id, fromCol, dir) {
    const toCol = COL_ORDER[COL_ORDER.indexOf(fromCol) + dir];
    if (!toCol) return;
    setDeals(prev => {
      const card = prev[fromCol].find(d => d.id === id);
      return { ...prev, [fromCol]: prev[fromCol].filter(d => d.id !== id), [toCol]: [...prev[toCol], card] };
    });
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Content Calendar (persisted to localStorage)
// ══════════════════════════════════════════════════════════════════════════════
const STATUS_COLORS = { Posted: T.positive, Scheduled: T.salmon, Draft: T.muted };

function CalendarSection() {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [posts, setPosts]         = useStored("bcs.posts.v1", INITIAL_POSTS);
  const [selected, setSel]        = useState(null);
  const [form, setForm]           = useState({ category: "Finance", platform: "Reel", caption: "", status: "Draft" });

  const days     = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthPosts = posts[monthKey] || {};

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

  function openDay(day) {
    setSel(day);
    setForm(monthPosts[day] || { category: "Finance", platform: "Reel", caption: "", status: "Draft" });
  }
  function save() {
    if (form.caption) {
      setPosts(p => ({ ...p, [monthKey]: { ...(p[monthKey] || {}), [selected]: form } }));
    }
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <SectionHeader title="Content Calendar" sub={`${monthName} — colour coded by category`} noMargin />
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => shiftMonth(-1)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>←</button>
          <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Today</button>
          <button onClick={() => shiftMonth(1)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>→</button>
        </div>
      </div>
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
                onMouseLeave={e => day && (e.currentTarget.style.borderColor = post ? CATEGORY_COLORS[post.category] + "55" : T.border)}
              >
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
        <Input label="Status"            value={form.status}    onChange={v => setForm(f => ({ ...f, status: v }))}    options={["Draft","Scheduled","Posted"]} />
        <div style={{ display: "flex", gap: 10 }}>
          <SalmonBtn onClick={save} full>Save</SalmonBtn>
          {monthPosts[selected] && <button onClick={remove} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSoft, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>Remove</button>}
        </div>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Monetisation (now driven by real deals data)
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

function MoneySection({ igData }) {
  // Pull deals from localStorage so this section reflects what the user actually tracks.
  const [deals] = useStored("bcs.deals.v1", INITIAL_DEALS);

  // Total earned = sum of all completed deals, broken down by type.
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

  const followers = igData?.followers ?? null;
  const engagement = igData?.engagementRate ?? null;

  const followersLabel = followers !== null ? fmt(followers) : "—";
  const engagementLabel = engagement !== null ? `${engagement}%` : "—";

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
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: T.muted, marginBottom: 16, fontStyle: "italic" }}>Placeholder — will populate as you log monthly completed deals.</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={EARNINGS} barCategoryGap="30%">
            <XAxis dataKey="month" tick={{ fill: T.muted, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }} axisLine={false} tickLine={false} tickFormatter={v => `£${v / 1000}k`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: T.salmonDim }} />
            <Bar dataKey="brandDeals" stackId="a" fill={T.salmon}    name="Brand Deals" />
            <Bar dataKey="affiliate"  stackId="a" fill={T.community} name="Affiliate" />
            <Bar dataKey="ugc"        stackId="a" fill={T.lifestyle} name="UGC" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: `linear-gradient(135deg, #FFFFFF 0%, ${T.cardHover} 100%)`, border: `1px solid ${T.salmon}55`, borderRadius: 8, padding: "28px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.text, marginBottom: 4 }}>Media Kit Snapshot</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.muted }}>Live stats for brand pitches</div>
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.salmon, border: `1px solid ${T.salmon}`, borderRadius: 4, padding: "4px 10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ready to share</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 16 }}>
          {[
            { label: "Followers",       val: followersLabel },
            { label: "Engagement",      val: engagementLabel },
            { label: "Avg. Reach",      val: fmt(MOCK.estReach) },
            { label: "Monthly Growth",  val: `+${MOCK.growth30}%` },
            { label: "Niche",           val: "Home & Money" },
            { label: "Avg. Deal",       val: completed.length ? fmtGBP(Math.round(monthTotal / completed.length)) : "—" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "14px 10px", background: T.bg, borderRadius: 6, border: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: T.salmon, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
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
  const [igData, setIgData] = useState(null);

  const SECTIONS = {
    audience: <AudienceSection onIgData={setIgData} />,
    deals:    <DealsSection />,
    calendar: <CalendarSection />,
    money:    <MoneySection igData={igData} />,
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

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: T.card, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "32px 0" }}>
        <div style={{ padding: "0 24px 32px" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: T.salmon, fontWeight: 700, letterSpacing: "0.02em" }}>Bolus Creator Suite</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted, marginTop: 3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Business Dashboard</div>
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.salmon}66, transparent)`, margin: "0 0 24px" }} />
        <nav style={{ flex: 1 }}>
          {NAV.map(item => {
            const on = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 24px", background: on ? T.salmonDim : "transparent", border: "none", borderLeft: `3px solid ${on ? T.salmon : "transparent"}`, cursor: "pointer", transition: "all 0.15s" }}>
                <span style={{ fontSize: 14, color: on ? T.salmon : T.muted }}>{item.icon}</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: on ? 600 : 400, color: on ? T.text : T.textSoft }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "24px 20px 0", borderTop: `1px solid ${T.border}`, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${T.salmon}, ${T.salmonLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display',serif", fontSize: 14, color: "#FFFFFF", fontWeight: 700, flexShrink: 0 }}>B</div>
            <div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: T.text, fontWeight: 500 }}>ByBolutife</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: T.muted }}>{followersLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
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
