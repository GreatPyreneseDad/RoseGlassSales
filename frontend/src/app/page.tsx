'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// API calls go through Next.js rewrites → /api/* → Railway backend
const api = (path: string, opts?: RequestInit) => fetch(`/api${path}`, opts);
const apiJson = (path: string, body: any) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ─── Types ───────────────────────────────────────────────
interface Lead {
  id: string; full_name: string; title: string; company: string;
  company_industry: string; company_size: number; company_size_range: string;
  company_revenue: string; company_description: string; company_founded: number;
  region: string; locality: string; email: string;
  phone_number1: string; mobile_phone1: string;
  linkedin: string; linkedin_profile_url: string; company_domain: string;
  rank_position: number; rank_score: number; coherence_score: number;
  qualification_tier: string;
  psi_intent: number; rho_authority: number;
  q_urgency: number; q_optimized: number; f_fit: number;
  dimensional_fractures: string; buying_signals: string;
  user_notes: string; user_status: string; user_rating: number;
  outreach_status: string;
}

interface Stats { total: number; scored: number; tiers: Record<string, number>; avg_coherence: number; }
interface ChatMsg { role: 'user' | 'assistant'; content: string; }

// ─── Constants ───────────────────────────────────────────
const T: Record<string, string> = {
  hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6',
  disqualified: '#52525b', unscored: '#71717a',
};
const D: Record<string, string> = { Ψ: '#a78bfa', ρ: '#22d3ee', q: '#fbbf24', f: '#34d399' };

// ─── Micro Components ────────────────────────────────────
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

function Bar({ label, val, color }: { label: string; val: number; color: string }) {
  const v = val ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span style={{ ...mono, width: 16, fontSize: 12, color: '#94a3b8' }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, v * 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ ...mono, width: 32, fontSize: 10, color: '#475569', textAlign: 'right' }}>{v ? v.toFixed(2) : '—'}</span>
    </div>
  );
}

function Tier({ t }: { t: string }) {
  const c = T[t] || '#52525b';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.8,
      background: `${c}18`, color: c, border: `1px solid ${c}33`,
    }}>{t || '—'}</span>
  );
}

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 10, border: `1px solid ${color}44`,
      background: active ? `${color}20` : 'transparent',
      color: active ? color : '#64748b', fontSize: 10, cursor: 'pointer',
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, transition: 'all 0.15s',
    }}>{label}</button>
  );
}

// ─── Lead Card ───────────────────────────────────────────
function Card({ lead, sel, onClick }: { lead: Lead; sel: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '12px 14px', borderBottom: '1px solid #141c2b', cursor: 'pointer',
      background: sel ? '#0c1425' : 'transparent',
      borderLeft: `3px solid ${sel ? '#8b5cf6' : 'transparent'}`,
      transition: 'all 0.12s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead.rank_position ? <span style={{ ...mono, color: '#475569', fontSize: 11, marginRight: 6 }}>#{lead.rank_position}</span> : null}
            {lead.full_name}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead.title} · {lead.company}
          </div>
        </div>
        <div style={{ marginLeft: 8, flexShrink: 0 }}><Tier t={lead.qualification_tier} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginTop: 8 }}>
        <Bar label="Ψ" val={lead.psi_intent} color={D.Ψ} />
        <Bar label="ρ" val={lead.rho_authority} color={D.ρ} />
        <Bar label="q" val={lead.q_optimized} color={D.q} />
        <Bar label="f" val={lead.f_fit} color={D.f} />
      </div>
    </div>
  );
}

