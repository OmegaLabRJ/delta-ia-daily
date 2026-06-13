import type { BaseAgent, PricingContextData } from "../types";
import { buildPricingContext } from "../contexts/pricing.context";
import { PRICING_PROMPT, PRICING_TOOLS } from "../prompts/pricing.prompt";
import { executeAgent } from "./base.agent";
import { executeSuggestPrice } from "../tools/pricing.tools";

function contextToString(ctx: PricingContextData): string {
  const pricesStr = ctx.currentPrices.length > 0
    ? ctx.currentPrices.map(p => `  • ${p.name}: R$${p.price} (${p.item_type})`).join("\n")
    : "Nenhum preço cadastrado.";

  return `REGIÃO: ${ctx.location}
ESPECIALIDADE: ${ctx.specialty}
TABELA DE PREÇOS ATUAL:
${pricesStr}`;
}

async function toolExecutor(name: string, args: any, _professionalId: string) {
  if (name === "suggest_price") return executeSuggestPrice(args);
  return { error: `Tool ${name} não encontrada.` };
}

export const pricingAgent: BaseAgent = {
  type: "pricing",
  buildContext: buildPricingContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent({ type: "pricing", systemPrompt: PRICING_PROMPT, tools: PRICING_TOOLS, toolExecutor, contextToString }, message, context, session, history, onChunk),
};
