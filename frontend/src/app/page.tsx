'use client';

import { useState, useEffect, useRef } from 'react';
import ScoutLab from './ScoutLab';

// ─── API helpers with auth ───────────────────────────────
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('rgs_token') : null;
const authHeaders = (): Record<string, string> => {
  const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {};
};
const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
const apiJson = (path: string, body: any) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const apiUpload = (path: string, file: File) => {
  const fd = new FormData(); fd.append('file', file);
  return fetch(`/api${path}`, { method: 'POST', body: fd, headers: authHeaders() });
};

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
interface ChatMsg { role: 'user' | 'assistant'; content: string; written?: boolean; }

const TC: Record<string, string> = { hot:'#ef4444', warm:'#f59e0b', cold:'#3b82f6', disqualified:'#52525b', unscored:'#71717a' };
const DC = { psi:'#a78bfa', rho:'#22d3ee', q:'#fbbf24', f:'#34d399' };
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

// ─── Context line generators ─────────────────────────────
function dimContext(dim: string, val: number, lead: Lead): string {
  if (dim === 'psi') { return val >= 0.6 ? 'Active buying signals' : val >= 0.3 ? 'Moderate need signals' : 'No buying motion detected'; }
  if (dim === 'rho') { const t = (lead.title||'').toLowerCase(); if (t.match(/owner|ceo|founder|president/)) return 'Owner — full buying power'; if (t.match(/chief|cmo|cto/)) return 'C-suite — strong authority'; if (t.match(/vp|vice/)) return 'VP — can influence decisions'; if (val < 0.4) return 'May lack budget power'; return 'Decision authority detected'; }
  if (dim === 'q') { return val >= 0.5 ? 'Strong urgency signals' : val >= 0.2 ? 'Moderate time pressure' : 'No time pressure'; }
  if (dim === 'f') { if (val >= 0.7) return 'Strong ecosystem fit'; if (val >= 0.4) return 'Moderate fit — signals present'; return 'Low fit signals'; }
  return '';
}

// ─── Radar Chart SVG ─────────────────────────────────────
function Radar({ psi, rho, q, f, size=100, stroke='#8b5cf6' }: { psi:number; rho:number; q:number; f:number; size?:number; stroke?:string }) {
  const cx=60, cy=60, R=48;
  const pt = (a:number, v:number) => { const rad=(a-90)*Math.PI/180; const d=R*Math.max(0.05,v); return [cx+d*Math.cos(rad), cy+d*Math.sin(rad)]; };
  const top=pt(0,psi), right=pt(90,rho), bot=pt(180,q), left=pt(270,f);
  const grid = (s:number) => [pt(0,s),pt(90,s),pt(180,s),pt(270,s)].map(p=>p.join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{flexShrink:0}}>
      <polygon points={grid(1)} fill="none" stroke="#1e293b" strokeWidth="1"/>
      <polygon points={grid(0.66)} fill="none" stroke="#1e293b" strokeWidth="0.5"/>
      <polygon points={grid(0.33)} fill="none" stroke="#1e293b" strokeWidth="0.3"/>
      <line x1={cx} y1={cy-R} x2={cx} y2={cy+R} stroke="#1e293b" strokeWidth="0.3"/>
      <line x1={cx-R} y1={cy} x2={cx+R} y2={cy} stroke="#1e293b" strokeWidth="0.3"/>
      <polygon points={`${top.join(',')},${right.join(',')},${bot.join(',')},${left.join(',')}`} fill={`${stroke}18`} stroke={stroke} strokeWidth="1.5"/>
      <circle cx={top[0]} cy={top[1]} r="3" fill={DC.psi}/><circle cx={right[0]} cy={right[1]} r="3" fill={DC.rho}/>
      <circle cx={bot[0]} cy={bot[1]} r="3" fill={DC.q}/><circle cx={left[0]} cy={left[1]} r="3" fill={DC.f}/>
      <text x={cx} y="9" textAnchor="middle" fontSize="9" fill={DC.psi} fontFamily="JetBrains Mono" fontWeight="500">{"Ψ "}{(psi||0).toFixed(2)}</text>
      <text x="114" y={cy+3} textAnchor="start" fontSize="9" fill={DC.rho} fontFamily="JetBrains Mono" fontWeight="500">{"ρ "}{(rho||0).toFixed(1)}</text>
      <text x={cx} y="118" textAnchor="middle" fontSize="9" fill={DC.q} fontFamily="JetBrains Mono" fontWeight="500">{"q "}{(q||0).toFixed(2)}</text>
      <text x="6" y={cx+3} textAnchor="end" fontSize="9" fill={DC.f} fontFamily="JetBrains Mono" fontWeight="500">{"f "}{(f||0).toFixed(1)}</text>
    </svg>
  );
}

// ─── Dimension Row ───────────────────────────────────────
function DimRow({ sym, label, val, color, context, warn }: { sym:string; label:string; val:number; color:string; context:string; warn?:boolean }) {
  const v = val ?? 0; const dim = v < 0.2;
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,opacity:dim?0.5:1}}>
      <div style={{width:28,height:28,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0,...mono,background:`${color}15`,color,border:`1px solid ${color}30`}}>{sym}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:0.5,fontWeight:600}}>{label}</div>
        <div style={{height:5,background:'#1e293b',borderRadius:3,marginTop:3,overflow:'hidden'}}><div style={{width:`${Math.min(100,v*100)}%`,height:'100%',background:color,borderRadius:3,transition:'width 0.4s'}}/></div>
        <div style={{fontSize:10,color:warn?'#fbbf24':'#94a3b8',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{warn?'⚠ ':''}{context}</div>
      </div>
      <div style={{...mono,fontSize:10,color:'#475569',flexShrink:0,width:30,textAlign:'right'}}>{v?v.toFixed(2):'—'}</div>
    </div>
  );
}

