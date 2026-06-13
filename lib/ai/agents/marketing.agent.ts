import type { BaseAgent, MarketingContextData } from "../types";
import { buildMarketingContext } from "../contexts/marketing.context";
import { MARKETING_PROMPT, MARKETING_TOOLS } from "../prompts/marketing.prompt";
import { executeAgent } from "./base.agent";
import { executeCreatePostDraft, executeGenerateCalendar } from "../tools/content.tools";

function contextToString(ctx: MarketingContextData): string {
  const servicesStr = ctx.services.map(s => `${s.name} (R$${s.price})`).join(", ") || "Nenhum";
  const topPostsStr = ctx.topPosts.length > 0
    ? ctx.topPosts.map(p => `  • "${p.description}" — ${p.likes_count} curtidas (${p.category})`).join("\n")
    : "Sem posts anteriores.";
  const memoriesStr = ctx.memories.length > 0
    ? ctx.memories.map(m => `  [${m.type}] ${m.content}`).join("\n")
    : "";
  const eventsStr = ctx.upcomingEvents.length > 0 ? `EVENTOS PRÓXIMOS: ${ctx.upcomingEvents.join(" | ")}` : "";

  return `PROFISSIONAL: ${ctx.professionalName}
ESPECIALIDADE: ${ctx.specialty}
SERVIÇOS: ${servicesStr}

TOP POSTS (maior engajamento):
${topPostsStr}
${memoriesStr ? `\nMEMÓRIAS DE CONTEÚDO:\n${memoriesStr}` : ""}
${eventsStr}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  switch (name) {
    case "create_post_draft": return executeCreatePostDraft(professionalId, args);
    case "generate_content_calendar": return executeGenerateCalendar(professionalId, args);
    default: return { error: `Tool ${name} não encontrada.` };
  }
}

export const marketingAgent: BaseAgent = {
  type: "marketing",
  buildContext: buildMarketingContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "marketing", systemPrompt: MARKETING_PROMPT, tools: MARKETING_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
