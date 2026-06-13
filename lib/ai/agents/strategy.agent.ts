import type { BaseAgent, StrategyContextData } from "../types";
import { buildStrategyContext } from "../contexts/strategy.context";
import { STRATEGY_PROMPT, STRATEGY_TOOLS } from "../prompts/strategy.prompt";
import { executeAgent } from "./base.agent";
import { executeSaveMemory } from "../tools/memory.tools";

function contextToString(ctx: StrategyContextData): string {
  const p = ctx.profile;
  const servicesStr = ctx.services.length > 0
    ? ctx.services.map(s => `  • ${s.name}: R$${s.price} (${s.item_type})`).join("\n")
    : "Nenhum item na loja.";
  const memoriesStr = ctx.memories.length > 0
    ? ctx.memories.map(m => `  [${m.type}] ${m.content}`).join("\n")
    : "";
  const eventsStr = ctx.upcomingEvents.length > 0 ? `EVENTOS PRÓXIMOS: ${ctx.upcomingEvents.join(" | ")}` : "";

  return `PROFISSIONAL: ${p.display_name || p.business_name}
ESPECIALIDADE: ${p.specialty || "Não definida"}
BIO: ${p.bio || "Sem bio"}
LOCAL: ${p.location || "Não informado"}
HORÁRIO: ${p.business_hours || "Não definido"}
WHATSAPP: ${p.whatsapp ? "Configurado" : "NÃO CONFIGURADO"}
SEGUIDORES: ${p.followers_count} | POSTS: ${p.posts_count} | AVALIAÇÃO: ${p.avg_rating > 0 ? `${p.avg_rating.toFixed(1)}/5` : "Sem avaliações"}

SERVIÇOS/PRODUTOS:
${servicesStr}
${memoriesStr ? `\nMEMÓRIA DO NEGÓCIO:\n${memoriesStr}` : ""}
${eventsStr}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  if (name === "save_memory") return executeSaveMemory(professionalId, args);
  return { error: `Tool ${name} não encontrada.` };
}

export const strategyAgent: BaseAgent = {
  type: "strategy",
  buildContext: buildStrategyContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "strategy", systemPrompt: STRATEGY_PROMPT, tools: STRATEGY_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