// ─── Lead Detail Slide-out ───────────────────────────────
function Detail({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  if (!lead) return null;
  const hasFracture = lead.dimensional_fractures && lead.dimensional_fractures !== 'No fractures detected';
  const hasSignals = lead.buying_signals && !lead.buying_signals.startsWith('Scout error');

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 400,
      background: '#0a0f1a', borderLeft: '1px solid #1e293b',
      overflowY: 'auto', zIndex: 200, padding: '20px 20px 40px',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 14, right: 14, background: '#1e293b',
        border: 'none', color: '#94a3b8', width: 28, height: 28, borderRadius: 6,
        cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✕</button>

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#f1f5f9', fontWeight: 700 }}>{lead.full_name}</h2>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>{lead.title} at {lead.company}</p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
        <Tier t={lead.qualification_tier} />
        <span style={{ ...mono, fontSize: 11, color: '#475569' }}>
          C={lead.coherence_score?.toFixed(2)} · #{lead.rank_position}
        </span>
      </div>

      {/* Dimensions */}
      <Section label="Dimensions">
        <Bar label="Ψ" val={lead.psi_intent} color={D.Ψ} />
        <Bar label="ρ" val={lead.rho_authority} color={D.ρ} />
        <Bar label="q" val={lead.q_optimized} color={D.q} />
        <Bar label="f" val={lead.f_fit} color={D.f} />
      </Section>

      {/* Fractures */}
      {hasFracture && (
        <div style={{
          background: '#16122a', border: '1px solid #7c3aed30', borderRadius: 8,
          padding: 10, marginBottom: 14, fontSize: 11, color: '#c4b5fd', lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 700, marginRight: 4 }}>⚡</span>{lead.dimensional_fractures}
        </div>
      )}

      {/* Buying Signals */}
      {hasSignals && (
        <Section label="Buying Signals">
          <div style={{
            fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, background: '#111827',
            borderRadius: 6, padding: 10, maxHeight: 180, overflowY: 'auto',
            whiteSpace: 'pre-wrap', border: '1px solid #1e293b',
          }}>{lead.buying_signals}</div>
        </Section>
      )}

      {/* Contact */}
      <Section label="Contact">
        <Grid>
          <GV label="Email" val={lead.email} />
          <GV label="Phone" val={lead.phone_number1 || lead.mobile_phone1} />
          <GV label="Region" val={[lead.locality, lead.region].filter(Boolean).join(', ')} />
          <GV label="Industry" val={lead.company_industry} />
          <GV label="Size" val={lead.company_size_range} />
          <GV label="Revenue" val={lead.company_revenue} />
          <GV label="Founded" val={lead.company_founded?.toString()} />
          <GV label="Domain" val={lead.company_domain} link={lead.company_domain ? `https://${lead.company_domain}` : undefined} />
        </Grid>
      </Section>

      {(lead.linkedin || lead.linkedin_profile_url) && (
        <a href={lead.linkedin || lead.linkedin_profile_url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
            color: '#8b5cf6', fontSize: 12, textDecoration: 'none',
            padding: '6px 12px', background: '#8b5cf610', borderRadius: 6, border: '1px solid #8b5cf622',
          }}>LinkedIn →</a>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>{children}</div>;
}
function GV({ label, val, link }: { label: string; val?: string | null; link?: string }) {
  const text = val || '—';
  return (
    <div style={{ fontSize: 11 }}>
      <span style={{ color: '#475569' }}>{label}: </span>
      {link ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>{text}</a> : <span style={{ color: '#94a3b8' }}>{text}</span>}
    </div>
  );
}

// ─── Stats Bar ───────────────────────────────────────────
function StatsBar({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '8px 20px', borderBottom: '1px solid #111827',
      fontSize: 11, color: '#475569', alignItems: 'center', background: '#060a14',
    }}>
      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{stats.total}</span>
      {Object.entries(stats.tiers || {}).sort((a, b) => b[1] - a[1]).map(([tier, n]) => (
        <span key={tier} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: T[tier] || '#52525b' }} />{n} {tier}
        </span>
      ))}
      {stats.avg_coherence > 0 && <span style={{ marginLeft: 'auto', ...mono, fontSize: 10 }}>C̄={stats.avg_coherence.toFixed(2)}</span>}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────
