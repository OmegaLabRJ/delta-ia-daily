# Daily AI Architecture: Enterprise Dual-Agent System

This repository isolates the **Core Artificial Intelligence Engine** of the Daily platform. Daily operates as a comprehensive B2B2C beauty ecosystem, featuring a sophisticated dual-agent architecture that serves both professionals and end-consumers simultaneously.

## Ecosystem Overview: Dual-Agent Architecture

The AI ecosystem is divided into two distinct, highly specialized agents that interact with different user groups but share the same underlying platform infrastructure:

1. **Consultora Daily (B2B)**
   - **Target:** Beauty Professionals and Store Owners.
   - **Role:** Business strategist, marketing manager, and operational assistant.
   - **Capabilities:** Generates automated content calendars, creates SEO-optimized product descriptions with differentiated copy strategies, drafts social media posts with AI-generated image prompts (via Flux/HuggingFace), and tracks critical business metrics.
   - **Long-term Memory:** Proactively asks for missing business data (one field at a time to minimize cognitive load) and stores long-term business facts for highly personalized advice.

2. **Delta (B2C)**
   - **Target:** End Consumers (Clients).
   - **Role:** Virtual receptionist and booking assistant representing the professional's store.
   - **Capabilities:** Engages clients in natural conversation, answers questions about services, prices, and operating hours, and handles the complete booking flow autonomously.

---

## Technical Highlights

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

### 4. Context-Aware Memory & Injection
The system uses an advanced context builder that aggregates:
- The professional's profile data (bio, hours, location).
- Real-time catalog data (services and prices).
- Top-performing historical posts.
- Upcoming seasonal events (dynamically filtered for the next 30 days).
- Short-term conversational history.
This precise context injection allows the AI to operate at a lower temperature (`0.68`) for business-critical operations, drastically reducing hallucinations while maintaining a warm, empathetic persona.

---

## Repository Structure

- `/core-logic`: The brain of the application. Contains the AI proxy wrapper, tool definitions, execution logic, and the local intent classifier.
- `/hooks`: React hooks (`use-ai-chat.ts`, `use-consumer-ai-chat.ts`) that manage state, message streaming, context building, and UI integration for both agents.
- `/supabase-edge-functions`: Secure serverless functions for interacting with Google Gemini, handling push notifications, and executing periodic AI tasks (like daily briefings).
- `/database-schema`: SQL definitions detailing the tables required for memory, booking, and context storage.
- `/ui-components`: The React Native UI layer, featuring custom message bubbles with link parsing (e.g., converting WhatsApp URLs into interactive buttons) and typing indicators.
