import type { BaseAgent, FinanceContextData } from "../types";
import { buildFinanceContext } from "../contexts/finance.context";
import { FINANCE_PROMPT, FINANCE_TOOLS } from "../prompts/finance.prompt";
import { executeAgent } from "./base.agent";
import { executeGetRevenueSummary, executeSetRevenueGoal } from "../tools/finance.tools";

function contextToString(ctx: FinanceContextData): string {
  const m = ctx.metrics;
  const servicesStr = ctx.services.map(s => `  • ${s.name}: R$${s.price}`).join("\n") || "Nenhum";
  const goalStr = ctx.revenueGoal
    ? `\nMETA DO MÊS: R$ ${ctx.revenueGoal.monthly_target}\n  Progresso: R$ ${ctx.revenueGoal.current_progress} (${ctx.revenueGoal.percentage}%)`
    : "\nSEM META DEFINIDA — sugira ao profissional definir uma!";

  return `RESUMO FINANCEIRO (últimos 30 dias):
  💰 Receita estimada: R$ ${m.total_revenue_30d}
  🎫 Ticket médio: R$ ${m.avg_ticket}
  📅 Atendimentos completados: ${m.appointments_30d}
  📈 Projeção mensal: R$ ${m.projected_monthly}

SERVIÇOS:
${servicesStr}
${goalStr}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  switch (name) {
    case "get_revenue_summary": return executeGetRevenueSummary(professionalId, args);
    case "set_revenue_goal": return executeSetRevenueGoal(professionalId, args);
    default: return { error: `Tool ${name} não encontrada.` };
  }
}

export const financeAgent: BaseAgent = {
  type: "finance",
  buildContext: buildFinanceContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "finance", systemPrompt: FINANCE_PROMPT, tools: FINANCE_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
