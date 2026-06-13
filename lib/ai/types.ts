/**
 * Types compartilhados da arquitetura de subagentes da Consultora Daily.
 */

// ─── Agent Types ─────────────────────────────────────────────────────────────

export type AgentType =
  | "agenda"
  | "marketing"
  | "analytics"
  | "pricing"
  | "onboarding"
  | "strategy"
  | "crm"
  | "finance";

// ─── Session Context ─────────────────────────────────────────────────────────

export interface SessionContext {
  lastAgentUsed: AgentType | null;
  lastActionResult?: {
    tool: string;
    summary: string;
    data?: Record<string, any>;
  };
  currentTopic?: string;
  isOnboarding: boolean;
}

export function createEmptySession(): SessionContext {
  return {
    lastAgentUsed: null,
    isOnboarding: false,
  };
}

// ─── Agent Response ──────────────────────────────────────────────────────────

export interface AgentResponse {
  text: string;
  actionData?: any;
  sessionUpdate: Partial<SessionContext>;
}

// ─── Base Agent Interface ────────────────────────────────────────────────────

export interface BaseAgent {
  readonly type: AgentType;
  buildContext(professionalId: string): Promise<Record<string, any>>;
  execute(
    message: string,
    context: Record<string, any>,
    session: SessionContext,
    history: { role: string; content: string }[],
    onChunk?: (text: string) => void,
  ): Promise<AgentResponse>;
}

// ─── Context Interfaces ──────────────────────────────────────────────────────

export interface AgendaContextData {
  professionalId: string;
  professionalName: string;
  services: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  }[];
  todayAppointments: {
    id: string;
    client_name: string;
    service_name: string;
    date: string;
    time: string;
    status: string;
  }[];
  schedule: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_min: number;
    break_between_min: number;
    auto_approve: boolean;
  }[];
  lastAction?: SessionContext["lastActionResult"];
}

export interface PricingContextData {
  professionalId: string;
  location: string;
  specialty: string;
  currentPrices: {
    name: string;
    price: number;
    item_type: "product" | "service";
  }[];
}

export interface MarketingContextData {
  professionalId: string;
  professionalName: string;
  specialty: string;
  location: string;
  topPosts: {
    description: string;
    likes_count: number;
    category: string;
  }[];
  services: {
    name: string;
    price: number;
  }[];
  memories: {
    type: string;
    content: string;
  }[];
  upcomingEvents: string[];
  lastAction?: SessionContext["lastActionResult"];
}

export interface AnalyticsContextData {
  professionalId: string;
  itemMetrics: {
    total_views: number;
    total_whatsapp_clicks: number;
    items_count: number;
    topItems: {
      name: string;
      views: number;
      clicks: number;
    }[];
  };
  profileStats: {
    followers_count: number;
    posts_count: number;
    avg_rating: number;
    total_reviews: number;
  };
  appointmentStats: {
    total_confirmed: number;
    total_completed: number;
    total_cancelled: number;
  };
}

export interface OnboardingContextData {
  professionalId: string;
  professionalName: string;
  profile: {
    has_specialty: boolean;
    has_bio: boolean;
    has_location: boolean;
    has_business_hours: boolean;
    has_whatsapp: boolean;
    has_offered_services: boolean;
    has_shop_items: boolean;
  };
  missingData: {
    field: string;
    priority: number;
    suggestedQuestion: string;
  }[];
  existingMemories: string[];
}

export interface StrategyContextData {
  professionalId: string;
  profile: {
    display_name: string;
    business_name: string;
    specialty: string;
    bio: string;
    location: string;
    business_hours: string;
    whatsapp: string;
    followers_count: number;
    posts_count: number;
    avg_rating: number;
  };
  services: {
    name: string;
    price: number;
    item_type: string;
  }[];
  memories: {
    type: string;
    content: string;
  }[];
  upcomingEvents: string[];
}

export interface CRMContextData {
  professionalId: string;
  professionalName: string;
  clients: {
    id: string;
    name: string;
    visit_count: number;
    last_visit_date: string | null;
    last_service_name: string | null;
    preferences: string | null;
    days_since_last_visit: number;
  }[];
  segments: {
    active: number;
    at_risk: number;
    inactive: number;
    new_clients: number;
  };
}

export interface FinanceContextData {
  professionalId: string;
  services: {
    name: string;
    price: number;
  }[];
  completedAppointments: {
    service_name: string;
    service_price: number;
    date: string;
  }[];
  metrics: {
    total_revenue_30d: number;
    avg_ticket: number;
    appointments_30d: number;
    projected_monthly: number;
  };
  revenueGoal?: {
    monthly_target: number;
    current_progress: number;
    percentage: number;
  };
}

// ─── Router Context ──────────────────────────────────────────────────────────

export interface RouterContextData {
  professional: {
    name: string;
    profile_type: string;
    specialty: string;
    isProfileComplete: boolean;
  };
  recentHistory: {
    role: "user" | "assistant";
    content: string;
    agentUsed?: AgentType;
  }[];
  session: SessionContext;
}
