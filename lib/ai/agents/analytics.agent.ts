import type { BaseAgent, AnalyticsContextData } from "../types";
import { buildAnalyticsContext } from "../contexts/analytics.context";
import { ANALYTICS_PROMPT, ANALYTICS_TOOLS } from "../prompts/analytics.prompt";
import { executeAgent } from "./base.agent";
import { executeGetAnalytics } from "../tools/analytics.tools";

function contextToString(ctx: AnalyticsContextData): string {
  const topItemsStr = ctx.itemMetrics.topItems.length > 0
    ? ctx.itemMetrics.topItems.map(i => `  • ${i.name}: ${i.views} views, ${i.clicks} cliques WhatsApp`).join("\n")
    : "Nenhum item.";

  return `MÉTRICAS GERAIS:
  👁️ Total de views: ${ctx.itemMetrics.total_views}
  📲 Cliques WhatsApp: ${ctx.itemMetrics.total_whatsapp_clicks}
  🛍️ Itens na loja: ${ctx.itemMetrics.items_count}

TOP ITENS:
${topItemsStr}

PERFIL:
  👥 Seguidores: ${ctx.profileStats.followers_count}
  📝 Posts: ${ctx.profileStats.posts_count}
  ⭐ Avaliação: ${ctx.profileStats.avg_rating > 0 ? `${ctx.profileStats.avg_rating.toFixed(1)}/5 (${ctx.profileStats.total_reviews} avaliações)` : "Sem avaliações"}

AGENDAMENTOS:
  ✅ Confirmados: ${ctx.appointmentStats.total_confirmed}
  ✔️ Completados: ${ctx.appointmentStats.total_completed}
  ❌ Cancelados: ${ctx.appointmentStats.total_cancelled}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  if (name === "get_analytics") return executeGetAnalytics(professionalId, args);
  return { error: `Tool ${name} não encontrada.` };
}

export const analyticsAgent: BaseAgent = {
  type: "analytics",
  buildContext: buildAnalyticsContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "analytics", systemPrompt: ANALYTICS_PROMPT, tools: ANALYTICS_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
