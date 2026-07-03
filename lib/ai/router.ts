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
import { supabase } from "@/lib/supabase";
import { executeCreatorAnalyticsTool } from "./tools/creator-analytics.tools";
import { buildCreatorContext } from "./contexts/creator.context";
import { CREATOR_ANALYTICS_PROMPT, CREATOR_ANALYTICS_TOOLS } from "./prompts/creator-analytics.prompt";
import { CREATOR_STRATEGY_PROMPT, CREATOR_STRATEGY_TOOLS } from "./prompts/creator-strategy.prompt";

// ─── Agent Registry ──────────────────────────────────────────────────────────
import { agendaAgent } from "./agents/agenda.agent";
import { pricingAgent } from "./agents/pricing.agent";
import { marketingAgent } from "./agents/marketing.agent";
import { analyticsAgent } from "./agents/analytics.agent";
import { onboardingAgent } from "./agents/onboarding.agent";
import { strategyAgent } from "./agents/strategy.agent";
import { crmAgent } from "./agents/crm.agent";
import { financeAgent } from "./agents/finance.agent";
import { artDirectorAgent } from "./agents/art-director.agent";

const AGENT_REGISTRY: Record<AgentType, BaseAgent> = {
  agenda: agendaAgent,
  pricing: pricingAgent,
  marketing: marketingAgent,
  analytics: analyticsAgent,
  onboarding: onboardingAgent,
  strategy: strategyAgent,
  crm: crmAgent,
  finance: financeAgent,
  "art-director": artDirectorAgent,
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
  image_request: "art-director",
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
    const validAgents: AgentType[] = ["agenda", "marketing", "analytics", "pricing", "onboarding", "strategy", "crm", "finance", "art-director"];
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
  private chatHistory: { role: "user" | "assistant"; content: string; agentUsed?: AgentType }[] = [];

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
    onStatus?: (status: string) => void,
  ): Promise<AgentResponse & { agentUsed: AgentType }> {
    const session = this.sessionManager.get();

    onStatus?.("Verificando perfil...");
    // NOVO: atualizar isOnboarding a partir do perfil real
    const routerCtx = await buildRouterContext(professionalId, this.chatHistory, session);
    this.sessionManager.setOnboarding(routerCtx.session.isOnboarding);

    const profileType = routerCtx.professional.profile_type;
    if (profileType === 'creator') {
      const text = await routeCreatorMessage(message, professionalId);
      // Atualizar histórico
      this.chatHistory.push({ role: "user", content: message });
      this.chatHistory.push({ role: "assistant", content: text, agentUsed: 'strategy' });
      if (this.chatHistory.length > 40) {
        this.chatHistory = this.chatHistory.slice(-40);
      }
      return { text, sessionUpdate: {}, agentUsed: 'strategy' };
    }

    onStatus?.("Analisando intenção...");
    // Classificar intenção
    const classification = await classify(message, this.sessionManager.get(), this.chatHistory);
    console.log(`[Router] → ${classification.agent} (confidence: ${classification.confidence}, method: ${classification.method})`);

    // Obter agente
    const agent = AGENT_REGISTRY[classification.agent];

    onStatus?.("Reunindo informações...");
    // Construir contexto do agente
    const context = await agent.buildContext(professionalId);

    onStatus?.("Processando...");
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

// ─── ROTEAMENTO DO CRIADOR ────────────────────────────────────────

async function routeCreatorMessage(
  message: string, 
  creatorId: string
): Promise<string> {

  // ── CAMADA 1: Regex local (zero API) ─────────────────────────
  const lower = message.toLowerCase();

  if (/quantos seguidores|meus seguidores/.test(lower)) {
    const { count } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", creatorId);
    return `Você tem ${count || 0} seguidores no Daily. 🎉`;
  }

  if (/melhor horário|quando postar|que horas postar/.test(lower)) {
    const result = await executeCreatorAnalyticsTool(
      "get_best_posting_time", {}, creatorId
    );
    if (!result.success) return result.message;
    const top = result.best_times[0];
    return `Seu público é mais ativo na ${top[0]} — ` +
           `${top[1]} visualizações nesse período. 📊`;
  }

  if (/meus posts|performance|engajamento/.test(lower)) {
    const result = await executeCreatorAnalyticsTool(
      "get_post_performance", { period_days: 30 }, creatorId
    );
    if (!result.success) return result.message;
    const top = result.posts[0];
    return top
      ? `Seu post mais forte foi de ${top.category} com ` +
        `${top.likes_count} likes e ${top.view_count} views. 🔥`
      : "Ainda não temos dados suficientes. Continue postando!";
  }

  // ── CAMADA 2 e 3: Gemini com agente especializado ────────────
  const context = await buildCreatorContext(creatorId);

  // Classificar intenção para escolher agente
  const intent = await classifyCreatorIntent(message);

  const { prompt, tools } = intent === 'analytics'
    ? { prompt: CREATOR_ANALYTICS_PROMPT, tools: CREATOR_ANALYTICS_TOOLS }
    : { prompt: CREATOR_STRATEGY_PROMPT, tools: CREATOR_STRATEGY_TOOLS };

  return callGeminiWithTools({
    systemPrompt: prompt,
    userMessage: message,
    context,
    tools,
    onToolCall: (toolName: string, args: any) =>
      executeCreatorAnalyticsTool(toolName, args, creatorId),
    onSaveMemory: (type: string, content: string) =>
      saveCreatorMemory(creatorId, type, content),
  });
}

// Classifica se a mensagem é sobre analytics ou estratégia
async function classifyCreatorIntent(
  message: string
): Promise<'analytics' | 'strategy'> {
  const analyticsWords = [
    'visualizações', 'views', 'seguidores', 'horário',
    'performance', 'engajamento', 'crescimento', 'dados'
  ];
  
  const lower = message.toLowerCase();
  if (analyticsWords.some(w => lower.includes(w))) {
    return 'analytics';
  }
  
  return 'strategy'; 
}

// Salva memória na tabela do criador
async function saveCreatorMemory(
  creatorId: string,
  memoryType: string,
  content: string
) {
  // @ts-ignore
  await supabase.from("creator_memory").insert({
    creator_id: creatorId,
    memory_type: memoryType,
    content,
  });
}

async function callGeminiWithTools({ systemPrompt, userMessage, context, tools, onToolCall, onSaveMemory }: any) {
  const fullPrompt = `${systemPrompt}\n\n${context}`;
  const response = await callGeminiProxy({
    system_instruction: { parts: [{ text: fullPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools,
    generationConfig: { temperature: 0.7 }
  });

  let fullText = "";
  let functionCall: any = null;
  const parts = response?.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.text) fullText += part.text;
    if (part.functionCall) functionCall = part.functionCall;
  }

  if (functionCall) {
    if (functionCall.name === "save_memory") {
      await onSaveMemory(functionCall.args.memory_type, functionCall.args.content);
      return "Memória atualizada!";
    } else {
      const toolResult = await onToolCall(functionCall.name, functionCall.args);
      if (!toolResult.success) return toolResult.message;
      return "Análise concluída. " + JSON.stringify(toolResult);
    }
  }

  return fullText || "Sem resposta.";
}
