"""
Scout Lab — Organic Lead Discovery Engine
==========================================
Standalone FastAPI backend for roseglass.sale Scout Lab.
Discovers leads organically via web search — no CSVs.
Candidates stage in scout_lab_candidates, migrate to leads on approval.

Supabase project: xrzycmvpqohxxlhnorpt (shared with main roseglass.sale)
Deployment: Railway (separate service)

Author: Christopher MacGregor bin Joseph
ROSE Corp / MacGregor Holding Company
"""

import os
import json
import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scout-lab")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xrzycmvpqohxxlhnorpt.supabase.co").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip().replace("\n", "").replace("\r", "").replace(" ", "").strip('"').strip("'").lstrip("=")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip().replace("\n", "").replace("\r", "")
PORT = int(os.environ.get("PORT", 8001))

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

app = FastAPI(title="Scout Lab — Organic Lead Discovery", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════

MODELS = {
    "haiku": {
        "id": "claude-haiku-4-5-20251001",
        "name": "Haiku 4.5",
        "desc": "Fast and cheap — broad sweeps",
        "cost": "~$0.003/lead",
    },
    "sonnet": {
        "id": "claude-sonnet-4-6-20260313",
        "name": "Sonnet 4.6",
        "desc": "Balanced — finds hidden signals",
        "cost": "~$0.015/lead",
    },
    "opus": {
        "id": "claude-opus-4-6-20260313",
        "name": "Opus 4.6",
        "desc": "Maximum intelligence — finds what others miss",
        "cost": "~$0.075/lead",
    },
}


# ═══════════════════════════════════════════════════════════
# AUTH — shared with main backend (same Supabase sessions table)
# ═══════════════════════════════════════════════════════════

async def get_current_user(authorization: str = Header(None)) -> Dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    if not SUPABASE_KEY:
        logger.error("SUPABASE_SERVICE_ROLE_KEY is not set!")
        raise HTTPException(500, "Server misconfigured: missing Supabase key")
    token = authorization.replace("Bearer ", "")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            url = f"{SUPABASE_URL}/rest/v1/sessions?token=eq.{token}&select=user_id,expires_at"
            resp = await client.get(url, headers=HEADERS_SB)
            logger.info(f"Auth check: status={resp.status_code}, url={SUPABASE_URL[:30]}, key_len={len(SUPABASE_KEY)}, resp_len={len(resp.text)}")
            if resp.status_code >= 400:
                logger.error(f"Supabase auth response: {resp.status_code} {resp.text[:300]}")
                raise HTTPException(401, f"Auth check failed: {resp.status_code}")
            sessions = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(500, f"Auth service error: {str(e)[:200]}")
    if not sessions:
        raise HTTPException(401, "Invalid session")
    session = sessions[0]
    if session["expires_at"] and session["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(401, "Session expired")
    return {"user_id": session["user_id"]}


# ═══════════════════════════════════════════════════════════
# CERATA BRIDGE — copied from main for standalone operation
# ═══════════════════════════════════════════════════════════

class CERATABridge:
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
        "lead tracking": 0.8, "marketing roi": 0.7,
    }
    RHO_SIGNALS = {
        "owner": 0.9, "ceo": 0.9, "founder": 0.9, "president": 0.8,
        "chief": 0.8, "vp": 0.7, "vice president": 0.7, "director": 0.6,
        "head of": 0.7, "c-suite": 0.9, "decision maker": 0.8,
        "budget authority": 0.9, "signing authority": 0.9,
    }
    Q_SIGNALS = {
        "urgent": 0.8, "immediately": 0.9, "asap": 0.9,
        "this quarter": 0.7, "this month": 0.8, "this week": 0.9,
        "deadline": 0.7, "critical": 0.7, "losing": 0.8,
        "crisis": 0.8, "hiring": 0.5, "new location": 0.6,
        "recently funded": 0.7, "launching": 0.6,
    }
    F_SIGNALS = {
        "crm": 0.7, "hubspot": 0.8, "salesforce": 0.6, "sales team": 0.7,
        "lead generation": 0.8, "pipeline": 0.7, "b2b": 0.6,
        "saas": 0.7, "arr": 0.7, "mrr": 0.7, "series a": 0.6,
        "series b": 0.7, "funded": 0.6, "growth": 0.5,
    }

    @classmethod
    def analyze(cls, buying_signals="", web_signals="", linkedin_summary="",
                title="", company_industry="", company_size=0, company_description=""):
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
            rank_score=round(rank, 4))

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
        return rho

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
        if q > 0.6 and rho < 0.3: fr.append("High urgency + low authority")
        if psi > 0.6 and rho < 0.3: fr.append("Clear intent + low authority — find their boss")
        if rho > 0.6 and psi < 0.3: fr.append("High authority + low intent — not yet activated")
        if f > 0.6 and psi < 0.3: fr.append("Strong fit + no intent — perfect ICP, no motion")
        return "; ".join(fr) if fr else "No fractures"


