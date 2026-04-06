# Rose Glass Sales Platform

CERATA-powered sales intelligence for behavioral health / addiction recovery.

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────┐
│  Frontend (Vercel)          │      │  Supabase             │
│  Next.js / React            │◄────►│  xrzycmvpqohxxlhnorpt │
│  Chat + Lead Dashboard      │      │  566 leads loaded     │
└──────────┬──────────────────┘      └──────────┬───────────┘
           │                                     │
           │ /api/* proxy                        │
           ▼                                     │
┌─────────────────────────────┐                  │
│  Backend (Railway)          │◄─────────────────┘
│  FastAPI                    │
│  ├─ Scout Agent (web search)│  6am + 2pm cron
│  ├─ CERATA Ranking Engine   │  after scouts
│  └─ Chat API                │  real-time
└─────────────────────────────┘
```

## Pipeline

1. **Ingest** — Wiza CSVs → Supabase leads table
2. **Scout** — Anthropic API + web search → buying signals per lead (2x/day)
3. **Rank** — CERATA v2 bridge computational analysis → Ψ, ρ, q, f → coherence → tier
4. **Chat** — User queries leads, provides feedback, gets recommendations
5. **Outreach** — (Phase 2) BD agent emails leads exceeding thresholds

## CERATA Dimensions

| Dim | Name | What It Measures |
|-----|------|-----------------|
| Ψ | Intent Coherence | Need/solution match |
| ρ | Decision Authority | Can they buy? |
| q | Urgency (bio-optimized) | When do they need it? |
| f | Ecosystem Fit | ICP alignment |

**Coherence:** `C = Ψ + (ρ × Ψ) + q_opt + (f × Ψ) + 0.15ρΨ`  
**Bio-optimization:** `q_opt = q / (Km + q + q²/Ki)` — Michaelis-Menten prevents gaming

## Setup

### Backend (Railway)

```bash
cd rose-glass-sales/
# Set env vars on Railway:
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, PORT=8000
```

### Frontend (Vercel)

```bash
cd frontend/
npm install
# Set NEXT_PUBLIC_API_URL to Railway URL
npm run dev
```

## Env Vars

| Var | Where | Value |
|-----|-------|-------|
| `SUPABASE_URL` | Railway | `https://xrzycmvpqohxxlhnorpt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway | From Supabase dashboard |
| `ANTHROPIC_API_KEY` | Railway | Anthropic API key |
| `PORT` | Railway | `8000` |
| `NEXT_PUBLIC_API_URL` | Vercel | Railway public URL |

## Author

Christopher MacGregor bin Joseph  
ROSE Corp / MacGregor Holding Company — Jackson Hole, Wyoming — SDVOSB
