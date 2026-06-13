/**
 * Router Agent — Classificação de intenção + orquestração de subagentes.
 *
 * Pipeline de 3 camadas:
 *   1. classifyLocal() (regex, 0 tokens) → confidence ≥ 0.8 → despacha direto
 *   2. Gemini Flash (~10 tokens) se confidence 0.4–0.8
 *   3. Gemini com histórico (últimas 5 trocas) se < 0.4
 */
import type { AgentType, AgentResponse, BaseAgent, SessionContext } from "./types";
import { SessionManager } from "./session-context";
import { buildRouterContext } from "./contexts/router.context";
import { ROUTER_PROMPT } from "./prompts/router.prompt";
import { callGeminiProxy, resetRateLimit, type GeminiContent } from "@/lib/ai";
import { classifyLocal } from "@/lib/intent-classifier";

// ─── Agent Registry ──────────────────────────────────────────────────────────
import { agendaAgent } from "./agents/agenda.agent";
import { pricingAgent } from "./agents/pricing.agent";
import { marketingAgent } from "./agents/marketing.agent";
import { analyticsAgent } from "./agents/analytics.agent";
import { onboardingAgent } from "./agents/onboarding.agent";
import { strategyAgent } from "./agents/strategy.agent";
import { crmAgent } from "./agents/crm.agent";
import { financeAgent } from "./agents/finance.agent";

const AGENT_REGISTRY: Record<AgentType, BaseAgent> = {
  agenda: agendaAgent,
  pricing: pricingAgent,
  marketing: marketingAgent,
  analytics: analyticsAgent,
  onboarding: onboardingAgent,
  strategy: strategyAgent,
  crm: crmAgent,
  finance: financeAgent,
};

// ─── Intent → AgentType mapping ──────────────────────────────────────────────
const INTENT_TO_AGENT: Record<string, AgentType> = {
  schedule_action: "agenda",
  pricing_question: "pricing",
  content_request: "marketing",
  analytics_request: "analytics",
  client_management: "crm",
  finance_question: "finance",
  onboarding: "onboarding",
  open_question: "strategy",
  greeting: "strategy",
};

// ─── Extra patterns for new agent types ──────────────────────────────────────
const EXTRA_PATTERNS: { patterns: RegExp[]; agent: AgentType; confidence: number }[] = [
  {
    patterns: [
      /\b(cancel|cancelar|desmarca|desmarcar)\b/i,
      /\b(minha\s+agenda|agenda\s+de\s+hoje|agendamentos?\s+do\s+dia|listar?\s+agenda)\b/i,
    ],
    agent: "agenda",
    confidence: 0.85,
  },
  {
    patterns: [
      /\b(client(es?|a)|faz\s+tempo|não\s+vem|follow.?up|lembrete|retenção|retorno)\b/i,
    ],
    agent: "crm",
    confidence: 0.8,
  },
  {
    patterns: [
      /\b(fatur(amento|ei|ar)|receita|ticket\s+médio|quanto\s+ganhei|meta\s+(de\s+)?faturamento)\b/i,
    ],
    agent: "finance",
    confidence: 0.8,
  },
];

// ─── Classification ──────────────────────────────────────────────────────────
interface ClassificationResult {
  agent: AgentType;
  confidence: number;
  method: "local" | "gemini-light" | "gemini-full";
}

