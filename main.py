"""
Rose Glass Sales Platform — Backend
====================================
Scout agents, CERATA ranking engine, chat API.

Supabase project: xrzycmvpqohxxlhnorpt (rose-glass-sales)
Deployment: Railway

Author: Christopher MacGregor bin Joseph
ROSE Corp / MacGregor Holding Company
"""

import os
import json
import csv
import io
import math
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rose-glass-sales")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xrzycmvpqohxxlhnorpt.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
PORT = int(os.environ.get("PORT", 8000))

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

app = FastAPI(title="Rose Glass Sales Platform", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════
# CERATA V2 BRIDGE — Computational dimensional analysis
# ═══════════════════════════════════════════════════════════

class CERATABridge:
    """
    Computational Rose Glass analysis for buying signals.
    No LLM calls — pure math on signal text.

    Dimensions (CRM calibration):
    - Ψ: Intent coherence — need/solution match
    - ρ: Decision authority — can they buy?
    - q: Urgency/activation — bio-optimized via Michaelis-Menten
    - f: Fit/belonging — ICP alignment

    C = Ψ + (ρ × Ψ) + q_opt + (f × Ψ) + coupling
    q_opt = q / (Km + q + q²/Ki)
    """

    KM = 0.20
    KI = 0.80
    COUPLING_STRENGTH = 0.15

    PSI_SIGNALS = {
        "looking for": 0.7, "need a solution": 0.8, "evaluating": 0.7,
        "searching for": 0.6, "want to implement": 0.8, "interested in": 0.5,
        "exploring options": 0.6, "considering": 0.5, "planning to": 0.7,
        "ready to": 0.8, "seeking": 0.6, "require": 0.7, "must have": 0.8,
        "pain point": 0.7, "challenge": 0.5, "struggling with": 0.7,
        "frustrated with": 0.6, "current solution failing": 0.9,
        "looking to switch": 0.8, "replacing": 0.8, "upgrading": 0.7,
        "scaling": 0.6, "growing": 0.5, "expanding": 0.5,
        "client management": 0.7, "patient engagement": 0.7,
        "admissions": 0.6, "intake": 0.6, "referral": 0.6,
        "census": 0.7, "bed count": 0.6, "occupancy": 0.7,
        "marketing roi": 0.7, "lead tracking": 0.8,
    }

    RHO_SIGNALS = {
        "owner": 0.9, "ceo": 0.9, "founder": 0.9, "president": 0.8,
        "chief": 0.8, "vp": 0.7, "vice president": 0.7, "director": 0.6,
        "head of": 0.7, "c-suite": 0.9, "decision maker": 0.8,
        "budget authority": 0.9, "budget holder": 0.9,
        "approved budget": 0.9, "allocated funds": 0.8,
        "signing authority": 0.9, "can approve": 0.8,
        "years of experience": 0.5, "previously implemented": 0.6,
        "managed": 0.5, "led": 0.5, "built": 0.6,
        "multiple locations": 0.6, "multi-site": 0.6,
    }

    Q_SIGNALS = {
        "urgent": 0.8, "immediately": 0.9, "asap": 0.9,
        "this quarter": 0.7, "this month": 0.8, "this week": 0.9,
        "deadline": 0.7, "time-sensitive": 0.8, "critical": 0.7,
        "losing": 0.8, "bleeding": 0.9, "hemorrhaging": 0.9,
        "crisis": 0.8, "emergency": 0.9, "can't wait": 0.8,
        "falling behind": 0.7, "competitors": 0.6,
        "regulatory": 0.7, "compliance deadline": 0.8,
        "audit": 0.6, "accreditation": 0.7, "jcaho": 0.7, "carf": 0.7,
        "hiring": 0.5, "expanding": 0.5, "new location": 0.6,
        "just opened": 0.6, "launching": 0.6, "recently funded": 0.7,
    }

    F_SIGNALS = {
        "mental health": 0.8, "behavioral health": 0.8,
        "substance abuse": 0.8, "addiction": 0.8, "recovery": 0.8,
        "treatment": 0.7, "rehab": 0.8, "sober living": 0.7,
        "outpatient": 0.7, "inpatient": 0.7, "residential": 0.7,
        "detox": 0.7, "mat": 0.6, "medication assisted": 0.7,
        "telehealth": 0.6, "virtual care": 0.6,
        "small business": 0.5, "startup": 0.4, "growing practice": 0.6,
        "group practice": 0.6, "multi-site": 0.7,
        "crm": 0.7, "hubspot": 0.8, "salesforce": 0.6,
        "ehr": 0.6, "emr": 0.6, "kipu": 0.7, "sunwave": 0.7,
    }

    @classmethod
    def analyze(cls, buying_signals="", web_signals="", linkedin_summary="",
                title="", company_industry="", company_size=0,
                company_description=""):
        combined = " ".join(filter(None, [
            buying_signals, web_signals, linkedin_summary,
            title, company_industry, company_description,
        ])).lower()

        if not combined.strip():
            return dict(psi_intent=0, rho_authority=0, q_urgency=0, q_optimized=0,
                        f_fit=0, coherence_score=0, qualification_tier="unscored",
                        dimensional_fractures="No signal data", rank_score=0)

        psi = cls._extract(combined, cls.PSI_SIGNALS)
        rho = cls._extract(combined, cls.RHO_SIGNALS)
        rho = cls._boost_title(rho, title)
        q_raw = cls._extract(combined, cls.Q_SIGNALS)
        f = cls._extract(combined, cls.F_SIGNALS)
        f = cls._boost_industry(f, company_industry)

        q_opt = cls._mm(q_raw)
        coupling = cls.COUPLING_STRENGTH * rho * psi
        coherence = psi + (rho * psi) + q_opt + (f * psi) + coupling

        tier = cls._tier(coherence, rho, q_opt, f)
        fractures = cls._fractures(psi, rho, q_raw, f)
        rank = coherence * 0.4 + rho * 0.25 + psi * 0.20 + q_opt * 0.10 + f * 0.05

        return dict(
            psi_intent=round(psi, 4), rho_authority=round(rho, 4),
            q_urgency=round(q_raw, 4), q_optimized=round(q_opt, 4),
            f_fit=round(f, 4), coherence_score=round(coherence, 4),
            qualification_tier=tier, dimensional_fractures=fractures,
            rank_score=round(rank, 4),
        )

    @classmethod
    def _extract(cls, text, signals):
        matches = sorted([w for s, w in signals.items() if s in text], reverse=True)
        return min(1.0, sum(matches[:3]) / len(matches[:3])) if matches else 0.0

    @classmethod
    def _boost_title(cls, rho, title):
        if not title: return rho
        t = title.lower()
        if any(x in t for x in ["owner","ceo","founder","president","co-founder"]): return min(1.0, rho+0.4)
        if any(x in t for x in ["chief","cmo","cto","cfo","coo","cro"]): return min(1.0, rho+0.35)
        if any(x in t for x in ["vp","vice president","svp","evp"]): return min(1.0, rho+0.25)
        if any(x in t for x in ["director","head of"]): return min(1.0, rho+0.15)
        if any(x in t for x in ["manager","lead"]): return min(1.0, rho+0.05)
        return rho

    @classmethod
    def _boost_industry(cls, f, industry):
        if not industry: return f
        ind = industry.lower()
        if any(x in ind for x in ["mental health","behavioral","substance","addiction"]): return min(1.0, f+0.35)
        if any(x in ind for x in ["hospital","health care","medical"]): return min(1.0, f+0.15)
        return f

    @classmethod
    def _mm(cls, q):
        return q / (cls.KM + q + q*q/cls.KI) if q > 0 else 0.0

    @classmethod
    def _tier(cls, c, rho, q_opt, f):
        if c < 0.5 or f < 0.2: return "disqualified"
        if c >= 2.5 and rho >= 0.6 and q_opt >= 0.15: return "hot"
        if c >= 1.5: return "warm"
        if c >= 0.5: return "cold"
        return "disqualified"

    @classmethod
    def _fractures(cls, psi, rho, q, f):
        fr = []
        if q > 0.6 and rho < 0.3: fr.append("High urgency + low authority: may lack buying power")
        if psi > 0.6 and rho < 0.3: fr.append("Clear intent + low authority: champion without budget — find their boss")
        if rho > 0.6 and psi < 0.3: fr.append("High authority + low intent: decision maker not yet activated")
        if f > 0.6 and psi < 0.3: fr.append("Strong fit + no intent: perfect ICP but no buying motion")
        if q > 0.7 and psi < 0.4: fr.append("Urgency without clarity: activation without defined need")
        return "; ".join(fr) if fr else "No fractures detected"


# ═══════════════════════════════════════════════════════════
# SCOUT AGENT
# ═══════════════════════════════════════════════════════════

class ScoutAgent:
    SYSTEM = """You are a sales intelligence scout for behavioral health / addiction recovery.
Given a lead, search the web for BUYING SIGNALS: growth, pain points, tech adoption, regulatory pressure,
leadership changes, funding, job postings, news. Return plain text. Be specific with dates.
If nothing found, say "No significant buying signals detected" — do NOT fabricate."""

    @classmethod
    async def scout_lead(cls, lead: Dict) -> Dict[str, str]:
        name = lead.get("full_name", "")
        company = lead.get("company", "")
        title = lead.get("title", "")
        linkedin = lead.get("linkedin_profile_url") or lead.get("linkedin", "")
        domain = lead.get("company_domain") or lead.get("domain", "")

        prompt = f"Research buying signals for: {name}, {title} at {company} (domain: {domain}, LinkedIn: {linkedin})"

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 1024,
                        "system": cls.SYSTEM,
                        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            texts = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
            return {
                "buying_signals": "\n".join(texts) or "No signals found",
                "web_signals": f"Scouted {datetime.now(timezone.utc).isoformat()}",
                "linkedin_summary": f"LinkedIn: {linkedin}" if linkedin else "",
            }
        except Exception as e:
            logger.error(f"Scout failed for {name}: {e}")
            return {"buying_signals": f"Scout error: {str(e)[:200]}", "web_signals": "", "linkedin_summary": ""}


# ═══════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "rose-glass-sales"}

# ─── CSV Upload ────────────────────────────────────────

WIZA_COLUMNS = [
    "email","full_name","title","locality","region","linkedin","domain",
    "phone_number1","phone_number2","phone_number3","mobile_phone1","other_phone1",
    "personal_email1","company","linkedin_profile_url","company_domain",
    "company_industry","company_subindustry","company_size","company_size_range",
    "company_founded","company_revenue","company_funding","company_type",
    "company_linkedin","company_twitter","company_facebook","company_description",
    "company_last_funding_round","company_last_funding_amount","company_last_funding_at",
    "company_location","company_street","company_locality","company_region",
    "company_country","company_postal_code","other_work_emails","profile_url",
]

INT_FIELDS = {"company_size", "company_founded"}
STR_FIELDS = {"phone_number1","phone_number2","phone_number3","mobile_phone1","other_phone1","company_postal_code"}

@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a Wiza-format CSV and insert rows into leads table."""
    if not file.filename.endswith((".csv", ".CSV")):
        raise HTTPException(400, "Only .csv files accepted")

    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    # Validate columns
    headers = [h.strip().lower().replace(" ", "_") for h in (reader.fieldnames or [])]
    matched = [h for h in headers if h in WIZA_COLUMNS]
    if len(matched) < 5:
        raise HTTPException(400, f"CSV doesn't match Wiza format. Found columns: {headers[:10]}")

    rows = []
    for row in reader:
        clean = {}
        for k, v in row.items():
            key = k.strip().lower().replace(" ", "_")
            if key not in WIZA_COLUMNS:
                continue
            val = (v or "").strip()
            if not val or val.lower() == "none":
                clean[key] = None
            elif key in INT_FIELDS:
                try: clean[key] = int(float(val))
                except: clean[key] = None
            elif key in STR_FIELDS:
                clean[key] = str(val).split(".")[0] if "." in str(val) else str(val)
            else:
                clean[key] = val
        if clean.get("full_name") or clean.get("email"):
            rows.append(clean)

    if not rows:
        raise HTTPException(400, "No valid rows found in CSV")

    # Create import batch
    async with httpx.AsyncClient(timeout=30) as client:
        batch_resp = await client.post(f"{SUPABASE_URL}/rest/v1/import_batches", headers=HEADERS_SB,
            json={"filename": file.filename, "row_count": len(rows), "status": "processing"})
        batch_resp.raise_for_status()
        batch_id = batch_resp.json()[0]["id"]

        inserted = 0
        dupes = 0
        for i in range(0, len(rows), 50):
            chunk = rows[i:i+50]
            for r in chunk:
                r["import_batch_id"] = batch_id
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/leads",
                headers={**HEADERS_SB, "Prefer": "return=representation,resolution=merge-duplicates"},
                json=chunk)
            if resp.status_code < 300:
                inserted += len(chunk)
            else:
                logger.warning(f"Insert chunk failed: {resp.text[:200]}")

        await client.patch(f"{SUPABASE_URL}/rest/v1/import_batches?id=eq.{batch_id}", headers=HEADERS_SB,
            json={"status": "complete", "row_count": inserted})

    return {"batch_id": batch_id, "filename": file.filename, "rows_parsed": len(rows), "inserted": inserted}

# ─── Scout ────────────────────────────────────────────────

@app.post("/api/scout/run")
async def run_scouts(limit: int = 20):
    async with httpx.AsyncClient(timeout=30) as client:
        run_resp = await client.post(f"{SUPABASE_URL}/rest/v1/scout_runs", headers=HEADERS_SB,
                                     json={"run_type": "manual", "status": "running"})
        run_resp.raise_for_status()
        run_id = run_resp.json()[0]["id"]

        leads_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/leads?buying_signals=is.null&limit={limit}&order=created_at.asc",
            headers=HEADERS_SB)
        leads_resp.raise_for_status()
        leads = leads_resp.json()

    if not leads:
        return {"run_id": run_id, "scouted": 0, "message": "No unscouted leads"}

    updated = 0
    for i in range(0, len(leads), 5):
        batch = leads[i:i+5]
        results = await asyncio.gather(*[ScoutAgent.scout_lead(l) for l in batch], return_exceptions=True)
        async with httpx.AsyncClient(timeout=30) as client:
            for lead, result in zip(batch, results):
                if isinstance(result, Exception): continue
                now = datetime.now(timezone.utc).isoformat()
                await client.patch(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead['id']}", headers=HEADERS_SB,
                    json={**result, "buying_signals_updated_at": now,
                          "web_signals_updated_at": now, "linkedin_summary_updated_at": now, "updated_at": now})
                updated += 1

    async with httpx.AsyncClient(timeout=30) as client:
        await client.patch(f"{SUPABASE_URL}/rest/v1/scout_runs?id=eq.{run_id}", headers=HEADERS_SB,
            json={"status": "complete", "completed_at": datetime.now(timezone.utc).isoformat(),
                  "leads_scouted": len(leads), "leads_updated": updated})

    return {"run_id": run_id, "scouted": len(leads), "updated": updated}

# ─── Rank ─────────────────────────────────────────────────

@app.post("/api/rank/run")
async def run_ranking():
    async with httpx.AsyncClient(timeout=30) as client:
        run_resp = await client.post(f"{SUPABASE_URL}/rest/v1/rank_runs", headers=HEADERS_SB,
                                     json={"status": "running"})
        run_resp.raise_for_status()
        run_id = run_resp.json()[0]["id"]

        leads_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/leads?buying_signals=not.is.null&select=id,buying_signals,web_signals,linkedin_summary,title,company_industry,company_size,company_description&limit=1000",
            headers=HEADERS_SB)
        leads_resp.raise_for_status()
        leads = leads_resp.json()

    if not leads:
        return {"run_id": run_id, "ranked": 0}

    tiers = {}
    now = datetime.now(timezone.utc).isoformat()
    async with httpx.AsyncClient(timeout=30) as client:
        for lead in leads:
            a = CERATABridge.analyze(
                buying_signals=lead.get("buying_signals",""), web_signals=lead.get("web_signals",""),
                linkedin_summary=lead.get("linkedin_summary",""), title=lead.get("title",""),
                company_industry=lead.get("company_industry",""),
                company_size=lead.get("company_size") or 0,
                company_description=lead.get("company_description",""))
            await client.patch(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead['id']}", headers=HEADERS_SB,
                json={**a, "ranked_at": now, "updated_at": now})
            tiers[a["qualification_tier"]] = tiers.get(a["qualification_tier"], 0) + 1

    # Assign positions
    async with httpx.AsyncClient(timeout=30) as client:
        sorted_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/leads?rank_score=not.is.null&order=rank_score.desc&select=id&limit=1000",
            headers=HEADERS_SB)
        for pos, lead in enumerate(sorted_resp.json(), 1):
            await client.patch(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead['id']}", headers=HEADERS_SB,
                json={"rank_position": pos})

        await client.patch(f"{SUPABASE_URL}/rest/v1/rank_runs?id=eq.{run_id}", headers=HEADERS_SB,
            json={"status": "complete", "completed_at": datetime.now(timezone.utc).isoformat(),
                  "leads_ranked": len(leads), "tier_counts": tiers})

    return {"run_id": run_id, "ranked": len(leads), "tier_counts": tiers}

# ─── Chat ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []

CHAT_SYSTEM = """You are the Rose Glass Sales Intelligence Agent. You manage leads in the behavioral health / recovery industry.

Leads are analyzed via CERATA dimensional framework:
- Ψ (psi_intent): Intent coherence (0-1)
- ρ (rho_authority): Decision authority (0-1)
- q (q_optimized): Bio-optimized urgency (0-1)
- f (f_fit): Ecosystem fit (0-1)
- coherence_score: Overall signal (0-4)
- qualification_tier: hot/warm/cold/disqualified
- dimensional_fractures: Signal divergences

When asked about leads, use the data provided. Explain WHY using dimensions, not just scores.
When user gives feedback, note what should be updated. Be direct."""

@app.post("/api/chat")
async def chat(req: ChatRequest):
    async with httpx.AsyncClient(timeout=30) as client:
        stats_resp = await client.get(f"{SUPABASE_URL}/rest/v1/leads?select=qualification_tier&limit=1000", headers=HEADERS_SB)
        all_tiers = {}
        for l in stats_resp.json():
            t = l.get("qualification_tier") or "unscored"
            all_tiers[t] = all_tiers.get(t, 0) + 1

        top_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/leads?order=rank_score.desc.nullslast&limit=25&select=id,full_name,title,company,company_industry,region,rank_score,coherence_score,qualification_tier,psi_intent,rho_authority,q_urgency,q_optimized,f_fit,dimensional_fractures,buying_signals,user_notes,user_status,outreach_status",
            headers=HEADERS_SB)
        top_leads = top_resp.json()

    context = f"DB: {sum(all_tiers.values())} leads, tiers: {json.dumps(all_tiers)}\nTOP 25:\n{json.dumps(top_leads, indent=1)}"
    messages = [*req.history, {"role": "user", "content": f"{context}\n\nUser: {req.message}"}]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post("https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": 2048, "system": CHAT_SYSTEM, "messages": messages})
        resp.raise_for_status()

    reply = "\n".join(b["text"] for b in resp.json().get("content", []) if b.get("type") == "text")

    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(f"{SUPABASE_URL}/rest/v1/chat_messages", headers=HEADERS_SB,
            json=[{"role": "user", "content": req.message}, {"role": "assistant", "content": reply}])

    return {"reply": reply, "stats": {"total": sum(all_tiers.values()), "tiers": all_tiers}}

# ─── Lead CRUD ────────────────────────────────────────────

@app.get("/api/leads")
async def get_leads(tier: Optional[str] = None, limit: int = 50, offset: int = 0):
    url = f"{SUPABASE_URL}/rest/v1/leads?order=rank_score.desc.nullslast&limit={limit}&offset={offset}"
    if tier: url += f"&qualification_tier=eq.{tier}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=HEADERS_SB)
        resp.raise_for_status()
        return resp.json()

@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: str):
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}", headers=HEADERS_SB)
        leads = resp.json()
        if not leads: raise HTTPException(404, "Not found")
        return leads[0]

class LeadUpdate(BaseModel):
    user_notes: Optional[str] = None
    user_status: Optional[str] = None
    user_rating: Optional[int] = None
    outreach_status: Optional[str] = None

@app.patch("/api/leads/{lead_id}")
async def update_lead(lead_id: str, update: LeadUpdate):
    data = {k: v for k, v in update.dict().items() if v is not None}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.patch(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}", headers=HEADERS_SB, json=data)
        return resp.json()

@app.get("/api/stats")
async def get_stats():
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/leads?select=qualification_tier,coherence_score&limit=1000", headers=HEADERS_SB)
        leads = resp.json()
    scored = [l for l in leads if l.get("coherence_score")]
    tiers = {}
    for l in leads:
        t = l.get("qualification_tier") or "unscored"
        tiers[t] = tiers.get(t, 0) + 1
    return {"total": len(leads), "scored": len(scored), "tiers": tiers,
            "avg_coherence": round(sum(l["coherence_score"] for l in scored)/len(scored), 3) if scored else 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
