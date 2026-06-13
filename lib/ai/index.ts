/**
 * lib/ai — Barrel export para a arquitetura de subagentes.
 */

// Core
export { Router } from "./router";
export { SessionManager } from "./session-context";
export type { AgentType, SessionContext, AgentResponse, BaseAgent } from "./types";
export { createEmptySession } from "./types";

// Agents
export { agendaAgent } from "./agents/agenda.agent";
export { pricingAgent } from "./agents/pricing.agent";
export { marketingAgent } from "./agents/marketing.agent";
export { analyticsAgent } from "./agents/analytics.agent";
export { onboardingAgent } from "./agents/onboarding.agent";
export { strategyAgent } from "./agents/strategy.agent";
export { crmAgent } from "./agents/crm.agent";
export { financeAgent } from "./agents/finance.agent";