# ═══════════════════════════════════════════════════════════
# DISCOVERY AGENT — Organic lead finder via web search
# ═══════════════════════════════════════════════════════════

class DiscoveryAgent:
    """Finds new leads organically by searching the web.
    No CSV. No existing database. Pure discovery."""

    @classmethod
    def build_system_prompt(cls, mission: dict) -> str:
        industries = ", ".join(mission.get("industries", [])) or "any industry"
        titles = ", ".join(mission.get("titles", [])) or "any decision-maker title"
        regions = ", ".join(mission.get("regions", [])) or "any region"
        keywords = ", ".join(mission.get("keywords", [])) or "general growth signals"
        exclude = ", ".join(mission.get("exclude", [])) or "none"
        product_ctx = mission.get("product_context", "")
        target_count = mission.get("target_count", 10)

        return f"""You are an elite lead discovery agent. Your mission is to find {target_count} real people who match specific criteria by searching the web.

DISCOVERY CRITERIA:
- Industries: {industries}
- Target titles: {titles}
- Regions: {regions}
- Signal keywords: {keywords}
- EXCLUDE: {exclude}
{"- Product context (frame relevance through this): " + product_ctx if product_ctx else ""}

YOUR PROCESS:
1. Search strategically — use industry + title + region combinations
2. Look for real people at real companies with verifiable web presence
3. For each person found, gather: full name, title, company, industry, location, company website, LinkedIn URL if visible
4. Assess buying signals: Are they hiring? Recently funded? Expanding? Speaking at events? Publishing about pain points?
5. Rate your confidence (0-1) that this is a real, reachable person matching the criteria

SEARCH STRATEGY (you have up to 15 web searches — use them wisely):
- Start broad: "[industry] [title] [region] companies"
- Then narrow: "[company name] leadership team" or "[person name] [company]"
- Look for conference speakers, podcast guests, LinkedIn posts, press releases, job postings
- Company "about us" and "team" pages are goldmines
- Industry association member directories
- Recent funding announcements name decision-makers
- Job postings reveal company pain points AND hiring managers

OUTPUT FORMAT — You MUST return ONLY a JSON array. No prose before or after. Each element:
{{
  "full_name": "Jane Smith",
  "title": "VP of Sales",
  "company": "Acme Corp",
  "company_domain": "acmecorp.com",
  "company_industry": "SaaS",
  "company_description": "B2B sales enablement platform",
  "company_size_range": "51-200",
  "company_revenue": "$10M-$50M",
  "region": "California",
  "locality": "San Francisco",
  "company_country": "United States",
  "email": "jsmith@acmecorp.com or null if not found",
  "linkedin_profile_url": "https://linkedin.com/in/janesmith or null",
  "phone_number1": "null unless found publicly",
  "buying_signals": "Recently raised Series B, hiring 3 AEs, CEO spoke at SaaStr about scaling challenges",
  "discovery_source": "Found via SaaStr 2026 speaker list + company careers page",
  "confidence_score": 0.85
}}

RULES:
- Real people only. Never fabricate names, companies, or data.
- If you can't find enough matches, return what you have. Quality over quantity.
- If you find an email, include it. If not, set to null — the user has other tools for that.
- Company domain is critical — always try to find it.
- LinkedIn URLs are valuable but not required.
- EXCLUDE anyone matching the exclude criteria.
- Return ONLY the JSON array. No markdown. No explanation. No backticks."""

    @classmethod
    async def run_discovery(cls, mission: dict, model_id: str) -> List[Dict]:
        """Execute a discovery mission. Returns list of candidate dicts."""
        system = cls.build_system_prompt(mission)
        target = mission.get("target_count", 10)

        user_msg = f"Find {target} leads matching the criteria. Search thoroughly — use multiple search queries to cover different angles. Return ONLY a JSON array of discovered leads."

        try:
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_id,
                        "max_tokens": 8192,
                        "system": system,
                        "tools": [{"type": "web_search_20250305", "name": "web_search", "max_uses": 15}],
                        "messages": [{"role": "user", "content": user_msg}],
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            # Extract text blocks from response
            texts = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
            raw = "\n".join(texts).strip()

            # Parse JSON — handle markdown fences
            clean = raw.replace("```json", "").replace("```", "").strip()
            # Find the JSON array
            start = clean.find("[")
            end = clean.rfind("]")
            if start == -1 or end == -1:
                logger.error(f"No JSON array in response: {clean[:500]}")
                return []
            json_str = clean[start:end+1]
            candidates = json.loads(json_str)

            if not isinstance(candidates, list):
                logger.error(f"Response is not a list: {type(candidates)}")
                return []

            logger.info(f"Discovery found {len(candidates)} candidates")
            return candidates

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}\nRaw: {raw[:1000] if 'raw' in dir() else 'no raw'}")
            return []
        except Exception as e:
            logger.error(f"Discovery agent failed: {e}")
            return []