async function classify(
  message: string,
  session: SessionContext,
  recentHistory: { role: string; content: string; agentUsed?: AgentType }[],
): Promise<ClassificationResult> {
  // Camada 1: classifyLocal (regex)
  const local = classifyLocal(message);
  const mappedAgent = INTENT_TO_AGENT[local.intent];

  if (mappedAgent && local.confidence >= 0.8) {
    return { agent: mappedAgent, confidence: local.confidence, method: "local" };
  }

  // Check extra patterns
  for (const extra of EXTRA_PATTERNS) {
    if (extra.patterns.some(p => p.test(message))) {
      return { agent: extra.agent, confidence: extra.confidence, method: "local" };
    }
  }

  // Continuação de tópico — se a mensagem é curta e há agente anterior, mantenha
  if (session.lastAgentUsed && message.split(" ").length <= 5) {
    const continueWords = /^(sim|não|ok|pode|isso|esse|essa|claro|bora|manda|beleza|confirma|pode\s+ser|tá|ta|s|n)/i;
    if (continueWords.test(message.trim())) {
      return { agent: session.lastAgentUsed, confidence: 0.85, method: "local" };
    }
  }

  // Profissional novo → forçar onboarding se ambíguo
  if (session.isOnboarding && (!mappedAgent || local.confidence < 0.6)) {
    return { agent: "onboarding", confidence: 0.75, method: "local" };
  }

  // Camada 2/3: Gemini classificação (com histórico)
  const historyContext = recentHistory.slice(-5).map(h =>
    `${h.role === "user" ? "PROFISSIONAL" : "CONSULTORA"}: ${h.content.slice(0, 200)}`
  ).join("\n");

  const classifyPrompt = `${ROUTER_PROMPT}

HISTÓRICO RECENTE:
${historyContext || "(primeira mensagem)"}

SESSÃO:
Último agente: ${session.lastAgentUsed || "nenhum"}
Última ação: ${session.lastActionResult?.summary || "nenhuma"}
Tópico atual: ${session.currentTopic || "nenhum"}

MENSAGEM DO PROFISSIONAL: "${message}"

Responda SOMENTE com o nome do agente:`;

  try {
    resetRateLimit();
    const data = await callGeminiProxy({
      contents: [{ role: "user", parts: [{ text: classifyPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 20 },
    });

    const response = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "";
    const validAgents: AgentType[] = ["agenda", "marketing", "analytics", "pricing", "onboarding", "strategy", "crm", "finance"];
    const detected = validAgents.find(a => response.includes(a));

    if (detected) {
      return { agent: detected, confidence: 0.9, method: recentHistory.length > 0 ? "gemini-full" : "gemini-light" };
    }
  } catch (e) {
    console.warn("[Router] Gemini classification failed, falling back to strategy:", e);
  }

  // Fallback final
  return { agent: session.isOnboarding ? "onboarding" : "strategy", confidence: 0.5, method: "local" };
}

// ─── Router Main ─────────────────────────────────────────────────────────────

export class Router {
  private sessionManager: SessionManager;
  private chatHistory: { role: string; content: string; agentUsed?: AgentType }[] = [];

  constructor() {
    this.sessionManager = new SessionManager();
  }

  getSession(): SessionContext {
    return this.sessionManager.get();
  }

  async route(
    message: string,
    professionalId: string,
    onChunk?: (text: string) => void,
  ): Promise<AgentResponse & { agentUsed: AgentType }> {
    const session = this.sessionManager.get();

    // NOVO: atualizar isOnboarding a partir do perfil real
    const routerCtx = await buildRouterContext(professionalId, this.chatHistory, session);
    this.sessionManager.setOnboarding(routerCtx.session.isOnboarding);

    // Classificar intenção
    const classification = await classify(message, this.sessionManager.get(), this.chatHistory);
    console.log(`[Router] → ${classification.agent} (confidence: ${classification.confidence}, method: ${classification.method})`);

    // Obter agente
    const agent = AGENT_REGISTRY[classification.agent];

    // Construir contexto do agente
    const context = await agent.buildContext(professionalId);

    // Executar agente (reseta o rate limit pois a classificação já gastou o tempo)
    resetRateLimit();
    const response = await agent.execute(
      message,
      context,
      session,
      this.chatHistory.map(h => ({ role: h.role, content: h.content })),
      onChunk,
    );

    // Atualizar sessão
    this.sessionManager.updateAfterAgent(
      classification.agent,
      response.sessionUpdate?.lastActionResult,
      classification.agent === session.lastAgentUsed ? session.currentTopic : classification.agent,
    );

    // Atualizar histórico
    this.chatHistory.push({ role: "user", content: message });
    this.chatHistory.push({ role: "assistant", content: response.text, agentUsed: classification.agent });

    // Trim do histórico (manter últimas 20 trocas = 40 entradas)
    if (this.chatHistory.length > 40) {
      this.chatHistory = this.chatHistory.slice(-40);
    }

    return { ...response, agentUsed: classification.agent };
  }

  reset(): void {
    this.sessionManager.reset();
    this.chatHistory = [];
  }

  getHistory() {
    return [...this.chatHistory];
  }
}
