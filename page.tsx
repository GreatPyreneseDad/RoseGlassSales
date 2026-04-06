'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// ─── Types ───────────────────────────────────────────────
interface Lead {
  id: string;
  full_name: string;
  title: string;
  company: string;
  company_industry: string;
  company_size_range: string;
  company_revenue: string;
  region: string;
  email: string;
  phone_number1: string;
  linkedin: string;
  linkedin_profile_url: string;
  rank_position: number;
  rank_score: number;
  coherence_score: number;
  qualification_tier: string;
  psi_intent: number;
  rho_authority: number;
  q_urgency: number;
  q_optimized: number;
  f_fit: number;
  dimensional_fractures: string;
  buying_signals: string;
  user_notes: string;
  user_status: string;
  outreach_status: string;
}

interface Stats {
  total: number;
  scored: number;
  tiers: Record<string, number>;
  avg_coherence: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Constants ───────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6',
  disqualified: '#6b7280', unscored: '#9ca3af',
};

const DIM_COLORS = { psi: '#8b5cf6', rho: '#06b6d4', q: '#f59e0b', f: '#10b981' };

// ─── Components ──────────────────────────────────────────
function DimBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ width: 18, fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, (value || 0) * 100)}%`, height: '100%',
          background: color, borderRadius: 3, transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ width: 36, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textAlign: 'right' }}>
        {value != null ? value.toFixed(2) : '—'}
      </span>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
      background: `${TIER_COLORS[tier] || '#6b7280'}22`,
      color: TIER_COLORS[tier] || '#6b7280',
      border: `1px solid ${TIER_COLORS[tier] || '#6b7280'}44`,
    }}>{tier || '—'}</span>
  );
}

function LeadCard({ lead, onClick, selected }: { lead: Lead; onClick: (l: Lead) => void; selected: boolean }) {
  return (
    <div onClick={() => onClick(lead)} style={{
      padding: '14px 16px', borderBottom: '1px solid #1e293b', cursor: 'pointer',
      background: selected ? '#0f172a' : 'transparent',
      borderLeft: selected ? '3px solid #8b5cf6' : '3px solid transparent',
      transition: 'all 0.15s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>
            {lead.rank_position ? `#${lead.rank_position} ` : ''}{lead.full_name}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{lead.title} · {lead.company}</div>
        </div>
        <TierBadge tier={lead.qualification_tier} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <DimBar label="Ψ" value={lead.psi_intent} color={DIM_COLORS.psi} />
        <DimBar label="ρ" value={lead.rho_authority} color={DIM_COLORS.rho} />
        <DimBar label="q" value={lead.q_optimized} color={DIM_COLORS.q} />
        <DimBar label="f" value={lead.f_fit} color={DIM_COLORS.f} />
      </div>
    </div>
  );
}

function LeadDetail({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  if (!lead) return null;
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
      background: '#0f172a', borderLeft: '1px solid #1e293b',
      overflowY: 'auto', zIndex: 100, padding: 24,
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16, background: 'none',
        border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer',
      }}>✕</button>

      <h2 style={{ margin: 0, fontSize: 20, color: '#f1f5f9' }}>{lead.full_name}</h2>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 16px' }}>
        {lead.title} at {lead.company}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <TierBadge tier={lead.qualification_tier} />
        <span style={{ fontSize: 12, color: '#64748b', lineHeight: '24px' }}>
          Coherence: {lead.coherence_score?.toFixed(2) || '—'} · Rank #{lead.rank_position || '—'}
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={sectionHeader}>Dimensional Profile</h3>
        <DimBar label="Ψ" value={lead.psi_intent} color={DIM_COLORS.psi} />
        <DimBar label="ρ" value={lead.rho_authority} color={DIM_COLORS.rho} />
        <DimBar label="q" value={lead.q_optimized} color={DIM_COLORS.q} />
        <DimBar label="f" value={lead.f_fit} color={DIM_COLORS.f} />
      </div>

      {lead.dimensional_fractures && lead.dimensional_fractures !== 'No fractures detected' && (
        <div style={{
          background: '#1e1b2e', border: '1px solid #7c3aed33', borderRadius: 8,
          padding: 12, marginBottom: 16, fontSize: 12, color: '#c4b5fd', lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 700 }}>⚡ Fractures: </span>{lead.dimensional_fractures}
        </div>
      )}

      {lead.buying_signals && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={sectionHeader}>Buying Signals</h3>
          <div style={{
            fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, background: '#1e293b',
            borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto',
          }}>{lead.buying_signals}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#94a3b8' }}>
        <div><strong style={{ color: '#64748b' }}>Region:</strong> {lead.region || '—'}</div>
        <div><strong style={{ color: '#64748b' }}>Industry:</strong> {lead.company_industry || '—'}</div>
        <div><strong style={{ color: '#64748b' }}>Size:</strong> {lead.company_size_range || '—'}</div>
        <div><strong style={{ color: '#64748b' }}>Revenue:</strong> {lead.company_revenue || '—'}</div>
        <div><strong style={{ color: '#64748b' }}>Email:</strong> {lead.email || '—'}</div>
        <div><strong style={{ color: '#64748b' }}>Phone:</strong> {lead.phone_number1 || '—'}</div>
      </div>

      {(lead.linkedin || lead.linkedin_profile_url) && (
        <a href={lead.linkedin || lead.linkedin_profile_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', marginTop: 12, color: '#8b5cf6', fontSize: 12, textDecoration: 'none' }}>
          LinkedIn →
        </a>
      )}
    </div>
  );
}