# ═══════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════

class LaunchMissionRequest(BaseModel):
    model: str = "sonnet"
    target_count: int = 10
    quality_bar: str = "warm"
    industries: List[str] = []
    titles: List[str] = []
    regions: List[str] = []
    keywords: List[str] = []
    exclude: List[str] = []
    product_context: str = ""

class ApproveRequest(BaseModel):
    candidate_ids: List[str]

class RejectRequest(BaseModel):
    candidate_ids: List[str]


# ═══════════════════════════════════════════════════════════
# MISSION RUNNER — background task
# ═══════════════════════════════════════════════════════════

async def run_mission(mission_id: str, user_id: str, mission_config: dict, model_id: str):
    """Background task: runs discovery, scores candidates, writes to DB."""
    now = datetime.now(timezone.utc).isoformat()

    # Update mission status to running
    async with httpx.AsyncClient(timeout=15) as client:
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mission_id}",
            headers=HEADERS_SB,
            json={"status": "running", "updated_at": now})

    try:
        # Run discovery
        candidates = await DiscoveryAgent.run_discovery(mission_config, model_id)

        if not candidates:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mission_id}",
                    headers=HEADERS_SB,
                    json={"status": "complete", "candidates_found": 0,
                          "completed_at": now, "updated_at": now,
                          "error": "No candidates discovered"})
            return

        # Score each candidate and filter by quality bar
        quality_bar = mission_config.get("quality_bar", "warm")
        tier_rank = {"hot": 4, "warm": 3, "cold": 2, "disqualified": 1, "unscored": 0}
        min_tier = tier_rank.get(quality_bar, 2)
        written = 0

        for cand in candidates:
            # Run CERATA dimensional analysis
            analysis = CERATABridge.analyze(
                buying_signals=cand.get("buying_signals", ""),
                web_signals=cand.get("discovery_source", ""),
                title=cand.get("title", ""),
                company_industry=cand.get("company_industry", ""),
                company_size=0,
                company_description=cand.get("company_description", ""))

            # Check quality bar
            cand_tier = analysis.get("qualification_tier", "unscored")
            cand_tier_rank = tier_rank.get(cand_tier, 0)

            # Write all candidates but mark sub-bar ones
            record = {
                "mission_id": mission_id,
                "user_id": user_id,
                "status": "pending",
                "full_name": cand.get("full_name", "Unknown"),
                "email": cand.get("email"),
                "title": cand.get("title"),
                "company": cand.get("company"),
                "company_domain": cand.get("company_domain"),
                "company_industry": cand.get("company_industry"),
                "company_description": cand.get("company_description"),
                "company_size_range": cand.get("company_size_range"),
                "company_revenue": cand.get("company_revenue"),
                "company_country": cand.get("company_country"),
                "company_region": cand.get("region"),
                "locality": cand.get("locality"),
                "region": cand.get("region"),
                "linkedin_profile_url": cand.get("linkedin_profile_url"),
                "phone_number1": cand.get("phone_number1"),
                "personal_email1": cand.get("personal_email1"),
                "buying_signals": cand.get("buying_signals"),
                "discovery_source": cand.get("discovery_source"),
                "confidence_score": cand.get("confidence_score", 0),
                # Dimensional scores
                **analysis,
            }

            # Clean nulls — don't send literal "null" strings
            for k, v in record.items():
                if v == "null" or v == "None":
                    record[k] = None

            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{SUPABASE_URL}/rest/v1/scout_lab_candidates",
                        headers=HEADERS_SB, json=record)
                    resp.raise_for_status()
                    written += 1
            except Exception as e:
                logger.error(f"Failed to write candidate {cand.get('full_name')}: {e}")

        # Update mission
        async with httpx.AsyncClient(timeout=15) as client:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mission_id}",
                headers=HEADERS_SB,
                json={"status": "complete", "candidates_found": written,
                      "completed_at": datetime.now(timezone.utc).isoformat(),
                      "updated_at": datetime.now(timezone.utc).isoformat()})

        logger.info(f"Mission {mission_id} complete: {written} candidates found")

    except Exception as e:
        logger.error(f"Mission {mission_id} failed: {e}")
        async with httpx.AsyncClient(timeout=15) as client:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mission_id}",
                headers=HEADERS_SB,
                json={"status": "failed", "error": str(e)[:500],
                      "updated_at": datetime.now(timezone.utc).isoformat()})


