import type { BaseAgent } from "../types";
import { buildArtDirectorContext } from "../contexts/art-director.context";
import type { ArtDirectorContextData } from "../contexts/art-director.context";
import { ART_DIRECTOR_PROMPT, ART_DIRECTOR_TOOLS } from "../prompts/art-director.prompt";
import { executeAgent } from "./base.agent";
import { executeGenerateImage } from "../tools/art-director.tools";

function contextToString(ctx: ArtDirectorContextData): string {
  const servicesStr =
    ctx.services.length > 0
      ? ctx.services.map((s) => `${s.name} (R$${s.price})`).join(", ")
      : "Nenhum serviço cadastrado";

  return `PROFISSIONAL: ${ctx.professionalName}
ESPECIALIDADE: ${ctx.specialty}
LOCALIZAÇÃO: ${ctx.location}
SERVIÇOS: ${servicesStr}`;
}

async function toolExecutor(name: string, args: any, professionalId: string) {
  switch (name) {
    case "generate_image":
      return executeGenerateImage(professionalId, args);
    default:
      return { error: `Tool ${name} não encontrada no Art Director.` };
  }
}

export const artDirectorAgent: BaseAgent = {
  type: "art-director",
  buildContext: buildArtDirectorContext,
  execute: (message, context, session, history, onChunk) =>
    executeAgent(
      {
        type: "art-director",
        systemPrompt: ART_DIRECTOR_PROMPT,
        tools: ART_DIRECTOR_TOOLS,
        toolExecutor,
        contextToString,
      },
      message,
      context,
      session,
      history,
      onChunk,
    ),
};
