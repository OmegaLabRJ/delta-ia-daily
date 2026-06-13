import type { BaseAgent, OnboardingContextData } from "../types";
import { buildOnboardingContext } from "../contexts/onboarding.context";
import { ONBOARDING_PROMPT, ONBOARDING_TOOLS } from "../prompts/onboarding.prompt";
import { executeAgent } from "./base.agent";
import { executeSaveMemory } from "../tools/memory.tools";

function contextToString(ctx: OnboardingContextData): string {
  const completedStr = Object.entries(ctx.profile)
    .map(([key, val]) => `  ${val ? "✅" : "❌"} ${key.replace("has_", "").replace(/_/g, " ")}`)
    .join("\n");

  const missingStr = ctx.missingData.length > 0
    ? ctx.missingData.map(d => `  ${d.priority}. ${d.field} — "${d.suggestedQuestion}"`).join("\n")
    : "Nenhum dado faltando! ✅";

  return `PROFISSIONAL: ${ctx.professionalName}

STATUS DO PERFIL:
${completedStr}

DADOS FALTANTES (perguntar 1 por vez):
${missingStr}

MEMÓRIAS JÁ SALVAS: ${ctx.existingMemories.length > 0 ? ctx.existingMemories.join("; ") : "Nenhuma"}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  if (name === "save_memory") return executeSaveMemory(professionalId, args);
  return { error: `Tool ${name} não encontrada.` };
}

export const onboardingAgent: BaseAgent = {
  type: "onboarding",
  buildContext: buildOnboardingContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "onboarding", systemPrompt: ONBOARDING_PROMPT, tools: ONBOARDING_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
