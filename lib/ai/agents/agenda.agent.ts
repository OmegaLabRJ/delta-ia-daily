import type { BaseAgent, AgendaContextData, SessionContext, AgentResponse } from "../types";
import { buildAgendaContext } from "../contexts/agenda.context";
import { AGENDA_PROMPT, AGENDA_TOOLS } from "../prompts/agenda.prompt";
import { executeAgent } from "./base.agent";
import { executeCreateAppointment, executeCancelAppointment, executeListTodayAppointments } from "../tools/appointment.tools";

function contextToString(rawCtx: any): string {
  const ctx = rawCtx as AgendaContextData;
  const servicesStr = ctx.services.length > 0
    ? ctx.services.map(s => `  • ${s.name} (R$${s.price}) — ${s.duration_minutes}min [ID: ${s.id}]`).join("\n")
    : "Nenhum serviço cadastrado.";

  const apptsStr = ctx.todayAppointments.length > 0
    ? ctx.todayAppointments.map(a => `  • ${a.time} — ${a.client_name} → ${a.service_name} (${a.status}) [ID: ${a.id}]`).join("\n")
    : "Nenhum agendamento.";

  return `PROFISSIONAL: ${ctx.professionalName}
SERVIÇOS DISPONÍVEIS:
${servicesStr}

AGENDA (próximos dias):
${apptsStr}

HOJE: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  switch (name) {
    case "create_appointment": return executeCreateAppointment(professionalId, args);
    case "cancel_appointment": return executeCancelAppointment(professionalId, args);
    case "list_today_appointments": return executeListTodayAppointments(professionalId, args);
    default: return { error: `Tool ${name} não encontrada.` };
  }
}

export const agendaAgent: BaseAgent = {
  type: "agenda",
  buildContext: buildAgendaContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "agenda", systemPrompt: AGENDA_PROMPT, tools: AGENDA_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
