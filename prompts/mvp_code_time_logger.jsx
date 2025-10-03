import React, { useMemo, useRef, useState, useEffect } from "react";

// Time Log — ultra-fast logger (simplified UI with tabs)
// Key behaviours:
// - Logging: start time defaults to now; press Enter or click Log.
// - Duration rule: each entry's time runs **until the next entry ONLY**; if no next entry the duration is **0**.
// - Mapping: free text auto-maps to closest preset category; dropdown appears after typing.
// - Presets: ticket + description; toggle Non-work to exclude from "Work only" totals.
// - Views: Tabs for (1) Log & Timeline and (2) Categories; timeline range Day/Week/Month; Totals tabbed: Work only | All.
// - Local-only storage via localStorage.

// ---------- Helpers ----------
function nowISO() {
  return new Date().toISOString();
}

function toLocalHM(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function sameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function startOfDay(date) {
  const d = new Date(date); d.setHours(0,0,0,0); return d;
}
function endOfDay(date) {
  const d = new Date(date); d.setHours(23,59,59,999); return d;
}
function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function endOfWeekMonday(date) {
  const start = startOfWeekMonday(date);
  const d = new Date(start); d.setDate(start.getDate() + 6); d.setHours(23,59,59,999); return d;
}
function startOfMonth(date) {
  const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d;
}
function endOfMonth(date) {
  const d = new Date(date); d.setMonth(d.getMonth()+1, 0); d.setHours(23,59,59,999); return d;
}

// Simple fuzzy score: higher is better
function fuzzyScore(input, target) {
  if (!input || !target) return 0;
  const a = input.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return 100;
  let score = b.includes(a) ? Math.min(80, Math.floor((a.length / b.length) * 80 + 10)) : 0;
  const at = new Set(a.split(/[^a-z0-9]+/g).filter(Boolean));
  const bt = new Set(b.split(/[^a-z0-9]+/g).filter(Boolean));
  let overlap = 0; for (const t of at) if (bt.has(t)) overlap++;
  score += overlap * 7;
  if (b.startsWith(a)) score += 10;
  return Math.min(score, 100);
}

function humanHM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// ---------- Storage ----------
const LS_KEY = "timelog.entries.v2"; // bump key due to duration rule change
const LS_CATS = "timelog.categories.v1";

function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ---------- Types ----------
// Category: { id, ticket, description, label, nonWork }
// Entry: { id, tsISO, rawText, categoryId, label }

function defaultCategories() {
  return [
    { id: "cat-85n", ticket: "85n", description: "API epic", label: "85n — API epic", nonWork: false },
    { id: "cat-85h", ticket: "85h", description: "Work item", label: "85h — Work item", nonWork: false },
    { id: "cat-85i", ticket: "85i", description: "Work item", label: "85i — Work item", nonWork: false },
    { id: "cat-112g", ticket: "112g", description: "Work item", label: "112g — Work item", nonWork: false },
    { id: "cat-api", ticket: "API", description: "Ticket", label: "API — Ticket", nonWork: false },
    { id: "cat-standup", ticket: "STANDUP", description: "Daily stand-up", label: "STANDUP — Daily stand-up", nonWork: false },
    { id: "cat-refine", ticket: "Refinement", description: "Backlog/Refinement", label: "Refinement — Backlog/Refinement", nonWork: false },
    { id: "cat-retro", ticket: "Retro", description: "Sprint retrospective", label: "Retro — Sprint retrospective", nonWork: false },
    { id: "cat-demo", ticket: "Sprint demo", description: "Sprint review/demo", label: "Sprint demo — Sprint review/demo", nonWork: false },
    { id: "cat-attachments", ticket: "File attachments", description: "Call", label: "File attachments — Call", nonWork: false },
    { id: "cat-lunch", ticket: "Lunch", description: "Break", label: "Lunch — Break", nonWork: true },
    { id: "cat-break", ticket: "Break", description: "Short break", label: "Break — Short break", nonWork: true },
    { id: "cat-ooo", ticket: "OOO", description: "Out of office", label: "OOO — Out of office", nonWork: true },
    { id: "cat-eod", ticket: "EoD", description: "End of day marker", label: "EoD — Marker", nonWork: true },
  ];
}

export default function App() {
  const [tab, setTab] = useState("log"); // "log" | "categories"
  const [range, setRange] = useState("day"); // "day" | "week" | "month"
  const [totalsView, setTotalsView] = useState("work"); // "work" | "all"

  const [categories, setCategories] = useState(() => loadLS(LS_CATS, defaultCategories()));
  const [entries, setEntries] = useState(() => loadLS(LS_KEY, []));
  const [text, setText] = useState("");
  const [tsISO, setTsISO] = useState(nowISO());
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { saveLS(LS_KEY, entries); }, [entries]);
  useEffect(() => { saveLS(LS_CATS, categories); }, [categories]);

  // Filter categories for dropdown once user has typed >= 1 char
  const filteredCats = useMemo(() => {
    const q = text.trim(); if (q.length === 0) return [];
    const scored = categories.map(c => ({ c, score: Math.max(fuzzyScore(q, c.label), fuzzyScore(q, c.ticket), fuzzyScore(q, c.description)) }));
    return scored.filter(s => s.score > 0).sort((a,b) => b.score - a.score).slice(0,8).map(s => s.c);
  }, [text, categories]);

  function pickCategoryForFreeText(freeText) {
    const candidates = categories.map(c => ({ c, score: Math.max(fuzzyScore(freeText, c.label), fuzzyScore(freeText, c.ticket), fuzzyScore(freeText, c.description)) }));
    candidates.sort((a,b) => b.score - a.score);
    const top = candidates[0];
    if (top && top.score >= 60) return top.c;
    const ticket = freeText.trim();
    const newCat = { id: `cat-${Date.now()}`, ticket, description: "Ad-hoc", label: `${ticket}`, nonWork: false };
    setCategories(prev => [...prev, newCat]);
    return newCat;
  }

  function addEntry(cat) {
    const entry = { id: `e-${Date.now()}`, tsISO, rawText: text.trim(), categoryId: cat.id, label: cat.label };
    const next = [...entries, entry].sort((a,b) => new Date(a.tsISO) - new Date(b.tsISO));
    setEntries(next);
    setText("");
    setTsISO(nowISO());
    inputRef.current?.focus();
  }

  function onSubmit(e){ e.preventDefault(); const freeText = text.trim(); if(!freeText) return; const cat = pickCategoryForFreeText(freeText); addEntry(cat); }
  function onPickFromDropdown(c){ setText(`${c.ticket}`); setTimeout(() => addEntry(c), 0); }

  // ---- Range filtering ----
  const today = new Date();
  const rangeBounds = useMemo(() => {
    if (range === "day") return { start: startOfDay(today), end: endOfDay(today) };
    if (range === "week") return { start: startOfWeekMonday(today), end: endOfWeekMonday(today) };
    return { start: startOfMonth(today), end: endOfMonth(today) }; // month
  }, [range]);

  const inRangeEntries = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.tsISO); return d >= rangeBounds.start && d <= rangeBounds.end;
    }).sort((a,b) => new Date(a.tsISO) - new Date(b.tsISO));
  }, [entries, rangeBounds]);

  // ---- Durations per entry ----
  // Rule: duration until the next entry **on the same day**. If no next entry on that day, minutes = 0.
  const rowsWithDurations = useMemo(() => {
    // group by day
    const byDay = new Map();
    for (const e of inRangeEntries) {
      const key = new Date(e.tsISO).toDateString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(e);
    }
    const result = [];
    for (const [, list] of byDay) {
      list.sort((a,b)=> new Date(a.tsISO) - new Date(b.tsISO));
      for (let i=0; i<list.length; i++) {
        const current = list[i];
        const next = list[i+1];
        const minutes = next ? Math.max(0, Math.round((new Date(next.tsISO) - new Date(current.tsISO)) / 60000)) : 0;
        result.push({ ...current, minutes });
      }
    }
    // sort globally for timeline display
    return result.sort((a,b)=> new Date(a.tsISO) - new Date(b.tsISO));
  }, [inRangeEntries]);

  // ---- Totals by activity ----
  const totalsByActivity = useMemo(() => {
    const map = new Map();
    for (const r of rowsWithDurations) {
      const cat = categories.find(c => c.id === r.categoryId);
      if (!cat) continue;
      if (totalsView === "work" && cat.nonWork) continue;
      const key = cat.label;
      map.set(key, (map.get(key) || 0) + r.minutes);
    }
    const rows = Array.from(map.entries()).map(([label, minutes]) => ({ label, minutes, hm: humanHM(minutes) }))
                      .sort((a,b)=> b.minutes - a.minutes);
    const total = rows.reduce((s, r) => s + r.minutes, 0);
    return { rows, total, totalHM: humanHM(total) };
  }, [rowsWithDurations, categories, totalsView]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen p-6 bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Time Log</h1>
          <nav className="flex gap-2">
            <button onClick={()=>setTab("log")} className={`px-3 py-1.5 rounded-xl ${tab==='log'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>Log & Timeline</button>
            <button onClick={()=>setTab("categories")} className={`px-3 py-1.5 rounded-xl ${tab==='categories'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>Categories</button>
          </nav>
        </header>

        {tab === 'log' && (
          <>
            {/* Quick logger */}
            <form onSubmit={onSubmit} className="grid gap-3">
              <div className="grid grid-cols-3 gap-3 items-center">
                <input
                  type="time"
                  value={toLocalHM(tsISO)}
                  onChange={(e)=>{ const [h,m]=e.target.value.split(":").map(Number); const d=new Date(); d.setHours(h,m,0,0); setTsISO(d.toISOString()); }}
                  className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800"
                />
                <input
                  ref={inputRef}
                  placeholder="Type activity (e.g. 85n, API ticket, lunch)"
                  value={text}
                  onChange={(e)=>{ setText(e.target.value); setShowDropdown(e.target.value.trim().length>0); }}
                  onFocus={()=>setShowDropdown(text.trim().length>0)}
                  onBlur={()=>setTimeout(()=>setShowDropdown(false),120)}
                  className="col-span-2 w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800"
                />
                {showDropdown && filteredCats.length>0 && (
                  <div className="col-span-3 -mt-2 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900">
                    {filteredCats.map(c=> (
                      <button type="button" key={c.id} onMouseDown={(e)=>e.preventDefault()} onClick={()=>onPickFromDropdown(c)} className="w-full text-left px-4 py-2 hover:bg-neutral-800">
                        <div className="font-medium">{c.ticket}</div>
                        <div className="text-xs opacity-75">{c.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20">Log</button>
                <button type="button" onClick={()=>{ setText(""); setTsISO(nowISO()); inputRef.current?.focus(); }} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10">Clear</button>
              </div>
            </form>

            {/* Timeline + Range */}
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Timeline</h2>
                <div className="flex gap-2 text-sm">
                  <button onClick={()=>setRange('day')} className={`px-3 py-1.5 rounded-xl ${range==='day'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>Day</button>
                  <button onClick={()=>setRange('week')} className={`px-3 py-1.5 rounded-xl ${range==='week'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>Week</button>
                  <button onClick={()=>setRange('month')} className={`px-3 py-1.5 rounded-xl ${range==='month'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>Month</button>
                </div>
              </div>
              {rowsWithDurations.length === 0 ? (
                <div className="opacity-70">No entries in this range.</div>
              ) : (
                <div className="grid gap-1">
                  {rowsWithDurations.map(r=> {
                    const cat = categories.find(c=>c.id===r.categoryId);
                    const nonWork = cat?.nonWork;
                    return (
                      <div key={r.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${nonWork?'border-neutral-900 bg-neutral-900/60 opacity-70':'border-neutral-800 bg-neutral-900'}`}>
                        <div className="flex items-center gap-3">
                          <div className="text-xs w-28 opacity-75">{new Date(r.tsISO).toLocaleDateString()} {toLocalHM(r.tsISO)}</div>
                          <div className="font-medium">{r.label}</div>
                        </div>
                        <div className="text-sm">{r.minutes} min</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Totals (tabbed) */}
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Totals</h2>
                <div className="flex gap-2 text-sm">
                  <button onClick={()=>setTotalsView('work')} className={`px-3 py-1.5 rounded-xl ${totalsView==='work'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>Work only</button>
                  <button onClick={()=>setTotalsView('all')} className={`px-3 py-1.5 rounded-xl ${totalsView==='all'?'bg-neutral-800':'bg-neutral-900 border border-neutral-800'}`}>All activities</button>
                </div>
              </div>
              {totalsByActivity.rows.length === 0 ? (
                <div className="opacity-70">No time yet.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-neutral-800">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-900/80">
                      <tr>
                        <th className="text-left px-3 py-2">Activity</th>
                        <th className="text-right px-3 py-2">Minutes</th>
                        <th className="text-right px-3 py-2">Hours (h m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totalsByActivity.rows.map(r => (
                        <tr key={r.label} className="border-t border-neutral-900">
                          <td className="px-3 py-2">{r.label}</td>
                          <td className="px-3 py-2 text-right">{r.minutes}</td>
                          <td className="px-3 py-2 text-right">{r.hm}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-neutral-900 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{totalsByActivity.total}</td>
                        <td className="px-3 py-2 text-right">{totalsByActivity.totalHM}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'categories' && (
          <section className="grid gap-3">
            <h2 className="text-lg font-medium">Categories</h2>
            <div className="text-sm opacity-75">Preset list drives suggestions + auto-mapping. Toggle Non-work to exclude from Work-only totals.</div>
            <div className="grid gap-2">
              {categories.map((c) => (
                <div key={c.id} className="grid md:grid-cols-[160px_1fr_1fr_120px] gap-2 items-center p-3 rounded-xl border border-neutral-800 bg-neutral-900">
                  <input
                    value={c.ticket}
                    onChange={(e)=> setCategories(prev => prev.map(x => x.id===c.id ? { ...x, ticket: e.target.value, label: `${e.target.value} — ${x.description}` } : x))}
                    className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800"
                  />
                  <input
                    value={c.description}
                    onChange={(e)=> setCategories(prev => prev.map(x => x.id===c.id ? { ...x, description: e.target.value, label: `${x.ticket} — ${e.target.value}` } : x))}
                    className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800"
                  />
                  <div className="text-xs opacity-70">{c.label}</div>
                  <label className="flex items-center gap-2 justify-self-end">
                    <input type="checkbox" checked={c.nonWork} onChange={(e)=> setCategories(prev => prev.map(x => x.id===c.id ? { ...x, nonWork: e.target.checked } : x))} />
                    <span className="text-sm">Non-work</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