function StatsBar({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  return (
    <div style={{
      display: 'flex', gap: 16, padding: '10px 20px', borderBottom: '1px solid #1e293b',
      fontSize: 12, color: '#64748b', alignItems: 'center', flexWrap: 'wrap',
    }}>
      <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{stats.total} leads</span>
      {Object.entries(stats.tiers || {}).sort((a, b) => b[1] - a[1]).map(([tier, count]) => (
        <span key={tier} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: TIER_COLORS[tier] || '#6b7280' }} />
          {count} {tier}
        </span>
      ))}
      {stats.avg_coherence > 0 && (
        <span style={{ marginLeft: 'auto' }}>avg coherence: {stats.avg_coherence.toFixed(2)}</span>
      )}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: 12, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: 1.5, marginBottom: 8, fontWeight: 600,
};

// ─── Main App ────────────────────────────────────────────
export default function Home() {
  const [view, setView] = useState<'chat' | 'leads'>('chat');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Rose Glass Sales Intelligence online. I have access to your lead database — 566 leads from the behavioral health vertical, ranked by CERATA dimensional analysis.\n\nAsk me about your best leads, run scouts for buying signals, or get dimensional analysis on any prospect.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [scouting, setScouting] = useState(false);
  const [ranking, setRanking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchStats(); fetchLeads(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchStats = async () => {
    try { const r = await fetch(`${API}/api/stats`); setStats(await r.json()); } catch (e) { console.error(e); }
  };

  const fetchLeads = async (tier?: string | null) => {
    try {
      let url = `${API}/api/leads?limit=100`;
      if (tier) url += `&tier=${tier}`;
      const r = await fetch(url);
      setLeads(await r.json());
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: messages.slice(-10) }),
      });
      const data = await r.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.stats) setStats(data.stats);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Is the backend running?' }]);
    }
    setLoading(false);
  };

  const runScouts = async () => {
    setScouting(true);
    try {
      const r = await fetch(`${API}/api/scout/run?limit=10`, { method: 'POST' });
      const data = await r.json();
      setMessages(prev => [...prev, { role: 'assistant', content: `Scout run complete: ${data.scouted} leads scouted, ${data.updated} updated with buying signals.` }]);
      fetchStats();
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Scout run failed.' }]); }
    setScouting(false);
  };

  const runRanking = async () => {
    setRanking(true);
    try {
      const r = await fetch(`${API}/api/rank/run`, { method: 'POST' });
      const data = await r.json();
      const tierStr = Object.entries(data.tier_counts || {}).map(([t, c]) => `${c} ${t}`).join(', ');
      setMessages(prev => [...prev, { role: 'assistant', content: `Ranking complete: ${data.ranked} leads analyzed.\nTiers: ${tierStr}` }]);
      fetchStats(); fetchLeads();
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Ranking failed.' }]); }
    setRanking(false);
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#020617', color: '#e2e8f0', fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 20px',
        borderBottom: '1px solid #1e293b', background: '#0f172a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'white',
          }}>◈</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: -0.3 }}>Rose Glass Sales</div>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>CERATA Intelligence</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginLeft: 32 }}>
          {(['chat', 'leads'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); if (v === 'leads') fetchLeads(); }} style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: view === v ? '#1e293b' : 'transparent', color: view === v ? '#f1f5f9' : '#64748b',
            }}>{v === 'chat' ? 'Chat' : 'Leads'}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={runScouts} disabled={scouting} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #1e293b',
            background: '#0f172a', color: scouting ? '#475569' : '#8b5cf6', fontSize: 12, cursor: 'pointer',
          }}>{scouting ? 'Scouting...' : 'Scout 10'}</button>
          <button onClick={runRanking} disabled={ranking} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #1e293b',
            background: '#0f172a', color: ranking ? '#475569' : '#06b6d4', fontSize: 12, cursor: 'pointer',
          }}>{ranking ? 'Ranking...' : 'Rank All'}</button>
        </div>
      </div>

      <StatsBar stats={stats} />

      {/* Chat View */}
      {view === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12,
              }}>
                <div style={{
                  maxWidth: '75%', padding: '12px 16px', borderRadius: 12,
                  fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? '#7c3aed' : '#1e293b',
                  color: m.role === 'user' ? '#fff' : '#e2e8f0',
                  borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                  borderBottomLeftRadius: m.role === 'user' ? 12 : 2,
                }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: '#1e293b', color: '#64748b', fontSize: 14 }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your leads, run analysis, give feedback..."
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10,
                  border: '1px solid #1e293b', background: '#0f172a',
                  color: '#f1f5f9', fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={sendMessage} disabled={loading} style={{
                padding: '12px 20px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 14,
                opacity: loading ? 0.5 : 1,
              }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Leads View */}
      {view === 'leads' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 6, borderBottom: '1px solid #1e293b' }}>
              {['hot', 'warm', 'cold', 'disqualified'].map(t => (
                <button key={t} onClick={() => { const next = tierFilter === t ? null : t; setTierFilter(next); fetchLeads(next); }}
                  style={{
                    padding: '4px 12px', borderRadius: 12, border: `1px solid ${TIER_COLORS[t]}44`,
                    background: tierFilter === t ? `${TIER_COLORS[t]}22` : 'transparent',
                    color: TIER_COLORS[t], fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{t}</button>
              ))}
            </div>
            {leads.map(l => (
              <LeadCard key={l.id} lead={l} onClick={setSelected} selected={selected?.id === l.id} />
            ))}
            {leads.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No leads found.</div>
            )}
          </div>
          {selected && <LeadDetail lead={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
