import type { BaseAgent, CRMContextData } from "../types";
import { buildCRMContext } from "../contexts/crm.context";
import { CRM_PROMPT, CRM_TOOLS } from "../prompts/crm.prompt";
import { executeAgent } from "./base.agent";
import { executeListInactiveClients, executeSaveClientNote } from "../tools/crm.tools";

function contextToString(ctx: CRMContextData): string {
  const segStr = `  🟢 Ativas (≤30d): ${ctx.segments.active}
  🟡 Em risco (30-60d): ${ctx.segments.at_risk}
  🔴 Inativas (60d+): ${ctx.segments.inactive}
  🆕 Novas (1 visita): ${ctx.segments.new_clients}`;

  const clientsStr = ctx.clients.length > 0
    ? ctx.clients.slice(0, 15).map(c =>
        `  • [id:${c.id}] ${c.name} — ${c.visit_count} visitas, ${c.days_since_last_visit}d sem vir${c.last_service_name ? ` (último: ${c.last_service_name})` : ""}`,
      ).join("\n")
    : "Nenhum cliente registrado.";

  return `PROFISSIONAL: ${ctx.professionalName}

SEGMENTAÇÃO:
${segStr}

CLIENTES:
${clientsStr}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  switch (name) {
    case "list_inactive_clients": return executeListInactiveClients(professionalId, args);
    case "save_client_note": return executeSaveClientNote(professionalId, args);
    default: return { error: `Tool ${name} não encontrada.` };
  }
}

export const crmAgent: BaseAgent = {
  type: "crm",
  buildContext: buildCRMContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "crm", systemPrompt: CRM_PROMPT, tools: CRM_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