export default function Home() {
  const [view, setView] = useState<'chat' | 'leads'>('chat');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sel, setSel] = useState<Lead | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Rose Glass Sales Intelligence online.\n\n566 leads loaded from the behavioral health vertical — ranked by CERATA dimensional analysis. 192 warm, 346 cold, 28 disqualified. No hot leads yet — scouts haven\'t run to surface urgency signals.\n\nAsk me anything about your pipeline, or hit Scout to start gathering buying signals.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const load = () => { api('/stats').then(r => r.json()).then(setStats).catch(() => {}); fetchLeads(); };
  const fetchLeads = (t?: string | null) => {
    let url = '/leads?limit=100';
    if (t) url += `&tier=${t}`;
    api(url).then(r => r.json()).then(setLeads).catch(() => {});
  };

  const send = async () => {
    if (!input.trim() || busy) return;
    const m = input.trim(); setInput(''); setBusy(true);
    setMsgs(p => [...p, { role: 'user', content: m }]);
    try {
      const r = await apiJson('/chat', { message: m, history: msgs.slice(-10) });
      const d = await r.json();
      setMsgs(p => [...p, { role: 'assistant', content: d.reply }]);
      if (d.stats) setStats(d.stats);
    } catch { setMsgs(p => [...p, { role: 'assistant', content: 'Connection error.' }]); }
    setBusy(false);
  };

  const scout = async () => {
    setScouting(true);
    try {
      const d = await (await apiJson('/scout/run?limit=10', {})).json();
      setMsgs(p => [...p, { role: 'assistant', content: `Scout complete: ${d.updated} leads updated with buying signals.` }]);
      load();
    } catch { setMsgs(p => [...p, { role: 'assistant', content: 'Scout failed — check backend logs.' }]); }
    setScouting(false);
  };

  const rank = async () => {
    setRanking(true);
    try {
      const d = await (await apiJson('/rank/run', {})).json();
      const ts = Object.entries(d.tier_counts || {}).map(([t, c]) => `${c} ${t}`).join(', ');
      setMsgs(p => [...p, { role: 'assistant', content: `Ranked ${d.ranked} leads: ${ts}` }]);
      load();
    } catch { setMsgs(p => [...p, { role: 'assistant', content: 'Ranking failed.' }]); }
    setRanking(false);
  };

  const toggleFilter = (t: string) => { const next = filter === t ? null : t; setFilter(next); fetchLeads(next); };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#020617', color: '#e2e8f0', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #111827', background: '#060a14' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>◈</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', letterSpacing: -0.3 }}>Rose Glass Sales</div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1.5, textTransform: 'uppercase' }}>CERATA Intelligence</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 2, marginLeft: 28, background: '#0f172a', borderRadius: 8, padding: 2 }}>
          {(['chat', 'leads'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); if (v === 'leads') fetchLeads(filter); }}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                background: view === v ? '#1e293b' : 'transparent',
                color: view === v ? '#f1f5f9' : '#64748b',
              }}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <ActionBtn label={scouting ? 'Scouting…' : 'Scout 10'} color="#8b5cf6" disabled={scouting} onClick={scout} />
          <ActionBtn label={ranking ? 'Ranking…' : 'Rank All'} color="#06b6d4" disabled={ranking} onClick={rank} />
        </div>
      </header>

      <StatsBar stats={stats} />

      {/* ── Chat ── */}
      {view === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{
                  maxWidth: '72%', padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? '#7c3aed' : '#111827',
                  color: m.role === 'user' ? '#fff' : '#e2e8f0',
                  borderBottomRightRadius: m.role === 'user' ? 2 : 10,
                  borderBottomLeftRadius: m.role === 'user' ? 10 : 2,
                }}>{m.content}</div>
              </div>
            ))}
            {busy && (
              <div style={{ display: 'flex', marginBottom: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#111827', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>◈ Analyzing…</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ padding: '10px 20px 16px', borderTop: '1px solid #111827' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder="Ask about leads, run analysis, give feedback…"
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #1e293b',
                  background: '#0a0f1a', color: '#f1f5f9', fontSize: 13, outline: 'none',
                }} />
              <button onClick={send} disabled={busy} style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: busy ? '#334155' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: '#fff', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontSize: 13,
              }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leads ── */}
      {view === 'leads' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '10px 14px', display: 'flex', gap: 5, borderBottom: '1px solid #111827', flexWrap: 'wrap' }}>
              {['hot', 'warm', 'cold', 'disqualified'].map(t => (
                <Pill key={t} label={t} active={filter === t} color={T[t]} onClick={() => toggleFilter(t)} />
              ))}
              {filter && <Pill label="clear" active={false} color="#64748b" onClick={() => toggleFilter(filter)} />}
            </div>
            {leads.map(l => <Card key={l.id} lead={l} sel={sel?.id === l.id} onClick={() => setSel(l)} />)}
            {!leads.length && <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>No leads match this filter.</div>}
          </div>
          {sel && <Detail lead={sel} onClose={() => setSel(null)} />}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '5px 12px', borderRadius: 6, border: `1px solid ${color}33`,
      background: disabled ? '#0f172a' : `${color}10`, color: disabled ? '#475569' : color,
      fontSize: 11, cursor: disabled ? 'default' : 'pointer', fontWeight: 600, transition: 'all 0.15s',
    }}>{label}</button>
  );
}
