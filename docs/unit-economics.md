# 📊 Unit Economics & Scaling Strategy

## ⚙️ Tier-Based AI Routing Architecture

To scale seamlessly to thousands of concurrent users without creating an unsustainable cloud compute burn rate, the system utilizes a server-side **Tier-Based AI Routing Pipeline**:

```text
  ┌──────────────────┐
  │   USER REQUEST    │
  │ (Merchant / Chat) │
  └────────┬─────────┘
           ▼
  ┌──────────────────────────┐
  │   ORCHESTRATOR           │
  │   Gemini Omni Flash      │
  │   (High-Speed Intel)     │
  └────────┬─────────────────┘
           ▼
  ┌──────────────────────────┐
  │   EDGE FUNCTION          │
  │   (Supabase)             │
  │   Tier Check & Routing   │
  └────┬─────────────┬───────┘
       ▼             ▼
┌──────────────┐ ┌───────────────────────┐
│  FREEMIUM    │ │  PREMIUM TIER         │
│  TIER        │ │  (High-Fidelity       │
│  (Low-Fi)    │ │   Enterprise Engine)  │
│              │ │                       │
│  Optimized,  │ │  • Veo API (Cinematic │
│  lower-cost  │ │    Video)             │
│  open-source │ │  • Imagen 3 (Studio   │
│  models      │ │    Photos)            │
│              │ │  • Gemini 1.5 Pro     │
│              │ │    (Advanced)         │
└──────────────┘ └───────────────────────┘
```

- **The Orchestrator (Gemini Omni Flash):** Intercepts the user request, checks the merchant's subscription status via PostgreSQL, and dynamically routes the media engineering payload.
- **Freemium Tier Routing (Low-Fidelity Engine):** Free users are routed to highly optimized, lower-fidelity open-source models for basic imagery. This satisfies the "test drive" concept at near-zero token cost.
- **Premium Tier Routing (High-Fidelity Enterprise Engine):** Premium subscriptions unlock access to flagship creative models—**Imagen 3** (for professional studio photography) and **Google Veo API** (pending enterprise private preview access)—delivering unmatched, professional aesthetic results.

---

## 📊 Sustainable Unit Economics & Scalability (1,000+ Users Benchmark)

By replacing volatile "per-day" allowances with a **Monthly Tokenized Quota Model**, our unit economics scale securely while maintaining strong net margins.

### 1. Free Impact Tier (The Product-Led Growth Engine)

| Parameter | Value |
|-----------|-------|
| **Allocation** | 1 Low-Fidelity Video + 3 Standard Images per month |
| **Compute Cost** | Fractions of a cent per user |
| **Strategic Growth** | Operates as an organic acquisition funnel; users convert to paid tiers once they track clear financial ROI from their initial free campaigns |

### 2. Starter Tier (The Democratic Premium)

| Parameter | Value |
|-----------|-------|
| **Target Price Point** | ~R$ 34.90 / month |
| **Monthly Allocation** | 2 Cinematic Videos + 5 Professional Studio Photos |

#### Projected Unit Economics (Per User / Month)

| Cost Component | Value |
|----------------|-------|
| 2 Cinematic Video Generations (Vertex AI) | ~R$ 10.00 |
| 5 Imagen 3 Studio Asset Generations | ~R$ 0.75 |
| Gemini Omni Text & Core Infrastructure | ~R$ 0.50 |
| **Total Projected Cloud Cost** | **R$ 11.25 / user / month** |

#### Financial Sustainability at Scale (1,000 Active Premium Subscribers)

```text
  ┌────────────────────────────────────────────────────────┐
  │                   THE CLOUD MATH                       │
  │                                                        │
  │   2 Veo Videos    5 Imagen 3    Gemini Text            │
  │   ~R$ 10.00    +  ~R$ 0.75   +  ~R$ 0.50              │
  │                                                        │
  │          = R$ 11.25 per user / month                   │
  ├────────────────────────────────────────────────────────┤
  │                                                        │
  │   MRR (Revenue)        Cloud Costs      NET MARGIN     │
  │   R$ 34,900.00    -   R$ 11,250.00   = R$ 23,650.00   │
  │      /month              /month           /month       │
  │                                                        │
  │   ✅ Highly secure, scalable margin to fund            │
  │      operations and continuous R&D.                    │
  └────────────────────────────────────────────────────────┘
```
