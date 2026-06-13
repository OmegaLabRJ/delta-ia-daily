/**
 * Executor genérico de agente — lógica compartilhada de chamada ao Gemini com tools.
 */
import { callGeminiProxy, resetRateLimit, type GeminiContent } from "@/lib/ai";
import type { AgentResponse, SessionContext, AgentType } from "../types";

interface AgentExecutorConfig {
  type: AgentType;
  systemPrompt: string;
  tools: any[];
  toolExecutor: (name: string, args: any, professionalId: string) => Promise<any>;
  contextToString: (context: Record<string, any>) => string;
}

export async function executeAgent(
  config: AgentExecutorConfig,
  message: string,
  context: Record<string, any>,
  session: SessionContext,
  history: { role: string; content: string }[],
  onChunk?: (text: string) => void,
): Promise<AgentResponse> {
  const contextStr = config.contextToString(context);
  let fullPrompt = `${config.systemPrompt}\n\n[CONTEXTO]\n${contextStr}`;

  // Adiciona a regra de idioma universal
  fullPrompt += `\n\n[REGRA DE IDIOMA]\nResponda SEMPRE no mesmo idioma que o usuário usou na mensagem mais recente (ex: se a mensagem estiver em inglês, responda em inglês). Apenas mude de idioma se o usuário mudar.`;

  // Montar histórico Gemini (últimas 5 trocas relevantes)
  const geminiHistory: GeminiContent[] = history.slice(-10).map(h => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));
  geminiHistory.push({ role: "user", parts: [{ text: message }] });

  // Incluir info da última ação se houver handoff
  if (session.lastActionResult) {
    const handoffNote = `[A ação anterior foi: ${session.lastActionResult.tool} → ${session.lastActionResult.summary}]`;
    fullPrompt += `\n${handoffNote}`;
  }

  // Chamada ao Gemini
  let data = await callGeminiProxy({
    system_instruction: { parts: [{ text: fullPrompt }] },
    contents: geminiHistory,
    tools: config.tools.length > 0 ? config.tools : undefined,
    generationConfig: { temperature: 0.68, maxOutputTokens: 2048 },
  });

  let parts = data?.candidates?.[0]?.content?.parts || [];
  let actionResult: any = null;

  // Processar tool call se houver
  const functionCallPart = parts.find((p: any) => p.functionCall);

  if (functionCallPart) {
    const { name, args } = functionCallPart.functionCall;
    actionResult = await config.toolExecutor(name, args, (context as any).professionalId);

    // Enviar resultado da tool de volta ao Gemini
    const followUp: GeminiContent[] = [
      ...geminiHistory,
      { role: "model", parts: [{ functionCall: { name, args } }] },
      { role: "function", parts: [{ functionResponse: { name, response: actionResult } }] },
    ];

    resetRateLimit();
    data = await callGeminiProxy(
      {
        system_instruction: { parts: [{ text: fullPrompt }] },
        contents: followUp,
        tools: config.tools.length > 0 ? config.tools : undefined,
        generationConfig: { temperature: 0.68, maxOutputTokens: 2048 },
      },
      onChunk,
    );
  }

  const responseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    (actionResult ? "Ação realizada com sucesso! ✅" : "Desculpa, não consegui pensar em nada 😅");

  // Montar sessionUpdate
  const sessionUpdate: Partial<SessionContext> = {
    lastAgentUsed: config.type,
  };

  if (actionResult?.success && actionResult?.action_type) {
    sessionUpdate.lastActionResult = {
      tool: functionCallPart?.functionCall?.name || "",
      summary: actionResult.message || actionResult.action_type,
      data: actionResult,
    };
  }

  return {
    text: responseText,
    actionData: actionResult,
    sessionUpdate,
  };
}
