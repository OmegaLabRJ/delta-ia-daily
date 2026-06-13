/**
 * SessionContext — Memória de sessão efêmera para handoff inter-agente.
 *
 * Vive no useRef do hook, resetado quando a conversa é limpa.
 * NÃO persiste no banco — é efêmera por design.
 */
import { SessionContext, AgentType, createEmptySession } from "./types";

export class SessionManager {
  private session: SessionContext;

  constructor() {
    this.session = createEmptySession();
  }

  get(): SessionContext {
    return { ...this.session };
  }

  updateAfterAgent(
    agentType: AgentType,
    actionResult?: { tool: string; summary: string; data?: Record<string, any> },
    topic?: string,
  ): void {
    this.session.lastAgentUsed = agentType;
    if (actionResult) {
      this.session.lastActionResult = actionResult;
    }
    if (topic !== undefined) {
      this.session.currentTopic = topic;
    }
  }

  setOnboarding(value: boolean): void {
    this.session.isOnboarding = value;
  }

  clearTopic(): void {
    this.session.currentTopic = undefined;
    this.session.lastActionResult = undefined;
  }

  reset(): void {
    this.session = createEmptySession();
  }
}