function Tier({t}:{t:string}) { const c=TC[t]||'#52525b'; return <span style={{padding:'3px 12px',borderRadius:10,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:0.8,background:`${c}18`,color:c,border:`1px solid ${c}33`}}>{t||'—'}</span>; }

// ─── Lead Card ───────────────────────────────────────────
function LeadCard({ lead, onFocus }: { lead:Lead; onFocus:(l:Lead)=>void }) {
  const [open, setOpen] = useState(false);
  const hasFrac = lead.dimensional_fractures && lead.dimensional_fractures !== 'No fractures detected';
  const hasSignals = lead.buying_signals && !lead.buying_signals.startsWith('Scout error');
  const tc = TC[lead.qualification_tier]||'#52525b';
  return (
    <div style={{padding:'18px 20px',borderBottom:'1px solid #1e293b'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:12}}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'#f1f5f9'}}>{lead.rank_position?<span style={{...mono,fontSize:11,color:'#475569',marginRight:6}}>#{lead.rank_position}</span>:null}{lead.full_name}</div>
          <div style={{fontSize:12,color:'#64748b',marginTop:3}}>{lead.title} · {lead.company}{lead.region?` · ${lead.locality?lead.locality+', ':''}${lead.region}`:''}</div>
        </div>
        <Tier t={lead.qualification_tier}/>
      </div>
      <div style={{display:'flex',gap:20,alignItems:'start'}}>
        <Radar psi={lead.psi_intent} rho={lead.rho_authority} q={lead.q_optimized} f={lead.f_fit} size={100} stroke={tc}/>
        <div style={{flex:1}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px'}}>
            <DimRow sym="Ψ" label="Intent" val={lead.psi_intent} color={DC.psi} context={dimContext('psi',lead.psi_intent,lead)}/>
            <DimRow sym="ρ" label="Authority" val={lead.rho_authority} color={DC.rho} context={dimContext('rho',lead.rho_authority,lead)} warn={lead.rho_authority>0&&lead.rho_authority<0.4}/>
            <DimRow sym="q" label="Urgency" val={lead.q_optimized} color={DC.q} context={dimContext('q',lead.q_optimized,lead)}/>
            <DimRow sym="f" label="Fit" val={lead.f_fit} color={DC.f} context={dimContext('f',lead.f_fit,lead)}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginTop:12,padding:'7px 12px',background:'#111827',borderRadius:8,border:'1px solid #1e293b'}}>
            <span style={{fontSize:10,color:'#64748b'}}>Coherence</span>
            <div style={{flex:1,height:6,background:'#1e293b',borderRadius:3,overflow:'hidden'}}><div style={{width:`${Math.min(100,(lead.coherence_score||0)/4*100)}%`,height:'100%',borderRadius:3,background:`linear-gradient(90deg,#7c3aed,${tc})`}}/></div>
            <span style={{...mono,fontSize:16,fontWeight:700,color:tc}}>{lead.coherence_score?.toFixed(2)||'—'}</span>
          </div>
        </div>
      </div>
      {hasFrac&&<div style={{marginTop:10,padding:'10px 14px',background:'#16122a',border:'1px solid #7c3aed30',borderRadius:8,fontSize:11,color:'#c4b5fd',lineHeight:1.5}}><span style={{fontWeight:700}}>⚡ Fracture: </span>{lead.dimensional_fractures}</div>}

      {/* Contact info */}
      {(lead.email || lead.phone_number1 || lead.mobile_phone1) && (
        <div style={{marginTop:10,display:'flex',gap:16,fontSize:11,color:'#94a3b8',flexWrap:'wrap'}}>
          {lead.email && <span style={{...mono,color:'#a78bfa'}}>{lead.email}</span>}
          {(lead.phone_number1 || lead.mobile_phone1) && <span style={{...mono,color:'#64748b'}}>{lead.phone_number1 || lead.mobile_phone1}</span>}
        </div>
      )}

      {/* Action row */}
      <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
        <button onClick={()=>onFocus(lead)} style={{padding:'6px 14px',borderRadius:6,border:'1px solid #7c3aed33',background:'#7c3aed10',color:'#a78bfa',fontSize:11,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>◈ Focus — Call Mode</button>
        <button onClick={()=>setOpen(!open)} style={{padding:'6px 14px',borderRadius:6,border:'1px solid #1e293b',background:open?'#111827':'transparent',color:open?'#e2e8f0':'#64748b',fontSize:11,fontWeight:500,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4}}>
          {open?'▾ Hide':'▸ View'} Intel{hasSignals?' ●':''}
        </button>
        {(lead.linkedin||lead.linkedin_profile_url)&&<a href={lead.linkedin||lead.linkedin_profile_url} target="_blank" rel="noopener noreferrer" style={{padding:'6px 10px',borderRadius:6,border:'1px solid #1e293b',color:'#64748b',fontSize:11,textDecoration:'none',cursor:'pointer'}}>in LinkedIn</a>}
      </div>

      {/* Expandable intel section */}
      {open&&(
        <div style={{marginTop:12,padding:16,background:'#0a0f1a',borderRadius:10,border:'1px solid #1e293b'}}>
          {/* Contact info */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px 16px',fontSize:11,marginBottom:14}}>
            <div><span style={{color:'#475569'}}>Email: </span><span style={{color:'#94a3b8'}}>{lead.email||'—'}</span></div>
            <div><span style={{color:'#475569'}}>Phone: </span><span style={{color:'#94a3b8'}}>{lead.phone_number1||lead.mobile_phone1||'—'}</span></div>
            <div><span style={{color:'#475569'}}>Domain: </span>{lead.company_domain?<a href={`https://${lead.company_domain}`} target="_blank" rel="noopener noreferrer" style={{color:'#8b5cf6',textDecoration:'none'}}>{lead.company_domain}</a>:<span style={{color:'#94a3b8'}}>—</span>}</div>
            <div><span style={{color:'#475569'}}>Industry: </span><span style={{color:'#94a3b8'}}>{lead.company_industry||'—'}</span></div>
            <div><span style={{color:'#475569'}}>Size: </span><span style={{color:'#94a3b8'}}>{lead.company_size_range||'—'}</span></div>
            <div><span style={{color:'#475569'}}>Revenue: </span><span style={{color:'#94a3b8'}}>{lead.company_revenue||'—'}</span></div>
          </div>

          {/* Buying signals */}
          {hasSignals&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,marginBottom:6}}>Buying Signals</div>
              <div style={{fontSize:12,color:'#cbd5e1',lineHeight:1.6,background:'#111827',borderRadius:6,padding:12,maxHeight:240,overflowY:'auto',whiteSpace:'pre-wrap',border:'1px solid #1e293b'}}>{lead.buying_signals}</div>
            </div>
          )}
          {!hasSignals&&<div style={{fontSize:12,color:'#475569',fontStyle:'italic',marginBottom:12}}>No buying signals yet — this lead hasn't been scouted.</div>}

          {/* User notes */}
          {lead.user_notes&&(
            <div>
              <div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,marginBottom:6}}>Notes</div>
              <div style={{fontSize:12,color:'#cbd5e1',lineHeight:1.5,background:'#111827',borderRadius:6,padding:12,whiteSpace:'pre-wrap',border:'1px solid #1e293b'}}>{lead.user_notes}</div>
            </div>
          )}

          {/* Status indicators */}
          <div style={{display:'flex',gap:8,marginTop:12,fontSize:10,color:'#475569'}}>
            {lead.user_status&&lead.user_status!=='new'&&<span style={{padding:'2px 8px',borderRadius:4,background:'#1e293b',color:'#94a3b8'}}>{lead.user_status}</span>}
            {lead.outreach_status&&lead.outreach_status!=='none'&&<span style={{padding:'2px 8px',borderRadius:4,background:'#1e293b',color:'#94a3b8'}}>Outreach: {lead.outreach_status}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Call Profile Header ─────────────────────────────────
function CallProfile({lead}:{lead:Lead}) {
  const tc = TC[lead.qualification_tier]||'#52525b';
  return (
    <div style={{padding:'14px 20px',borderBottom:'1px solid #1e293b',background:'#0a0f1a',flexShrink:0}}>
      <div style={{display:'flex',gap:16,alignItems:'start'}}>
        <Radar psi={lead.psi_intent} rho={lead.rho_authority} q={lead.q_optimized} f={lead.f_fit} size={90} stroke={tc}/>
        <div style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:6}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'#f1f5f9'}}>{lead.full_name}</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{lead.title} · {lead.company}</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{lead.email||'—'} · {lead.phone_number1||lead.mobile_phone1||'—'}</div>
            </div>
            <Tier t={lead.qualification_tier}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginTop:6}}>
            {[{l:'Intent',v:lead.psi_intent,c:DC.psi},{l:'Authority',v:lead.rho_authority,c:DC.rho},{l:'Urgency',v:lead.q_optimized,c:DC.q},{l:'Fit',v:lead.f_fit,c:DC.f}].map(d=>(
              <div key={d.l} style={{textAlign:'center',padding:6,background:'#111827',borderRadius:6,border:'1px solid #1e293b'}}>
                <div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:0.5}}>{d.l}</div>
                <div style={{...mono,fontSize:16,fontWeight:700,color:d.c}}>{d.v?`${Math.round(d.v*100)}%`:'—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Utility Components ──────────────────────────────────
function CsvDropZone({onUploaded}:{onUploaded:(m:string)=>void}) {
  const [drag,setDrag]=useState(false); const [up,setUp]=useState(false); const ref=useRef<HTMLInputElement>(null);
  const handle=async(f:File)=>{ if(!/\.(csv|xlsx|xls|numbers)$/i.test(f.name)){onUploaded('Accepted: CSV, XLSX, Numbers.');return;} setUp(true); try{const r=await apiUpload('/upload-csv',f);const d=await r.json();onUploaded(r.ok?`Imported ${d.inserted} leads from ${d.filename}.`:`Failed: ${d.detail||'Error'}`);}catch{onUploaded('Upload failed.');} setUp(false); };
  return(<div onDrop={e=>{e.preventDefault();setDrag(false);if(e.dataTransfer.files[0])handle(e.dataTransfer.files[0]);}} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onClick={()=>ref.current?.click()} style={{margin:'10px 20px',padding:14,borderRadius:8,border:`2px dashed ${drag?'#8b5cf6':'#1e293b'}`,background:drag?'#8b5cf608':'#0a0f1a',cursor:'pointer',textAlign:'center'}}><input ref={ref} type="file" accept=".csv,.xlsx,.xls,.numbers" hidden onChange={e=>{if(e.target.files?.[0])handle(e.target.files[0]);e.target.value='';}}/>{up?<span style={{color:'#8b5cf6',fontSize:12}}>Uploading...</span>:<span style={{color:'#64748b',fontSize:12}}>Drop Wiza file or <span style={{color:'#8b5cf6',textDecoration:'underline'}}>browse</span></span>}</div>);
}
function ActionBtn({label,color,disabled,onClick}:{label:string;color:string;disabled:boolean;onClick:()=>void}){return<button onClick={onClick} disabled={disabled} style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${color}33`,background:disabled?'#0f172a':`${color}10`,color:disabled?'#475569':color,fontSize:11,cursor:disabled?'default':'pointer',fontWeight:600}}>{label}</button>;}
function QuickChips({onSend}:{onSend:(m:string)=>void}){return(<div style={{display:'flex',gap:5,marginBottom:6,flexWrap:'wrap'}}>{['Summarize call','Draft follow-up email','Re-rank this lead','What should I ask next?'].map(c=>(<button key={c} onClick={()=>onSend(c)} style={{padding:'3px 10px',borderRadius:12,border:'1px solid #1e293b',background:'transparent',color:'#64748b',fontSize:10,cursor:'pointer'}}>{c}</button>))}</div>);}

function LensPanel({onClose}:{onClose:()=>void}) {
  const[name,setName]=useState('');const[desc,setDesc]=useState('');
  const[props,setProps]=useState('');const[notThis,setNotThis]=useState('');
  const[terms,setTerms]=useState('');const[tone,setTone]=useState('');
  const[saved,setSaved]=useState(false);const[loading,setLoading]=useState(true);

  useEffect(()=>{api('/sales-lens').then(r=>r.json()).then(d=>{
    setName(d.product_name||'');setDesc(d.product_description||'');
    setProps((d.value_props||[]).join(', '));setNotThis((d.not_this||[]).join(', '));
    setTerms((d.industry_terms||[]).join(', '));setTone(d.tone||'');
    setLoading(false);
  }).catch(()=>setLoading(false));},[]);

  const save=async()=>{
    const split=(s:string)=>s.split(',').map(x=>x.trim()).filter(Boolean);
    await apiJson('/sales-lens',{
      product_name:name,product_description:desc,
      value_props:split(props),not_this:split(notThis),
      industry_terms:split(terms),tone,
    });setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  const inp:React.CSSProperties={padding:'8px 10px',borderRadius:6,border:'1px solid #1e293b',background:'#020617',color:'#f1f5f9',fontSize:12,outline:'none',width:'100%'};
  const lbl:React.CSSProperties={fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:4};
  const hint:React.CSSProperties={fontSize:10,color:'#475569',marginTop:2};

  return(
    <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)'}}>
      <div style={{width:480,maxHeight:'85vh',overflowY:'auto',background:'#0a0f1a',borderRadius:16,border:'1px solid #1e293b',padding:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <h2 style={{margin:0,fontSize:18,color:'#f1f5f9'}}>Sales Lens</h2>
            <p style={{margin:'4px 0 0',fontSize:11,color:'#64748b'}}>Define what you sell so the AI frames every conversation correctly</p>
          </div>
          <button onClick={onClose} style={{background:'#1e293b',border:'none',color:'#94a3b8',width:28,height:28,borderRadius:6,cursor:'pointer'}}>✕</button>
        </div>
        {loading?<div style={{color:'#475569',textAlign:'center',padding:20}}>Loading...</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><div style={lbl}>Product Name</div><input value={name} onChange={e=>setName(e.target.value)} placeholder="Team Recovery" style={inp}/></div>
            <div><div style={lbl}>What It Is</div><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Alumni program and engagement platform for treatment centers. Helps facilities track and support patients after discharge." rows={3} style={{...inp,resize:'vertical'}}/><div style={hint}>The AI will use this to frame every lead conversation.</div></div>
            <div><div style={lbl}>Value Propositions</div><input value={props} onChange={e=>setProps(e.target.value)} placeholder="Alumni engagement tracking, Outcome reporting, Referral network" style={inp}/><div style={hint}>Comma-separated. What your product actually delivers.</div></div>
            <div><div style={lbl}>NOT This (Critical)</div><input value={notThis} onChange={e=>setNotThis(e.target.value)} placeholder="NOT an EHR, NOT billing software, NOT clinical software" style={inp}/><div style={hint}>Comma-separated. What the AI should NEVER position your product as. This prevents misframing.</div></div>
            <div><div style={lbl}>Industry Terms</div><input value={terms} onChange={e=>setTerms(e.target.value)} placeholder="alumni program, recovery engagement, aftercare, post-discharge" style={inp}/><div style={hint}>Comma-separated. The language your market uses.</div></div>
            <div><div style={lbl}>Tone</div><input value={tone} onChange={e=>setTone(e.target.value)} placeholder="consultative, peer-to-peer, recovery-focused" style={inp}/><div style={hint}>How should the AI sound when talking about your product?</div></div>
            <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:8,border:'none',background:saved?'#34d39930':'linear-gradient(135deg,#7c3aed,#ec4899)',color:saved?'#34d399':'#fff',fontWeight:600,cursor:'pointer',fontSize:13,transition:'all 0.2s'}}>{saved?'✓ Saved':'Save Sales Lens'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ICPPanel({onClose}:{onClose:()=>void}) {
  const[titles,setTitles]=useState('');const[industries,setIndustries]=useState('');
  const[regions,setRegions]=useState('');const[keywords,setKeywords]=useState('');
  const[excludes,setExcludes]=useState('');const[sizeMin,setSizeMin]=useState('');
  const[sizeMax,setSizeMax]=useState('');const[notes,setNotes]=useState('');
  const[saved,setSaved]=useState(false);const[loading,setLoading]=useState(true);

  useEffect(()=>{api('/icp').then(r=>r.json()).then(d=>{
    setTitles((d.target_titles||[]).join(', '));
    setIndustries((d.target_industries||[]).join(', '));
    setRegions((d.target_regions||[]).join(', '));
    setKeywords((d.target_keywords||[]).join(', '));
    setExcludes((d.exclude_keywords||[]).join(', '));
    setSizeMin(d.target_company_size_min?.toString()||'');
    setSizeMax(d.target_company_size_max?.toString()||'');
    setNotes(d.notes||'');
    setLoading(false);
  }).catch(()=>setLoading(false));},[]);

  const save=async()=>{
    const split=(s:string)=>s.split(',').map(x=>x.trim()).filter(Boolean);
    const body={
      target_titles:split(titles),target_industries:split(industries),
      target_regions:split(regions),target_keywords:split(keywords),
      exclude_keywords:split(excludes),
      target_company_size_min:sizeMin?parseInt(sizeMin):null,
      target_company_size_max:sizeMax?parseInt(sizeMax):null,
      notes,
    };
    await apiJson('/icp',body);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  const inp:React.CSSProperties={padding:'8px 10px',borderRadius:6,border:'1px solid #1e293b',background:'#020617',color:'#f1f5f9',fontSize:12,outline:'none',width:'100%'};
  const lbl:React.CSSProperties={fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:4};
  const hint:React.CSSProperties={fontSize:10,color:'#475569',marginTop:2};

  return(
    <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)'}}>
      <div style={{width:480,maxHeight:'85vh',overflowY:'auto',background:'#0a0f1a',borderRadius:16,border:'1px solid #1e293b',padding:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <h2 style={{margin:0,fontSize:18,color:'#f1f5f9'}}>Ideal Customer Profile</h2>
            <p style={{margin:'4px 0 0',fontSize:11,color:'#64748b'}}>Define your ICP to calibrate lead scoring</p>
          </div>
          <button onClick={onClose} style={{background:'#1e293b',border:'none',color:'#94a3b8',width:28,height:28,borderRadius:6,cursor:'pointer'}}>✕</button>
        </div>
        {loading?<div style={{color:'#475569',textAlign:'center',padding:20}}>Loading...</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><div style={lbl}>Target Titles</div><input value={titles} onChange={e=>setTitles(e.target.value)} placeholder="VP Sales, Head of BD, CRO, CEO" style={inp}/><div style={hint}>Comma-separated. Leads matching these titles get an authority (ρ) boost.</div></div>
            <div><div style={lbl}>Target Industries</div><input value={industries} onChange={e=>setIndustries(e.target.value)} placeholder="SaaS, Healthcare, Financial Services" style={inp}/><div style={hint}>Comma-separated. Matching leads get a fit (f) boost.</div></div>
            <div style={{display:'flex',gap:10}}>
              <div style={{flex:1}}><div style={lbl}>Company Size Min</div><input value={sizeMin} onChange={e=>setSizeMin(e.target.value)} placeholder="50" type="number" style={inp}/></div>
              <div style={{flex:1}}><div style={lbl}>Company Size Max</div><input value={sizeMax} onChange={e=>setSizeMax(e.target.value)} placeholder="5000" type="number" style={inp}/></div>
            </div>
            <div><div style={lbl}>Target Regions</div><input value={regions} onChange={e=>setRegions(e.target.value)} placeholder="United States, Canada, United Kingdom" style={inp}/><div style={hint}>Comma-separated. Minor fit boost for matching regions.</div></div>
            <div><div style={lbl}>Buying Signal Keywords</div><input value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="CRM, pipeline, sales ops, revenue operations" style={inp}/><div style={hint}>Comma-separated. Leads with these in their signals get an intent (Ψ) boost.</div></div>
            <div><div style={lbl}>Exclude Keywords</div><input value={excludes} onChange={e=>setExcludes(e.target.value)} placeholder="intern, student, retired, nonprofit" style={inp}/><div style={hint}>Comma-separated. Leads with these get penalized on intent and fit.</div></div>
            <div><div style={lbl}>Notes</div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe your ideal customer in plain language..." rows={3} style={{...inp,resize:'vertical'}}/></div>
            <button onClick={save} style={{width:'100%',padding:'10px 0',borderRadius:8,border:'none',background:saved?'#34d39930':'linear-gradient(135deg,#7c3aed,#ec4899)',color:saved?'#34d399':'#fff',fontWeight:600,cursor:'pointer',fontSize:13,transition:'all 0.2s'}}>{saved?'✓ Saved — Re-rank to apply':'Save ICP Profile'}</button>
            <div style={{fontSize:10,color:'#475569',textAlign:'center'}}>After saving, click "Rank All" to re-score your leads against this profile.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoginScreen({onLogin}:{onLogin:(u:any)=>void}){const[mode,setMode]=useState<'login'|'register'>('login');const[un,setUn]=useState('');const[pw,setPw]=useState('');const[dn,setDn]=useState('');const[cn,setCn]=useState('');const[err,setErr]=useState('');const[ld,setLd]=useState(false);const sub=async()=>{setErr('');setLd(true);try{const ep=mode==='login'?'/auth/login':'/auth/register';const body=mode==='login'?{username:un,password:pw}:{username:un,password:pw,display_name:dn,company_name:cn};const r=await fetch(`/api${ep}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){setErr(d.detail||'Failed');setLd(false);return;}localStorage.setItem('rgs_token',d.token);onLogin(d.user||{username:un});}catch{setErr('Connection error');}setLd(false);};const inp:React.CSSProperties={padding:'10px 12px',borderRadius:8,border:'1px solid #1e293b',background:'#020617',color:'#f1f5f9',fontSize:13,outline:'none',width:'100%'};return(<div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#020617',fontFamily:"'DM Sans',sans-serif"}}><div style={{width:360,padding:32,background:'#0a0f1a',borderRadius:16,border:'1px solid #1e293b'}}><div style={{textAlign:'center',marginBottom:24}}><div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#7c3aed,#ec4899)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:'#fff',marginBottom:12}}>◈</div><h1 style={{margin:0,fontSize:20,color:'#f1f5f9',fontWeight:700}}>Rose Glass Sales</h1><p style={{margin:'4px 0 0',fontSize:11,color:'#475569',letterSpacing:1.5,textTransform:'uppercase'}}>CERATA Intelligence</p></div><div style={{display:'flex',gap:2,background:'#0f172a',borderRadius:8,padding:2,marginBottom:20}}>{(['login','register'] as const).map(m=>(<button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:'7px 0',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,background:mode===m?'#1e293b':'transparent',color:mode===m?'#f1f5f9':'#64748b'}}>{m==='login'?'Sign In':'Create Account'}</button>))}</div><div style={{display:'flex',flexDirection:'column',gap:10}}><input value={un} onChange={e=>setUn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sub()} placeholder="Username" style={inp}/><input value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sub()} placeholder="Password" type="password" style={inp}/>{mode==='register'&&<><input value={dn} onChange={e=>setDn(e.target.value)} placeholder="Your name" style={inp}/><input value={cn} onChange={e=>setCn(e.target.value)} placeholder="Company name" style={inp}/></>}{err&&<div style={{color:'#ef4444',fontSize:12}}>{err}</div>}<button onClick={sub} disabled={ld} style={{padding:'10px 0',borderRadius:8,border:'none',background:ld?'#334155':'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:600,cursor:ld?'default':'pointer',fontSize:14}}>{ld?'Loading...':mode==='login'?'Sign In':'Create Account'}</button></div></div></div>);}

function SettingsPanel({user,onClose,onLogout}:{user:any;onClose:()=>void;onLogout:()=>void}){const[dn,setDn]=useState(user?.display_name||'');const[em,setEm]=useState(user?.email||'');const[ph,setPh]=useState(user?.phone||'');const[cn,setCn]=useState(user?.company_name||'');const[cp,setCp]=useState('');const[np,setNp]=useState('');const[msg,setMsg]=useState('');const inp:React.CSSProperties={padding:'8px 10px',borderRadius:6,border:'1px solid #1e293b',background:'#020617',color:'#f1f5f9',fontSize:12,outline:'none',width:'100%'};const btn:React.CSSProperties={width:'100%',padding:'7px 0',borderRadius:6,border:'none',background:'#7c3aed22',color:'#a78bfa',fontSize:11,fontWeight:600,cursor:'pointer',marginTop:8};return(<div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)'}}><div style={{width:400,maxHeight:'80vh',overflowY:'auto',background:'#0a0f1a',borderRadius:16,border:'1px solid #1e293b',padding:24}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><h2 style={{margin:0,fontSize:18,color:'#f1f5f9'}}>Settings</h2><button onClick={onClose} style={{background:'#1e293b',border:'none',color:'#94a3b8',width:28,height:28,borderRadius:6,cursor:'pointer'}}>✕</button></div><div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,marginBottom:6}}>Profile</div><div style={{display:'flex',flexDirection:'column',gap:6}}><input value={dn} onChange={e=>setDn(e.target.value)} placeholder="Display name" style={inp}/><input value={em} onChange={e=>setEm(e.target.value)} placeholder="Email" style={inp}/><input value={ph} onChange={e=>setPh(e.target.value)} placeholder="Phone" style={inp}/><input value={cn} onChange={e=>setCn(e.target.value)} placeholder="Company" style={inp}/><button onClick={async()=>{const r=await api('/auth/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({display_name:dn,email:em,phone:ph,company_name:cn})});setMsg(r.ok?'Saved':'Failed');}} style={btn}>Save</button></div><div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:1.5,fontWeight:600,margin:'16px 0 6px'}}>Password</div><div style={{display:'flex',flexDirection:'column',gap:6}}><input value={cp} onChange={e=>setCp(e.target.value)} placeholder="Current password" type="password" style={inp}/><input value={np} onChange={e=>setNp(e.target.value)} placeholder="New password" type="password" style={inp}/><button onClick={async()=>{if(!cp||!np)return;const r=await apiJson('/auth/change-password',{current_password:cp,new_password:np});setMsg(r.ok?'Changed':'Failed');setCp('');setNp('');}} style={btn}>Change Password</button></div>{msg&&<div style={{color:'#8b5cf6',fontSize:12,textAlign:'center',padding:'8px 0'}}>{msg}</div>}<button onClick={onLogout} style={{...btn,background:'#1e293b',color:'#ef4444',border:'1px solid #ef444433',marginTop:16}}>Sign Out</button></div></div>);}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export default function Home(){
  const[authed,setAuthed]=useState(false);const[user,setUser]=useState<any>(null);const[showSettings,setShowSettings]=useState(false);
  const[view,setView]=useState<'chat'|'leads'|'scout-lab'>('chat');const[leads,setLeads]=useState<Lead[]>([]);const[stats,setStats]=useState<Stats|null>(null);
  const[focusLead,setFocusLead]=useState<Lead|null>(null);
  const[showICP,setShowICP]=useState(false);
  const[showLens,setShowLens]=useState(false);
  const[msgs,setMsgs]=useState<ChatMsg[]>([{role:'assistant',content:'Rose Glass Sales Intelligence online. Ask me about your leads, or switch to Leads and hit Focus to enter call mode.'}]);
  const[focusMsgs,setFocusMsgs]=useState<ChatMsg[]>([]);const[input,setInput]=useState('');
  const[busy,setBusy]=useState(false);const[scouting,setScouting]=useState(false);const[scoutingWarm,setScoutingWarm]=useState(false);const[ranking,setRanking]=useState(false);const[filter,setFilter]=useState<string|null>(null);
  const endRef=useRef<HTMLDivElement>(null);const focusEndRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const t=localStorage.getItem('rgs_token');if(t){api('/auth/me').then(r=>r.ok?r.json():Promise.reject()).then(u=>{setUser(u);setAuthed(true);load();}).catch(()=>{localStorage.removeItem('rgs_token');});}fetch('/api/auth/me').then(r=>{if(r.status===404||r.status===405){setAuthed(true);load();}}).catch(()=>{});},[]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);
  useEffect(()=>{focusEndRef.current?.scrollIntoView({behavior:'smooth'});},[focusMsgs]);
  useEffect(()=>{if(!authed)return;const iv=setInterval(()=>{api('/stats').then(r=>r.json()).then(setStats).catch(()=>{});},30000);return()=>clearInterval(iv);},[authed]);
  const handleLogin=(u:any)=>{setUser(u);setAuthed(true);load();};
  const handleLogout=()=>{api('/auth/logout',{method:'POST'});localStorage.removeItem('rgs_token');setAuthed(false);setUser(null);};
  const load=()=>{api('/stats').then(r=>r.json()).then(setStats).catch(()=>{});fetchLeads();};
  const fetchLeads=(t?:string|null,append?:boolean)=>{let url=`/leads?limit=500&offset=${append?leads.length:0}`;if(t)url+=`&tier=${t}`;api(url).then(r=>r.json()).then(d=>{if(append){setLeads(p=>[...p,...d]);}else{setLeads(d);}}).catch(()=>{});};
  const send=async()=>{if(!input.trim()||busy)return;const m=input.trim();setInput('');setBusy(true);setMsgs(p=>[...p,{role:'user',content:m}]);try{const r=await apiJson('/chat',{message:m,history:msgs.slice(-10)});const d=await r.json();setMsgs(p=>[...p,{role:'assistant',content:d.reply}]);if(d.stats)setStats(d.stats);}catch{setMsgs(p=>[...p,{role:'assistant',content:'Connection error.'}]);}setBusy(false);};
  const sendFocus=async(override?:string)=>{const m=override||input.trim();if(!m||busy||!focusLead)return;if(!override)setInput('');setBusy(true);setFocusMsgs(p=>[...p,{role:'user',content:m}]);try{const cleanHistory=focusMsgs.slice(-6).map(h=>({role:h.role,content:h.content}));const r=await apiJson('/chat/focus',{message:m,lead_id:focusLead.id,history:cleanHistory});if(!r.ok){const err=await r.text();setFocusMsgs(p=>[...p,{role:'assistant',content:`Error: ${r.status} — ${err.slice(0,200)}`}]);setBusy(false);return;}const d=await r.json();setFocusMsgs(p=>[...p,{role:'assistant',content:d.reply||'No response generated.',written:d.wrote||false}]);if(d.lead)setFocusLead(d.lead);}catch(e:any){setFocusMsgs(p=>[...p,{role:'assistant',content:`Connection error: ${e?.message||'unknown'}`}]);}setBusy(false);};
  const enterFocus=(lead:Lead)=>{setFocusLead(lead);setFocusMsgs([{role:'assistant',content:`Focused on ${lead.full_name} — ${lead.title} at ${lead.company}.\n\n${lead.buying_signals?'Intel on file. Ready when you are.':'No scout data yet — I can scout this lead before you call.'}\n\nType notes during the call and I'll write them to the profile.`}]);};
  const exitFocus=()=>{setFocusLead(null);setFocusMsgs([]);load();};
  const scout=async()=>{setScouting(true);try{await api('/scout/run?limit=10',{method:'POST'});load();}catch{}setScouting(false);};
  const scoutWarm=async()=>{setScoutingWarm(true);try{await api('/scout/run?tier=warm&limit=50',{method:'POST'});load();}catch{}setScoutingWarm(false);};
  const rank=async()=>{setRanking(true);try{await api('/rank/run',{method:'POST'});load();}catch{}setRanking(false);};
  if(!authed)return<LoginScreen onLogin={handleLogin}/>;
  // ─── CALL MODE ─────────────────────────────────────────
  if(focusLead)return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#020617',color:'#e2e8f0',fontFamily:"'DM Sans',sans-serif"}}>
      {showLens&&<LensPanel onClose={()=>setShowLens(false)}/>}
      {showICP&&<ICPPanel onClose={()=>setShowICP(false)}/>}
      {showSettings&&<SettingsPanel user={user} onClose={()=>setShowSettings(false)} onLogout={handleLogout}/>}
      <div style={{display:'flex',alignItems:'center',padding:'10px 20px',borderBottom:'1px solid #111827',background:'#060a14',flexShrink:0}}>
        <button onClick={exitFocus} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #1e293b',background:'transparent',color:'#64748b',fontSize:12,cursor:'pointer',marginRight:16}}>← Back</button>
        <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:24,height:24,borderRadius:5,background:'linear-gradient(135deg,#7c3aed,#ec4899)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#fff'}}>◈</div><span style={{fontSize:13,fontWeight:700,color:'#f1f5f9'}}>Rose Glass Sales</span></div>
        <div style={{marginLeft:'auto',padding:'4px 12px',borderRadius:12,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,background:'#ef444420',color:'#ef4444',border:'1px solid #ef444440',animation:'pulse 2s ease-in-out infinite'}}>● Live — {focusLead.full_name}</div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
      </div>
      <CallProfile lead={focusLead}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'14px 20px 0'}}>
          {focusMsgs.map((m,i)=>(<div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:10}}><div><div style={{maxWidth:'75%',padding:'10px 14px',borderRadius:10,fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap',wordBreak:'break-word',background:m.role==='user'?'#7c3aed':'#111827',color:m.role==='user'?'#fff':'#e2e8f0',borderBottomRightRadius:m.role==='user'?2:10,borderBottomLeftRadius:m.role==='user'?10:2}}>{m.content}</div>{m.role==='assistant'&&m.written&&<div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:4,padding:'2px 8px',borderRadius:4,fontSize:9,background:'#34d39915',color:'#34d399',border:'1px solid #34d39930',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>✓ Written to profile</div>}</div></div>))}
          {busy&&<div style={{display:'flex',marginBottom:10}}><div style={{padding:'10px 14px',borderRadius:10,background:'#111827',color:'#64748b',fontSize:13}}>◈ Working...</div></div>}
          <div ref={focusEndRef}/>
        </div>
        <div style={{padding:'8px 20px 14px',borderTop:'1px solid #111827',flexShrink:0}}>
          <QuickChips onSend={sendFocus}/>
          <div style={{display:'flex',gap:6}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),sendFocus())} placeholder="Type call notes, ask questions..." style={{flex:1,padding:'10px 14px',borderRadius:8,border:'1px solid #1e293b',background:'#0a0f1a',color:'#f1f5f9',fontSize:13,outline:'none'}}/><button onClick={()=>sendFocus()} disabled={busy} style={{padding:'10px 18px',borderRadius:8,border:'none',background:busy?'#334155':'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:600,cursor:busy?'default':'pointer',fontSize:13}}>Send</button></div>
        </div>
      </div>
    </div>
  );
  // ─── MAIN VIEW ─────────────────────────────────────────
  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#020617',color:'#e2e8f0',fontFamily:"'DM Sans',-apple-system,sans-serif"}}>
      {showLens&&<LensPanel onClose={()=>setShowLens(false)}/>}
      {showICP&&<ICPPanel onClose={()=>setShowICP(false)}/>}
      {showSettings&&<SettingsPanel user={user} onClose={()=>setShowSettings(false)} onLogout={handleLogout}/>}
      <header style={{display:'flex',alignItems:'center',padding:'10px 20px',borderBottom:'1px solid #111827',background:'#060a14'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:30,height:30,borderRadius:7,background:'linear-gradient(135deg,#7c3aed,#ec4899)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#fff'}}>◈</div><div><div style={{fontSize:14,fontWeight:700,color:'#f1f5f9',letterSpacing:-0.3}}>Rose Glass Sales</div><div style={{fontSize:9,color:'#475569',letterSpacing:1.5,textTransform:'uppercase'}}>CERATA Intelligence</div></div></div>
        <nav style={{display:'flex',gap:2,marginLeft:28,background:'#0f172a',borderRadius:8,padding:2}}>{(['chat','leads','scout-lab'] as const).map(v=>(<button key={v} onClick={()=>{setView(v);if(v==='leads')fetchLeads(filter);}} style={{padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,background:view===v?'#1e293b':'transparent',color:view===v?'#f1f5f9':'#64748b'}}>{v==='scout-lab'?'Scout Lab':v.charAt(0).toUpperCase()+v.slice(1)}</button>))}</nav>
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          <ActionBtn label={scouting?'Scouting…':'Scout 10'} color="#8b5cf6" disabled={scouting} onClick={scout}/>
          <ActionBtn label={scoutingWarm?'Scouting…':'Scout Warm'} color="#f59e0b" disabled={scoutingWarm} onClick={scoutWarm}/>
          <ActionBtn label={ranking?'Ranking…':'Rank All'} color="#06b6d4" disabled={ranking} onClick={rank}/>
          <button onClick={()=>setShowLens(true)} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #ec489933',background:'#ec489908',color:'#ec4899',fontSize:11,cursor:'pointer',fontWeight:600}} title="Sales Lens">Lens</button>
          <button onClick={()=>setShowICP(true)} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #7c3aed33',background:'#7c3aed08',color:'#a78bfa',fontSize:11,cursor:'pointer',fontWeight:600}} title="Ideal Customer Profile">ICP</button>
          <button onClick={()=>setShowSettings(true)} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #1e293b',background:'transparent',color:'#64748b',fontSize:14,cursor:'pointer'}} title="Settings">⚙</button>
        </div>
      </header>
      {stats&&<div style={{display:'flex',gap:14,padding:'8px 20px',borderBottom:'1px solid #111827',fontSize:11,color:'#475569',alignItems:'center',background:'#060a14'}}><span style={{color:'#e2e8f0',fontWeight:600}}>{stats.total}</span>{Object.entries(stats.tiers||{}).sort((a,b)=>b[1]-a[1]).map(([tier,n])=>(<span key={tier} style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:6,height:6,borderRadius:3,background:TC[tier]||'#52525b'}}/>{n} {tier}</span>))}</div>}
      {view==='chat'&&(<div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{flex:1,overflowY:'auto',padding:'16px 20px 0'}}>{msgs.map((m,i)=>(<div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:10}}><div style={{maxWidth:'72%',padding:'10px 14px',borderRadius:10,fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap',wordBreak:'break-word',background:m.role==='user'?'#7c3aed':'#111827',color:m.role==='user'?'#fff':'#e2e8f0',borderBottomRightRadius:m.role==='user'?2:10,borderBottomLeftRadius:m.role==='user'?10:2}}>{m.content}</div></div>))}{busy&&<div style={{display:'flex',marginBottom:10}}><div style={{padding:'10px 14px',borderRadius:10,background:'#111827',color:'#64748b',fontSize:13}}>◈ Analyzing...</div></div>}<div ref={endRef}/></div><CsvDropZone onUploaded={m=>{setMsgs(p=>[...p,{role:'assistant',content:m}]);load();}}/><div style={{padding:'10px 20px 16px',borderTop:'1px solid #111827'}}><div style={{display:'flex',gap:6}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Ask about leads, run analysis, give feedback…" style={{flex:1,padding:'10px 14px',borderRadius:8,border:'1px solid #1e293b',background:'#0a0f1a',color:'#f1f5f9',fontSize:13,outline:'none'}}/><button onClick={send} disabled={busy} style={{padding:'10px 18px',borderRadius:8,border:'none',background:busy?'#334155':'linear-gradient(135deg,#7c3aed,#ec4899)',color:'#fff',fontWeight:600,cursor:busy?'default':'pointer',fontSize:13}}>Send</button></div></div></div>)}
      {view==='leads'&&(<div style={{flex:1,overflowY:'auto'}}><div style={{padding:'10px 14px',display:'flex',gap:5,borderBottom:'1px solid #111827',flexWrap:'wrap'}}>{['hot','warm','cold','disqualified'].map(t=>(<button key={t} onClick={()=>{const next=filter===t?null:t;setFilter(next);fetchLeads(next);}} style={{padding:'3px 10px',borderRadius:10,border:`1px solid ${TC[t]}44`,background:filter===t?`${TC[t]}20`:'transparent',color:filter===t?TC[t]:'#64748b',fontSize:10,cursor:'pointer',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>{t}</button>))}</div>{leads.map(l=><LeadCard key={l.id} lead={l} onFocus={enterFocus}/>)}{!leads.length&&<div style={{padding:40,textAlign:'center',color:'#475569',fontSize:13}}>No leads match.</div>}
          {leads.length>0&&leads.length%500===0&&<div style={{padding:16,textAlign:'center'}}><button onClick={()=>fetchLeads(filter,true)} style={{padding:'8px 24px',borderRadius:8,border:'1px solid #7c3aed33',background:'#7c3aed10',color:'#a78bfa',fontSize:12,fontWeight:600,cursor:'pointer'}}>Load More</button></div>}
          {leads.length>0&&<div style={{padding:8,textAlign:'center',color:'#475569',fontSize:11}}>Showing {leads.length} leads</div>}</div>)}
      {view==='scout-lab'&&(<div style={{flex:1,overflow:'hidden'}}><ScoutLab/></div>)}
    </div>
  );
}
