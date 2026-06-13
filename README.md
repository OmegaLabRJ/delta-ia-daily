# Daily AI Core Architecture: Enterprise Subagent System

This repository showcases the isolated **AI Core Logic** of **Daily**, an Agentic Commerce platform engineered to digitize local micro-retail and service-based businesses. Powered by **Google Gemini 2.5 Flash** and **Supabase**, the architecture moves beyond simple chatbot wrappers into a secure, deterministic, and transaction-safe multi-agent ecosystem.

---

## 📚 Official Documentation

To facilitate technical auditing, the documentation is divided into specialized modules:

- [**1. AI Architecture & Ecosystem (This Document)**](#-ecosystem-overview-8-subagent-architecture)
- [**2. Headless AI Vision & Future Hub**](docs/business-vision.md)
- [**3. Tier-Based Routing & Unit Economics**](docs/unit-economics.md)
- [**4. Strategic Implementation Roadmap**](docs/roadmap.md)

---

## 📁 Repository Structure

This showcase is explicitly decoupled from front-end layout configurations and styles to allow for strict technical auditing of our AI infrastructure:

```text
delta-ia-daily/
├── README.md                        # Enterprise Architecture Documentation
├── docs/                            # Extensive Project Documentation
├── lib/
│   ├── ai/                          # 8-Subagent Core Logic
│   │   ├── router.ts                # Main intent classifier and routing orchestrator
│   │   ├── session-context.ts       # Handoff memory manager between turns
│   │   ├── types.ts                 # Type definitions for the 8 Subagents
│   │   ├── agents/                  # The 8 individual Subagents
│   │   ├── contexts/                # Isolated Context Builders
│   │   ├── prompts/                 # Specialized Prompts for each Agent
│   │   └── tools/                   # Isolated function tools
│   ├── intent-classifier.ts         # Multi-word Local Intent Parser (Latency & Cost Optimization)
│   ├── ai.ts                        # Gemini LLM Initialization
│   └── ai-tools.ts                  # Legacy monolithic tools
├── database-schema/
│   ├── 20260517050000_ai_context_fields.sql # Supabase Migration for Context memory
│   ├── ai_logs_setup.sql            # Table structure for AI observabliity and usage logs
│   ├── init_ai_schema.sql           # PostgreSQL Schema: 3-Layer Memory, Audit Logs, and RLS
│   ├── fix_missing_columns.sql      # Schema migrations for missing columns
│   ├── rpc_get_week_availability.sql # Postgres function for retrieving availability
│   ├── seed_demo_account.sql        # Seed data for demo accounts
│   └── cleanup_demo.sql             # Script to clean up demo data
├── hooks/
│   ├── use-ai-chat.ts               # B2B Merchant Agent Logic ("Consultora Daily")
│   └── use-consumer-ai-chat.ts      # B2C Consumer Agent Logic ("Delta")
├── supabase-edge-functions/
│   ├── gemini-chat/                 # Secure Server-Side API Handshake & Token Management
│   ├── daily-briefing/              # Autonomous Business Analytics Aggregator
│   ├── notify-booking/              # Real-Time Transactional Webhooks
│   └── gerar-texto-daily/           # Generates text content using Gemini
└── ui-components/
    ├── ai-chat.tsx                  # B2B Conversational Interface Core
    └── consumer-ai-chat/
        └── [id].tsx                 # B2C Frictionless Checkout & Booking Interface
```

---

## 🏛️ Ecosystem Overview: 8-Subagent Architecture

> **Note**: This is a read-only architectural showcase, decoupled from the main application. Files under `lib/ai/` that reference `@/lib/supabase` assume the Supabase client configuration from the main Daily repository and are not intended to run standalone here.

The AI ecosystem has evolved from a monolithic structure into a highly sophisticated **Subagent Architecture** (1 B2C Agent + 1 B2B Router orchestrating 8 Specialists). This drastically reduces token consumption, eliminates hallucination risks by isolating context, and provides specialized memory scopes.

```mermaid
graph TD
    %% Inputs
    subgraph "1. Frontend (App Expo)"
        A1[Consumer: Booking/Purchase] --> B
        A2[Professional: Chat Consultoria] --> C1
    end

    %% Orchestration & Memory
    subgraph "2. Orchestration & Memory"
        B[Delta Consumer\nuse-consumer-ai-chat]
        
        C1{Router Agent\n3-Layer Classification}
        C2[(Session Context\nEphemeral Handoff Memory)]
    end

    %% Subagents
    subgraph "3. The 8 Specialist Subagents"
        S1[Agenda]
        S2[Pricing]
        S3[Marketing]
        S4[Analytics]
        S5[Onboarding]
        S6[Strategy]
        S7[CRM]
        S8[Finance]
    end

    %% AI Engines
    subgraph "4. LLM Engines (Google Gemini)"
        F1[Gemini 1.5 Flash\nFast Triage (10 tokens)]
        F2[Gemini 1.5 Flash/Pro\nComplex Execution]
    end

    %% Distributed Tools
    subgraph "5. Domain-Specific Tools"
        T1[appointment.tools.ts]
        T2[content.tools.ts]
        T3[finance.tools.ts]
        T4[crm.tools.ts]
    end

    %% Backend & Third-Party
    subgraph "6. Backend Services"
        E[Supabase Auth\nJWT Control]
        DB[(Supabase DB\nPostgreSQL)]
        P[Pollinations AI\nImages]
    end

    %% Consumer Flow
    B --> E
    B --> F2
    B --> T1
    
    %% Professional Flow
    C1 -->|Reads & Writes| C2
    C1 -->|1. Local Regex (0 Tokens)\n2. Flash (10 Tokens)\n3. Context (50 Tokens)| F1
    C1 -- "Dispatches to" --> S1
    C1 --> S2 & S3 & S4 & S5 & S6 & S7 & S8

    %% Subagents Executing
    S1 --> T1
    S3 --> T2
    S8 --> T3
    S7 --> T4

    %% Tools Accessing DB/APIs
    T1 --> DB
    T3 --> DB
    T4 --> DB
    T2 --> P

    S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 --> F2
```

### 1. Consultora Daily (B2B Router + 8 Subagents)

| Attribute | Detail |
|-----------|--------|
| **Architecture** | A Router Agent that classifies intent across 3 layers (Local Regex → Fast Gemini Flash → Deep Context) and dispatches to 8 isolated subagents: **Agenda, Pricing, Marketing, Analytics, Onboarding, Strategy, CRM, and Finance**. |
| **Target** | Beauty Professionals and Store Owners |
| **Role** | Business strategist, marketing manager, and operational assistant |
| **Capabilities** | Each subagent has its own specific context and tools. *Pricing* analyzes local market rates; *Finance* tracks revenue goals; *CRM* recovers inactive clients; *Marketing* generates multi-channel content. |
| **SessionContext** | Subagents communicate via an ephemeral `SessionContext` memory. If the *Agenda* agent books a client, the *Marketing* agent reads this handoff context to generate a "Thank You" post without requiring full conversation history. |

### 2. Delta (B2C Agent)

| Attribute | Detail |
|-----------|--------|
| **Target** | End Consumers (Clients) |
| **Role** | Virtual receptionist and booking assistant representing the professional's store |
| **Capabilities** | Engages clients in natural conversation, answers questions about services, prices, and operating hours, and handles the complete booking flow autonomously |

---

## ⚙️ Technical Highlights

### 1. Cost-Optimized Intent Classification

To radically reduce latency and API costs, the system implements a **Local Intent Classifier** (`intent-classifier.ts`).
Before any LLM invocation, user input is evaluated against highly refined, multi-word Regex patterns.

- **Impact:** Common actions (e.g., checking the calendar, viewing metrics, adjusting settings) bypass the LLM entirely, instantly opening native app screens. This saves tokens, drops latency to zero for navigational commands, and prevents the LLM from hallucinating UI actions.

### 2. Deterministic Function Calling (Tool Use)

The AI interacts with the Supabase backend strictly through strongly-typed Function Calling defined in `ai-tools.ts`.

- **Type Safety:** Tools like `create_appointment`, `save_memory`, and `create_post_draft` enforce structured JSON schemas.
- **Graceful Fallbacks:** Replaced fragile string-matching (e.g., regexing `TAGS:`) with robust, schema-driven JSON parsing to guarantee deterministic outputs for critical operations like social media caption generation.
- **Secure Execution:** LLM API calls are executed securely inside Supabase Edge Functions (`gemini-chat`), hiding API keys and leveraging the backend's Row Level Security (RLS).

### 3. Anti-Double-Booking Logic

Delta's booking system handles the complex reality of calendar management:

- Validates requested slots against the professional's specific `schedules` configuration (working days, break times, slot duration).
- Performs real-time conflict validation against existing `appointments` immediately before insert, preventing race conditions.
- Seamlessly injects context (such as extracting the client's name from their profile and adding it to the appointment notes) so the professional's native Agenda view remains perfectly accurate.
- On successful booking, Delta autonomously generates a direct `wa.me` WhatsApp link, which the custom UI parser instantly converts into an actionable button for the client.

### 4. Context-Aware Memory & Ephemeral Handoff

The system uses an advanced context builder that isolates memory per subagent. Instead of loading 2,500+ tokens for every request:
- The **Pricing Agent** only loads the service catalog.
- The **CRM Agent** only loads client visit histories and segments.
- The **Marketing Agent** only loads historical top-performing posts.

**Ephemeral Handoff:** Agents share context via `SessionContext`. When one agent performs an action (e.g., booking an appointment), it writes to the ephemeral session. The Router reads this session to maintain conversational continuity if a different agent is invoked in the next turn.

This precise context injection allows dynamic temperature calibration per subagent (e.g., `0.1` for strictly deterministic Finance/Agenda tools, and `0.68` for creative Marketing generation), drastically reducing hallucinations and cutting API token costs by ~60%.

---

## 🏗️ Built With

| Technology | Purpose |
|------------|---------|
| **Google Gemini 2.5 Flash** | Core LLM for reasoning, strategy, and conversation |
| **Supabase** | PostgreSQL database, Edge Functions, Auth, Realtime, and Storage |
| **React Native / Expo** | Cross-platform mobile application framework |
| **TypeScript** | End-to-end type safety across the entire stack |
| **Vertex AI** | Media generation pipeline (Imagen 3, Veo API) |
| **Google Ads API** | Autonomous ad distribution (roadmap) |

---

<p align="center">
  <strong>DAILY: Turning AI Engineering into Real Impact for Local Businesses.</strong>
</p>
