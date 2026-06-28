/**
 * Structured Logger — Observability Core
 * 
 * Todas as regras de monitoramento centralizadas:
 * - Request ID único por operação
 * - Logs JSON estruturados (nunca texto livre)
 * - Stack trace + contexto em erros
 * - Métricas de performance (latência)
 * - Cache hit/miss tracking
 * - Fallback tracking (Groq → Gemini)
 * - Token usage por agent
 * - Rate limit monitoring
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "debug" | "metric";

export type LogCategory =
  | "ai.request"
  | "ai.response"
  | "ai.error"
  | "ai.fallback"
  | "ai.token_usage"
  | "ai.rate_limit"
  | "cache.hit"
  | "cache.miss"
  | "cache.invalidate"
  | "db.query"
  | "db.rpc"
  | "db.error"
  | "booking.attempt"
  | "booking.success"
  | "booking.failure"
  | "performance.latency"
  | "session.replay"
  | "health.check";

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  request_id: string;
  message: string;
  // Context
  user_id?: string;
  agent?: string;
  provider?: string;
  // Performance
  latency_ms?: number;
  token_count?: number;
  // Cache
  cache_key?: string;
  cache_ttl_ms?: number;
  // Error
  error_name?: string;
  error_message?: string;
  stack_trace?: string;
  // Extra data
  metadata?: Record<string, any>;
}

// ─── Request ID Generator ─────────────────────────────────────────────────────

let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `req_${timestamp}_${random}_${requestCounter}`;
}

// ─── Metrics Accumulator ──────────────────────────────────────────────────────

interface MetricsState {
  // Fallback tracking
  groq_calls: number;
  gemini_calls: number;
  groq_failures: number;
  fallback_to_gemini: number;
  // Cache tracking
  cache_hits: number;
  cache_misses: number;
  cache_invalidations: number;
  // Token usage per agent
  token_usage_by_agent: Record<string, number>;
  // Latency tracking
  avg_latency_by_provider: Record<string, { total: number; count: number }>;
  // Rate limit hits
  rate_limit_hits: number;
  // Booking metrics
  booking_attempts: number;
  booking_successes: number;
  booking_failures: number;
  // Session start
  session_start: number;
}

const metrics: MetricsState = {
  groq_calls: 0,
  gemini_calls: 0,
  groq_failures: 0,
  fallback_to_gemini: 0,
  cache_hits: 0,
  cache_misses: 0,
  cache_invalidations: 0,
  token_usage_by_agent: {},
  avg_latency_by_provider: {},
  rate_limit_hits: 0,
  booking_attempts: 0,
  booking_successes: 0,
  booking_failures: 0,
  session_start: Date.now(),
};

// ─── Core Logger ──────────────────────────────────────────────────────────────

function emitLog(log: StructuredLog): void {
  // Em produção, isso pode ser enviado para um serviço de logging
  // Por agora, usa console com JSON estruturado
  const output = JSON.stringify(log);

  switch (log.level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  /**
   * Log de requisição AI (início)
   */
  aiRequest(requestId: string, opts: {
    userId?: string;
    agent?: string;
    provider: string;
    metadata?: Record<string, any>;
  }): void {
    if (opts.provider === "groq-chat") metrics.groq_calls++;
    if (opts.provider === "gemini-chat") metrics.gemini_calls++;

    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      category: "ai.request",
      request_id: requestId,
      message: `AI request to ${opts.provider}`,
      user_id: opts.userId,
      agent: opts.agent,
      provider: opts.provider,
      metadata: opts.metadata,
    });
  },

  /**
   * Log de resposta AI (sucesso)
   */
  aiResponse(requestId: string, opts: {
    provider: string;
    latencyMs: number;
    tokenCount?: number;
    agent?: string;
    userId?: string;
    hasFunctionCall?: boolean;
  }): void {
    // Track latency per provider
    if (!metrics.avg_latency_by_provider[opts.provider]) {
      metrics.avg_latency_by_provider[opts.provider] = { total: 0, count: 0 };
    }
    metrics.avg_latency_by_provider[opts.provider].total += opts.latencyMs;
    metrics.avg_latency_by_provider[opts.provider].count++;

    // Track token usage per agent
    if (opts.agent && opts.tokenCount) {
      metrics.token_usage_by_agent[opts.agent] =
        (metrics.token_usage_by_agent[opts.agent] || 0) + opts.tokenCount;
    }

    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      category: "ai.response",
      request_id: requestId,
      message: `AI response from ${opts.provider} in ${opts.latencyMs}ms`,
      provider: opts.provider,
      latency_ms: opts.latencyMs,
      token_count: opts.tokenCount,
      agent: opts.agent,
      user_id: opts.userId,
      metadata: { has_function_call: opts.hasFunctionCall },
    });
  },

  /**
   * Log de erro AI (com stack trace completo)
   */
  aiError(requestId: string, error: unknown, opts: {
    provider: string;
    agent?: string;
    userId?: string;
    context?: Record<string, any>;
  }): void {
    const err = error instanceof Error ? error : new Error(String(error));

    emitLog({
      timestamp: new Date().toISOString(),
      level: "error",
      category: "ai.error",
      request_id: requestId,
      message: `AI error on ${opts.provider}: ${err.message}`,
      provider: opts.provider,
      agent: opts.agent,
      user_id: opts.userId,
      error_name: err.name,
      error_message: err.message,
      stack_trace: err.stack,
      metadata: opts.context,
    });
  },

  /**
   * Log de fallback (Groq → Gemini)
   */
  aiFallback(requestId: string, opts: {
    fromProvider: string;
    toProvider: string;
    reason: string;
    userId?: string;
  }): void {
    metrics.groq_failures++;
    metrics.fallback_to_gemini++;

    emitLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      category: "ai.fallback",
      request_id: requestId,
      message: `Fallback: ${opts.fromProvider} → ${opts.toProvider} (${opts.reason})`,
      provider: opts.toProvider,
      user_id: opts.userId,
      metadata: {
        from_provider: opts.fromProvider,
        to_provider: opts.toProvider,
        reason: opts.reason,
        total_fallbacks: metrics.fallback_to_gemini,
      },
    });
  },

  /**
   * Cache hit/miss tracking
   */
  cacheHit(requestId: string, cacheKey: string, ttlMs?: number): void {
    metrics.cache_hits++;
    emitLog({
      timestamp: new Date().toISOString(),
      level: "debug",
      category: "cache.hit",
      request_id: requestId,
      message: `Cache HIT: ${cacheKey}`,
      cache_key: cacheKey,
      cache_ttl_ms: ttlMs,
      metadata: { total_hits: metrics.cache_hits, total_misses: metrics.cache_misses },
    });
  },

  cacheMiss(requestId: string, cacheKey: string): void {
    metrics.cache_misses++;
    emitLog({
      timestamp: new Date().toISOString(),
      level: "debug",
      category: "cache.miss",
      request_id: requestId,
      message: `Cache MISS: ${cacheKey}`,
      cache_key: cacheKey,
      metadata: { total_hits: metrics.cache_hits, total_misses: metrics.cache_misses },
    });
  },

  cacheInvalidate(requestId: string, cacheKey: string, reason: string): void {
    metrics.cache_invalidations++;
    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      category: "cache.invalidate",
      request_id: requestId,
      message: `Cache INVALIDATED: ${cacheKey} (${reason})`,
      cache_key: cacheKey,
      metadata: { reason },
    });
  },

  /**
   * Database query/RPC timing
   */
  dbQuery(requestId: string, opts: {
    operation: string;
    table?: string;
    latencyMs: number;
    success: boolean;
    error?: string;
    userId?: string;
  }): void {
    const level = opts.success ? "info" : "error";
    const category = opts.success ? "db.rpc" : "db.error";

    emitLog({
      timestamp: new Date().toISOString(),
      level,
      category,
      request_id: requestId,
      message: `DB ${opts.operation}${opts.table ? ` on ${opts.table}` : ""} in ${opts.latencyMs}ms`,
      latency_ms: opts.latencyMs,
      user_id: opts.userId,
      metadata: {
        operation: opts.operation,
        table: opts.table,
        success: opts.success,
        ...(opts.error && { error: opts.error }),
      },
    });
  },

  /**
   * Booking tracking
   */
  bookingAttempt(requestId: string, opts: {
    serviceId: string;
    date: string;
    time: string;
    userId?: string;
  }): void {
    metrics.booking_attempts++;
    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      category: "booking.attempt",
      request_id: requestId,
      message: `Booking attempt: ${opts.date} ${opts.time}`,
      user_id: opts.userId,
      metadata: { service_id: opts.serviceId, date: opts.date, time: opts.time },
    });
  },

  bookingResult(requestId: string, success: boolean, opts: {
    serviceId: string;
    date: string;
    time: string;
    userId?: string;
    autoApproved?: boolean;
    error?: string;
  }): void {
    if (success) metrics.booking_successes++;
    else metrics.booking_failures++;

    emitLog({
      timestamp: new Date().toISOString(),
      level: success ? "info" : "warn",
      category: success ? "booking.success" : "booking.failure",
      request_id: requestId,
      message: success
        ? `Booking SUCCESS: ${opts.date} ${opts.time} (auto: ${opts.autoApproved})`
        : `Booking FAILED: ${opts.date} ${opts.time} — ${opts.error}`,
      user_id: opts.userId,
      metadata: {
        service_id: opts.serviceId,
        date: opts.date,
        time: opts.time,
        auto_approved: opts.autoApproved,
        success_rate: metrics.booking_attempts > 0
          ? `${((metrics.booking_successes / metrics.booking_attempts) * 100).toFixed(1)}%`
          : "N/A",
      },
    });
  },

  /**
   * Rate limit monitoring
   */
  rateLimitHit(requestId: string, opts: {
    userId: string;
    currentCount: number;
    maxAllowed: number;
    plan: string;
  }): void {
    metrics.rate_limit_hits++;
    emitLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      category: "ai.rate_limit",
      request_id: requestId,
      message: `Rate limit HIT: ${opts.currentCount}/${opts.maxAllowed} (plan: ${opts.plan})`,
      user_id: opts.userId,
      metadata: {
        current_count: opts.currentCount,
        max_allowed: opts.maxAllowed,
        plan: opts.plan,
        total_rate_limit_hits: metrics.rate_limit_hits,
      },
    });
  },

  /**
   * Token usage tracking per agent
   */
  tokenUsage(requestId: string, opts: {
    agent: string;
    tokenCount: number;
    provider: string;
    userId?: string;
  }): void {
    metrics.token_usage_by_agent[opts.agent] =
      (metrics.token_usage_by_agent[opts.agent] || 0) + opts.tokenCount;

    emitLog({
      timestamp: new Date().toISOString(),
      level: "metric",
      category: "ai.token_usage",
      request_id: requestId,
      message: `Token usage: ${opts.agent} used ${opts.tokenCount} tokens`,
      agent: opts.agent,
      provider: opts.provider,
      token_count: opts.tokenCount,
      user_id: opts.userId,
      metadata: {
        session_total: metrics.token_usage_by_agent[opts.agent],
        all_agents: { ...metrics.token_usage_by_agent },
      },
    });
  },

  /**
   * Latência genérica
   */
  latency(requestId: string, operation: string, latencyMs: number, metadata?: Record<string, any>): void {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "metric",
      category: "performance.latency",
      request_id: requestId,
      message: `${operation}: ${latencyMs}ms`,
      latency_ms: latencyMs,
      metadata,
    });
  },

  /**
   * Retorna snapshot das métricas acumuladas da sessão
   */
  getMetrics(): MetricsState & { computed: Record<string, any> } {
    const sessionDurationMs = Date.now() - metrics.session_start;

    const avgLatencies: Record<string, number> = {};
    for (const [provider, data] of Object.entries(metrics.avg_latency_by_provider)) {
      avgLatencies[provider] = data.count > 0 ? Math.round(data.total / data.count) : 0;
    }

    return {
      ...metrics,
      computed: {
        session_duration_seconds: Math.round(sessionDurationMs / 1000),
        cache_hit_rate: metrics.cache_hits + metrics.cache_misses > 0
          ? `${((metrics.cache_hits / (metrics.cache_hits + metrics.cache_misses)) * 100).toFixed(1)}%`
          : "N/A",
        groq_success_rate: metrics.groq_calls > 0
          ? `${(((metrics.groq_calls - metrics.groq_failures) / metrics.groq_calls) * 100).toFixed(1)}%`
          : "N/A",
        booking_success_rate: metrics.booking_attempts > 0
          ? `${((metrics.booking_successes / metrics.booking_attempts) * 100).toFixed(1)}%`
          : "N/A",
        avg_latency_by_provider: avgLatencies,
        top_token_consumer: Object.entries(metrics.token_usage_by_agent)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || "none",
      },
    };
  },

  /**
   * Reseta métricas (útil entre sessões)
   */
  resetMetrics(): void {
    metrics.groq_calls = 0;
    metrics.gemini_calls = 0;
    metrics.groq_failures = 0;
    metrics.fallback_to_gemini = 0;
    metrics.cache_hits = 0;
    metrics.cache_misses = 0;
    metrics.cache_invalidations = 0;
    metrics.token_usage_by_agent = {};
    metrics.avg_latency_by_provider = {};
    metrics.rate_limit_hits = 0;
    metrics.booking_attempts = 0;
    metrics.booking_successes = 0;
    metrics.booking_failures = 0;
    metrics.session_start = Date.now();
  },
};