# ═══════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    # Test actual Supabase connectivity
    sb_test = "untested"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/sessions?select=user_id&limit=1",
                headers=HEADERS_SB)
            sb_test = f"status={resp.status_code}, body_len={len(resp.text)}"
            if resp.status_code >= 400:
                sb_test += f", error={resp.text[:200]}"
    except Exception as e:
        sb_test = f"error: {str(e)[:200]}"
    return {
        "status": "ok",
        "service": "scout-lab",
        "models": list(MODELS.keys()),
        "supabase_configured": bool(SUPABASE_KEY),
        "anthropic_configured": bool(ANTHROPIC_API_KEY),
        "supabase_url": SUPABASE_URL[:40] + "..." if SUPABASE_URL else "NOT SET",
        "supabase_key_len": len(SUPABASE_KEY),
        "supabase_key_start": SUPABASE_KEY[:10] if SUPABASE_KEY else "EMPTY",
        "supabase_key_end": SUPABASE_KEY[-10:] if SUPABASE_KEY else "EMPTY",
        "supabase_test": sb_test,
    }


@app.get("/api/scout-lab/models")
async def list_models():
    return MODELS


@app.post("/api/scout-lab/launch")
async def launch_mission(req: LaunchMissionRequest, authorization: str = Header(None)):
    """Launch a new scout mission. Returns immediately — mission runs in background."""
    user = await get_current_user(authorization)

    if req.model not in MODELS:
        raise HTTPException(400, f"Invalid model: {req.model}. Options: {list(MODELS.keys())}")
    if req.target_count < 1 or req.target_count > 50:
        raise HTTPException(400, "target_count must be 1-50")

    model_info = MODELS[req.model]

    # Create mission record
    mission_data = {
        "user_id": user["user_id"],
        "status": "pending",
        "model": req.model,
        "model_id": model_info["id"],
        "target_count": req.target_count,
        "quality_bar": req.quality_bar,
        "industries": req.industries,
        "titles": req.titles,
        "regions": req.regions,
        "keywords": req.keywords,
        "exclude": req.exclude,
        "product_context": req.product_context,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/scout_lab_missions",
            headers=HEADERS_SB, json=mission_data)
        resp.raise_for_status()
        mission = resp.json()[0]

    # Launch background task
    mission_config = req.model_dump()
    asyncio.create_task(run_mission(mission["id"], user["user_id"], mission_config, model_info["id"]))

    return {
        "mission_id": mission["id"],
        "status": "launched",
        "model": model_info["name"],
        "target_count": req.target_count,
        "quality_bar": req.quality_bar,
    }


