'use client';
import { useState, useEffect } from 'react';

// ─── Scout Lab API ───────────────────────────────────────
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('rgs_token') : null;
const slAuth = (): Record<string, string> => {
  const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {};
};
const slApi = (path: string, opts?: RequestInit) =>
  fetch(`/scout-lab${path}`, { ...opts, headers: { ...slAuth(), ...opts?.headers } });
const slJson = (path: string, body: any) =>
  slApi(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ─── Types ───────────────────────────────────────────────
interface Mission {
  id: string; status: string; model: string; model_id: string;
  target_count: number; quality_bar: string;
  industries: string[]; titles: string[]; regions: string[];
  keywords: string[]; exclude: string[];
  product_context: string;
  candidates_found: number; candidates_approved: number; candidates_rejected: number;
  error: string | null;
  launched_at: string; completed_at: string | null;
}

interface Candidate {
  id: string; mission_id: string; status: string;
  full_name: string; email: string | null; title: string | null;
  company: string | null; company_domain: string | null;
  company_industry: string | null; company_description: string | null;
  company_size_range: string | null; company_revenue: string | null;
  company_country: string | null; region: string | null; locality: string | null;
  linkedin_profile_url: string | null;
  buying_signals: string | null; discovery_source: string | null;
  confidence_score: number | null;
  psi_intent: number; rho_authority: number;
  q_urgency: number; q_optimized: number; f_fit: number;
  coherence_score: number; qualification_tier: string;
  dimensional_fractures: string; rank_score: number;
  wiza_enrichment_status: string | null;
  migrated_lead_id: string | null;
  approved_at: string | null; rejected_at: string | null;
}

const MODELS = [
  { key: 'haiku', name: 'Haiku 4.5', desc: 'Fast — broad sweeps', cost: '~$0.003/lead', icon: '⚡' },
  { key: 'sonnet', name: 'Sonnet 4.6', desc: 'Balanced — hidden signals', cost: '~$0.015/lead', icon: '◈' },
  { key: 'opus', name: 'Opus 4.6', desc: 'Maximum intelligence', cost: '~$0.075/lead', icon: '◉' },
];

const TC: Record<string, string> = {
  hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6',
  disqualified: '#52525b', unscored: '#71717a', pending: '#8b5cf6',
  approved: '#22c55e', rejected: '#ef4444',
};
const DC = { psi: '#a78bfa', rho: '#22d3ee', q: '#fbbf24', f: '#34d399' };

// Theme-aware colors
const T = (theme: string) => ({
  bg: theme === 'dark' ? '#020617' : '#f8fafc',
  bgCard: theme === 'dark' ? '#0a0f1a' : '#ffffff',
  bgInput: theme === 'dark' ? '#0a0f1a' : '#ffffff',
  bgPanel: theme === 'dark' ? '#0f172a' : '#f1f5f9',
  border: theme === 'dark' ? '#1e293b' : '#e2e8f0',
  borderLight: theme === 'dark' ? '#111827' : '#f1f5f9',
  text: theme === 'dark' ? '#f1f5f9' : '#1e293b',
  textSecondary: theme === 'dark' ? '#e2e8f0' : '#334155',
  textMuted: theme === 'dark' ? '#94a3b8' : '#64748b',
  textDim: theme === 'dark' ? '#64748b' : '#94a3b8',
  textFaint: theme === 'dark' ? '#475569' : '#cbd5e1',
});

// ─── Tag Input ───────────────────────────────────────────
function TagInput({ label, tags, setTags, placeholder }: {
  label: string; tags: string[]; setTags: (t: string[]) => void; placeholder: string;
}) {
  const [val, setVal] = useState('');
  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) { setTags([...tags, v]); setVal(''); }
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {tags.map((t, i) => (
          <span key={i} onClick={() => setTags(tags.filter((_, j) => j !== i))}
            style={{ padding: '2px 8px', borderRadius: 4, background: '#1e293b', color: '#e2e8f0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t}<span style={{ color: '#64748b', fontSize: 10 }}>×</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1a', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
        <button onClick={add} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #1e293b', background: '#0f172a', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

// ─── Dimension Bar ───────────────────────────────────────
function DimBar({ sym, val, color }: { sym: string; val: number; color: string }) {
  const v = val ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color, width: 14, fontFamily: 'JetBrains Mono, monospace' }}>{sym}</span>
      <div style={{ flex: 1, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${v * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 9, color: '#64748b', width: 28, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{v.toFixed(2)}</span>
    </div>
  );
}

// ─── Candidate Card ──────────────────────────────────────
function CandidateCard({ cand, onApprove, onReject, busy }: {
  cand: Candidate; onApprove: (id: string) => void; onReject: (id: string) => void; busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const tier = cand.qualification_tier || 'unscored';
  const tierColor = TC[tier] || '#71717a';
  const statusColor = TC[cand.status] || '#8b5cf6';

  return (
    <div style={{
      border: `1px solid ${cand.status === 'pending' ? '#1e293b' : statusColor + '40'}`,
      borderRadius: 10, padding: 14, marginBottom: 8,
      background: cand.status === 'approved' ? '#22c55e08' : cand.status === 'rejected' ? '#ef444408' : '#0a0f1a',
      opacity: cand.status === 'rejected' ? 0.5 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{cand.full_name}</span>
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${tierColor}20`, color: tierColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tier}</span>
            {cand.status !== 'pending' && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${statusColor}20`, color: statusColor, fontWeight: 600 }}>
                {cand.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
              </span>
            )}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>{cand.title}{cand.company ? ` · ${cand.company}` : ''}</div>
          {cand.region && <div style={{ color: '#64748b', fontSize: 11 }}>{cand.locality ? `${cand.locality}, ` : ''}{cand.region}</div>}
        </div>
        {/* Confidence badge */}
        {cand.confidence_score != null && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: cand.confidence_score >= 0.7 ? '#34d399' : cand.confidence_score >= 0.4 ? '#fbbf24' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
              {(cand.confidence_score * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>confidence</div>
          </div>
        )}
      </div>

      {/* Dimension bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
        <DimBar sym="Ψ" val={cand.psi_intent} color={DC.psi} />
        <DimBar sym="ρ" val={cand.rho_authority} color={DC.rho} />
        <DimBar sym="q" val={cand.q_optimized} color={DC.q} />
        <DimBar sym="f" val={cand.f_fit} color={DC.f} />
      </div>

      {/* Contact info row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {cand.email && <span style={{ fontSize: 10, color: '#a78bfa', background: '#a78bfa10', padding: '1px 6px', borderRadius: 3 }}>✉ {cand.email}</span>}
        {cand.company_domain && <span style={{ fontSize: 10, color: '#22d3ee', background: '#22d3ee10', padding: '1px 6px', borderRadius: 3 }}>🌐 {cand.company_domain}</span>}
        {cand.linkedin_profile_url && <a href={cand.linkedin_profile_url} target="_blank" rel="noopener" style={{ fontSize: 10, color: '#3b82f6', background: '#3b82f610', padding: '1px 6px', borderRadius: 3, textDecoration: 'none' }}>LinkedIn ↗</a>}
        {!cand.email && !cand.linkedin_profile_url && <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>No contact info — enrich via Wiza or other tools</span>}
      </div>

      {/* Expand toggle */}
      <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: expanded ? 8 : 0 }}>
        {expanded ? '▾ Hide' : '▸ View'} Intel
      </button>

      {expanded && (
        <div style={{ marginBottom: 8 }}>
          {cand.buying_signals && (
            <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, padding: 8, background: '#0f172a', borderRadius: 6, marginBottom: 6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
              {cand.buying_signals}
            </div>
          )}
          {cand.discovery_source && (
            <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>Source: {cand.discovery_source}</div>
          )}
          {cand.dimensional_fractures && cand.dimensional_fractures !== 'No fractures' && (
            <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>⚠ {cand.dimensional_fractures}</div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {cand.status === 'pending' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onApprove(cand.id)} disabled={busy}
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #22c55e40', background: '#22c55e10', color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s' }}>
            ✓ Approve → Leads
          </button>
          <button onClick={() => onReject(cand.id)} disabled={busy}
            style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #ef444440', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s' }}>
            ✗
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN SCOUT LAB COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ScoutLab({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  // Mission builder state
  const [model, setModel] = useState('sonnet');
  const [targetCount, setTargetCount] = useState(10);
  const [qualityBar, setQualityBar] = useState('warm');
  const [industries, setIndustries] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [productContext, setProductContext] = useState('');

  // Mission & candidate state
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [launching, setLaunching] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [panel, setPanel] = useState<'builder' | 'results'>('builder');

  // Load missions on mount
  useEffect(() => { loadMissions(); }, []);

  // Cleanup polling on unmount
  useEffect(() => { return () => { if (pollInterval) clearInterval(pollInterval); }; }, [pollInterval]);

  const loadMissions = async () => {
    try {
      const resp = await slApi('/api/scout-lab/missions');
      if (resp.ok) setMissions(await resp.json());
    } catch (e) { console.error('Failed to load missions:', e); }
  };

  const loadMission = async (id: string) => {
    try {
      const resp = await slApi(`/api/scout-lab/missions/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setActiveMission(data.mission);
        setCandidates(data.candidates);
        setPanel('results');
        // If running, start polling
        if (data.mission.status === 'running' || data.mission.status === 'pending') {
          startPolling(id);
        }
      }
    } catch (e) { console.error('Failed to load mission:', e); }
  };

  const startPolling = (missionId: string) => {
    if (pollInterval) clearInterval(pollInterval);
    const iv = setInterval(async () => {
      try {
        const resp = await slApi(`/api/scout-lab/missions/${missionId}`);
        if (resp.ok) {
          const data = await resp.json();
          setActiveMission(data.mission);
          setCandidates(data.candidates);
          if (data.mission.status === 'complete' || data.mission.status === 'failed') {
            clearInterval(iv);
            setPollInterval(null);
            loadMissions(); // refresh sidebar
          }
        }
      } catch (e) { console.error('Poll error:', e); }
    }, 3000);
    setPollInterval(iv);
  };

  const launchMission = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      const resp = await slJson('/api/scout-lab/launch', {
        model, target_count: targetCount, quality_bar: qualityBar,
        industries, titles, regions, keywords, exclude,
        product_context: productContext,
      });
      if (resp.ok) {
        const data = await resp.json();
        setPanel('results');
        loadMission(data.mission_id);
        loadMissions();
      } else {
        const err = await resp.text();
        alert(`Launch failed: ${err}`);
      }
    } catch (e) { alert(`Launch error: ${e}`); }
    setLaunching(false);
  };

  const approveCandidate = async (id: string) => {
    setActionBusy(true);
    try {
      const resp = await slJson('/api/scout-lab/approve', { candidate_ids: [id] });
      if (resp.ok) {
        setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' } : c));
        loadMissions();
      }
    } catch (e) { console.error('Approve error:', e); }
    setActionBusy(false);
  };

  const rejectCandidate = async (id: string) => {
    setActionBusy(true);
    try {
      const resp = await slJson('/api/scout-lab/reject', { candidate_ids: [id] });
      if (resp.ok) {
        setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c));
        loadMissions();
      }
    } catch (e) { console.error('Reject error:', e); }
    setActionBusy(false);
  };

  const approveAll = async () => {
    const pending = candidates.filter(c => c.status === 'pending').map(c => c.id);
    if (!pending.length) return;
    setActionBusy(true);
    try {
      const resp = await slJson('/api/scout-lab/approve', { candidate_ids: pending });
      if (resp.ok) {
        setCandidates(prev => prev.map(c => pending.includes(c.id) ? { ...c, status: 'approved' } : c));
        loadMissions();
      }
    } catch (e) { console.error('Bulk approve error:', e); }
    setActionBusy(false);
  };

  const pendingCount = candidates.filter(c => c.status === 'pending').length;
  const approvedCount = candidates.filter(c => c.status === 'approved').length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar — mission history */}
      <div style={{ width: 220, borderRight: '1px solid #111827', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #111827' }}>
          <button onClick={() => { setActiveMission(null); setCandidates([]); setPanel('builder'); }}
            style={{ width: '100%', padding: '8px 0', borderRadius: 6, border: '1px dashed #334155', background: 'transparent', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + New Mission
          </button>
        </div>
        {missions.map(m => (
          <div key={m.id} onClick={() => loadMission(m.id)}
            style={{ padding: '10px 14px', borderBottom: '1px solid #0f172a', cursor: 'pointer', background: activeMission?.id === m.id ? '#1e293b' : 'transparent', transition: 'background 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{m.model.toUpperCase()}</span>
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                background: m.status === 'running' ? '#fbbf2420' : m.status === 'complete' ? '#22c55e20' : m.status === 'failed' ? '#ef444420' : '#8b5cf620',
                color: m.status === 'running' ? '#fbbf24' : m.status === 'complete' ? '#22c55e' : m.status === 'failed' ? '#ef4444' : '#8b5cf6',
              }}>{m.status}</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {m.candidates_found} found · {m.candidates_approved} approved
            </div>
            <div style={{ fontSize: 9, color: '#475569' }}>
              {new Date(m.launched_at).toLocaleDateString()} {new Date(m.launched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {!missions.length && <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 11 }}>No missions yet</div>}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {panel === 'builder' && (
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Scout Lab</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>Define your target. Choose your model. Launch the scout.</p>

            {/* Model selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 8 }}>Model</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {MODELS.map(m => (
                  <button key={m.key} onClick={() => setModel(m.key)}
                    style={{
                      padding: '12px 10px', borderRadius: 8, border: `1px solid ${model === m.key ? '#a78bfa' : '#1e293b'}`,
                      background: model === m.key ? '#a78bfa10' : '#0a0f1a', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: model === m.key ? '#a78bfa' : '#e2e8f0', marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{m.desc}</div>
                    <div style={{ fontSize: 9, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{m.cost}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target count + quality bar row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Target Count</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={1} max={50} value={targetCount} onChange={e => setTargetCount(+e.target.value)}
                    style={{ flex: 1, accentColor: '#a78bfa' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace', width: 28, textAlign: 'right' }}>{targetCount}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Quality Bar</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['cold', 'warm', 'hot'].map(q => (
                    <button key={q} onClick={() => setQualityBar(q)}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5, transition: 'all 0.15s',
                        border: `1px solid ${qualityBar === q ? (TC[q] || '#8b5cf6') + '80' : '#1e293b'}`,
                        background: qualityBar === q ? (TC[q] || '#8b5cf6') + '15' : '#0a0f1a',
                        color: qualityBar === q ? TC[q] || '#8b5cf6' : '#64748b',
                      }}>{q}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Signal flags */}
            <TagInput label="Industries" tags={industries} setTags={setIndustries} placeholder="e.g. Behavioral Health" />
            <TagInput label="Target Titles" tags={titles} setTags={setTitles} placeholder="e.g. CEO, VP of Sales" />
            <TagInput label="Regions" tags={regions} setTags={setRegions} placeholder="e.g. California, United States" />
            <TagInput label="Keywords" tags={keywords} setTags={setKeywords} placeholder="e.g. hiring, recently funded" />
            <TagInput label="Exclude" tags={exclude} setTags={setExclude} placeholder="e.g. staffing agency" />

            {/* Product context */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, display: 'block', marginBottom: 4 }}>Product Context <span style={{ color: '#475569', fontWeight: 400 }}>(optional)</span></label>
              <textarea value={productContext} onChange={e => setProductContext(e.target.value)} rows={2}
                placeholder="What are you selling? Helps the scout find relevant leads."
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b', background: '#0a0f1a', color: '#f1f5f9', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {/* Launch button */}
            <button onClick={launchMission} disabled={launching}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: launching ? 'default' : 'pointer', transition: 'all 0.2s',
                background: launching ? '#334155' : 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff',
              }}>
              {launching ? '◈ Launching Scout...' : `Launch ${MODELS.find(m=>m.key===model)?.name} Scout → ${targetCount} leads`}
            </button>
          </div>
        )}

        {panel === 'results' && activeMission && (
          <div style={{ padding: '16px 20px' }}>
            {/* Mission header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '12px 16px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Mission — {activeMission.model.toUpperCase()}</span>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                    background: activeMission.status === 'running' ? '#fbbf2420' : activeMission.status === 'complete' ? '#22c55e20' : activeMission.status === 'failed' ? '#ef444420' : '#8b5cf620',
                    color: activeMission.status === 'running' ? '#fbbf24' : activeMission.status === 'complete' ? '#22c55e' : activeMission.status === 'failed' ? '#ef4444' : '#8b5cf6',
                  }}>{activeMission.status === 'running' ? '◈ Scouting...' : activeMission.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
                  {activeMission.industries?.length > 0 && <span>Industries: {activeMission.industries.join(', ')}</span>}
                  {activeMission.titles?.length > 0 && <span>Titles: {activeMission.titles.join(', ')}</span>}
                  {activeMission.regions?.length > 0 && <span>Regions: {activeMission.regions.join(', ')}</span>}
                </div>
                {activeMission.error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{activeMission.error}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>{candidates.length}</div>
                <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>candidates</div>
              </div>
            </div>

            {/* Bulk actions bar */}
            {pendingCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: '#1e293b', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{pendingCount} pending · {approvedCount} approved</span>
                <button onClick={approveAll} disabled={actionBusy}
                  style={{ padding: '5px 14px', borderRadius: 5, border: '1px solid #22c55e40', background: '#22c55e15', color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: actionBusy ? 'default' : 'pointer' }}>
                  ✓ Approve All ({pendingCount})
                </button>
              </div>
            )}

            {/* Running state */}
            {(activeMission.status === 'running' || activeMission.status === 'pending') && candidates.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse 2s infinite' }}>◈</div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Scout is searching the web...</div>
                <div style={{ fontSize: 11 }}>This typically takes 30-90 seconds depending on the model.</div>
                <style>{`@keyframes pulse { 0%,100% { opacity:0.4 } 50% { opacity:1 } }`}</style>
              </div>
            )}

            {/* Candidate cards */}
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {candidates.map(c => (
                <CandidateCard key={c.id} cand={c} onApprove={approveCandidate} onReject={rejectCandidate} busy={actionBusy} />
              ))}
            </div>

            {activeMission.status === 'complete' && candidates.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#475569', fontSize: 13 }}>
                No candidates matched your criteria. Try broadening your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