@app.get("/api/scout-lab/missions")
async def list_missions(limit: int = 20, authorization: str = Header(None)):
    """List all missions for the current user."""
    user = await get_current_user(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/scout_lab_missions?user_id=eq.{user['user_id']}&order=created_at.desc&limit={limit}",
            headers=HEADERS_SB)
        return resp.json()


@app.get("/api/scout-lab/missions/{mission_id}")
async def get_mission(mission_id: str, authorization: str = Header(None)):
    """Get mission details + all candidates."""
    user = await get_current_user(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        mission_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mission_id}&user_id=eq.{user['user_id']}",
            headers=HEADERS_SB)
        missions = mission_resp.json()
        if not missions:
            raise HTTPException(404, "Mission not found")

        cands_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?mission_id=eq.{mission_id}&order=rank_score.desc.nullslast",
            headers=HEADERS_SB)
        candidates = cands_resp.json()

    return {"mission": missions[0], "candidates": candidates}


@app.post("/api/scout-lab/approve")
async def approve_candidates(req: ApproveRequest, authorization: str = Header(None)):
    """Approve candidates — migrates them to the main leads table."""
    user = await get_current_user(authorization)
    approved = 0
    errors = []

    for cand_id in req.candidate_ids:
        try:
            # Fetch candidate
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?id=eq.{cand_id}&user_id=eq.{user['user_id']}",
                    headers=HEADERS_SB)
                cands = resp.json()
            if not cands:
                errors.append(f"{cand_id}: not found")
                continue
            cand = cands[0]
            if cand["status"] != "pending":
                errors.append(f"{cand_id}: already {cand['status']}")
                continue

            # Build lead record from candidate — mirror leads schema
            now = datetime.now(timezone.utc).isoformat()
            lead_record = {
                "user_id": user["user_id"],
                "full_name": cand["full_name"],
                "email": cand.get("email"),
                "title": cand.get("title"),
                "company": cand.get("company"),
                "company_domain": cand.get("company_domain"),
                "company_industry": cand.get("company_industry"),
                "company_subindustry": cand.get("company_subindustry"),
                "company_description": cand.get("company_description"),
                "company_size": cand.get("company_size"),
                "company_size_range": cand.get("company_size_range"),
                "company_revenue": cand.get("company_revenue"),
                "company_funding": cand.get("company_funding"),
                "company_founded": cand.get("company_founded"),
                "company_location": cand.get("company_location"),
                "company_region": cand.get("company_region"),
                "company_country": cand.get("company_country"),
                "locality": cand.get("locality"),
                "region": cand.get("region"),
                "linkedin_profile_url": cand.get("linkedin_profile_url"),
                "company_linkedin": cand.get("company_linkedin"),
                "phone_number1": cand.get("phone_number1"),
                "mobile_phone1": cand.get("mobile_phone1"),
                "personal_email1": cand.get("personal_email1"),
                "buying_signals": cand.get("buying_signals"),
                "web_signals": cand.get("web_signals") or f"Discovered by Scout Lab ({cand.get('discovery_source', '')})",
                "linkedin_summary": cand.get("linkedin_summary"),
                # Pre-computed dimensional scores
                "psi_intent": cand.get("psi_intent"),
                "rho_authority": cand.get("rho_authority"),
                "q_urgency": cand.get("q_urgency"),
                "q_optimized": cand.get("q_optimized"),
                "f_fit": cand.get("f_fit"),
                "coherence_score": cand.get("coherence_score"),
                "qualification_tier": cand.get("qualification_tier"),
                "dimensional_fractures": cand.get("dimensional_fractures"),
                "rank_score": cand.get("rank_score"),
                "ranked_at": now,
                "buying_signals_updated_at": now,
                "web_signals_updated_at": now,
                "created_at": now,
                "updated_at": now,
            }

            # Remove None values to avoid Supabase errors
            lead_record = {k: v for k, v in lead_record.items() if v is not None}

            # Insert into main leads table
            async with httpx.AsyncClient(timeout=15) as client:
                lead_resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/leads",
                    headers={**HEADERS_SB, "Prefer": "return=representation"},
                    json=lead_record)
                if lead_resp.status_code >= 400:
                    errors.append(f"{cand_id}: lead insert failed — {lead_resp.text[:200]}")
                    continue
                new_lead = lead_resp.json()[0]

                # Mark candidate as approved with migrated lead ID
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?id=eq.{cand_id}",
                    headers=HEADERS_SB,
                    json={
                        "status": "approved",
                        "migrated_lead_id": new_lead["id"],
                        "approved_at": now,
                        "updated_at": now,
                    })

                # Update mission counter
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{cand['mission_id']}",
                    headers=HEADERS_SB,
                    json={"candidates_approved": missions[0]["candidates_approved"] + 1 if False else None})

            approved += 1

        except Exception as e:
            errors.append(f"{cand_id}: {str(e)[:200]}")

    # Update mission approved counts
    if approved > 0:
        # Get mission IDs from approved candidates and bulk-update counts
        async with httpx.AsyncClient(timeout=15) as client:
            for cand_id in req.candidate_ids:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?id=eq.{cand_id}&select=mission_id",
                    headers=HEADERS_SB)
                if resp.json():
                    mid = resp.json()[0]["mission_id"]
                    count_resp = await client.get(
                        f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?mission_id=eq.{mid}&status=eq.approved&select=id",
                        headers={**HEADERS_SB, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
                    count = int(count_resp.headers.get("content-range", "0/0").split("/")[-1])
                    await client.patch(
                        f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mid}",
                        headers=HEADERS_SB,
                        json={"candidates_approved": count, "updated_at": datetime.now(timezone.utc).isoformat()})

    return {"approved": approved, "errors": errors}


@app.post("/api/scout-lab/reject")
async def reject_candidates(req: RejectRequest, authorization: str = Header(None)):
    """Reject candidates — removes them from consideration."""
    user = await get_current_user(authorization)
    rejected = 0
    now = datetime.now(timezone.utc).isoformat()

    async with httpx.AsyncClient(timeout=15) as client:
        for cand_id in req.candidate_ids:
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?id=eq.{cand_id}&user_id=eq.{user['user_id']}&status=eq.pending",
                headers=HEADERS_SB,
                json={"status": "rejected", "rejected_at": now, "updated_at": now})
            if resp.status_code < 300:
                rejected += 1

        # Update mission rejected counts
        for cand_id in req.candidate_ids:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?id=eq.{cand_id}&select=mission_id",
                headers=HEADERS_SB)
            if resp.json():
                mid = resp.json()[0]["mission_id"]
                count_resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?mission_id=eq.{mid}&status=eq.rejected&select=id",
                    headers={**HEADERS_SB, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
                count = int(count_resp.headers.get("content-range", "0/0").split("/")[-1])
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/scout_lab_missions?id=eq.{mid}",
                    headers=HEADERS_SB,
                    json={"candidates_rejected": count, "updated_at": now})

    return {"rejected": rejected}


@app.get("/api/scout-lab/candidates")
async def list_candidates(status: Optional[str] = "pending", limit: int = 100, authorization: str = Header(None)):
    """List candidates across all missions, filterable by status."""
    user = await get_current_user(authorization)
    url = f"{SUPABASE_URL}/rest/v1/scout_lab_candidates?user_id=eq.{user['user_id']}&order=rank_score.desc.nullslast&limit={limit}"
    if status:
        url += f"&status=eq.{status}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=HEADERS_SB)
        return resp.json()


# ═══════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
