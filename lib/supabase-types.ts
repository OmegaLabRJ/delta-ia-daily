export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileType = 'consumer' | 'professional' | 'store' | 'creator';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_type: ProfileType;
  verified: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  website: string | null;
  whatsapp: string | null;
  expo_push_token: string | null;
  birth_date: string | null;
  age_verified: boolean;
  guardian_consent: boolean | null;
  guardian_email: string | null;
  created_at: string;
  // ✅ Campos da loja profissional
  cover_url: string | null;
  business_name: string | null;
  business_hours: string | null;
  document: string | null;
  document_type: "cpf" | "cnpj" | null;
  specialty: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  pinned_posts?: string[];
}

export interface Post {
  id: string;
  user_id: string;
  category: string;
  title?: string | null;
  description: string;
  media_url: string | null;
  thumbnail_url: string | null;
  media_type: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  location: string | null;
  is_private: boolean;
  is_ad: boolean;
  product_id: string | null;
  profiles?: Profile | null;
  _score?: number;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  user_id: string;
  profiles?: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface MarketplaceItem {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  item_type: "product" | "service";
  image_url: string | null;
  images: string[] | null;
  is_active: boolean;
  duration_minutes: number | null;
  available: boolean;
  created_at: string;
  profiles?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  actor_id: string | null;
  target_id: string | null;
  target_type: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count?: number;
  other_user?: Profile;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface CommunityMessage {
  id: string;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface Appointment {
  id: string;
  client_id: string;
  client_profile_id: string | null;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  reviewer_id: string;
  item_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export type AppRole = "admin" | "super_admin" | "moderator" | "finance" | "marketing" | "support";

// ─── Moderation & Safety Types ───────────────────────────────────────────────

export interface ModerationRule {
  id: string;
  rule_type: "keyword_block" | "keyword_flag" | "pattern" | "rate_limit";
  value: string;
  severity: "critical" | "high" | "medium" | "mental_health";
  surfaces: string[] | null;
  applies_to_minors: boolean;
  active: boolean;
  created_at: string;
}

export interface ContentFlag {
  id: string;
  content: string;
  surface: string;
  flag_source: "rule" | "user_report";
  severity: string | null;
  rule_id: string | null;
  user_id: string | null;
  target_id: string | null;
  user_confirmed: boolean;
  reviewed: boolean;
  action_taken: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

export interface UserBehaviorScore {
  id: string;
  user_id: string;
  critical_attempts: number;
  high_attempts: number;
  medium_flags: number;
  risk_score: number;
  status: "ok" | "monitored" | "suspended" | "banned";
  suspended_until: string | null;
  suspension_reason: string | null;
  last_incident_at: string | null;
  updated_at: string;
}

// ─── Chat Groups Types ──────────────────────────────────────────────────────

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  creator_id: string;
  is_private: boolean;
  max_members: number;
  minimum_age: number;
  member_count: number;
  created_at: string;
  creator?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

export interface ChatGroupMember {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

export interface SearchResult {
  type: "profile" | "post" | "product";
  id: string;
  username?: string;
  title: string;
  subtitle: string;
  image: string | null;
}

// ─── Agentic Commerce Types ──────────────────────────────────────────────────

export interface Schedule {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  break_between_min: number;
  is_active: boolean;
  auto_approve: boolean;
  created_at: string;
}

export interface AIAction {
  id: string;
  user_id: string;
  agent_type: string;
  action_type: string;
  input_context: Record<string, unknown> | null;
  output_response: string | null;
  created_at: string;
}

export interface AIChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AutomationPreferences {
  id: string;
  professional_id: string;
  auto_reminders: boolean;
  booking_fee_enabled: boolean;
  booking_fee_amount: number;
  whatsapp_notifications: boolean;
  created_at: string;
}

export interface ClientProfile {
  id: string;
  professional_id: string;
  client_id: string;
  visit_count: number;
  last_service_name: string | null;
  last_visit_date: string | null;
  preferences: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageModel {
  id: string;
  consumer_id: string;
  professional_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface RevenueGoals {
  id: string;
  professional_id: string;
  month: string;
  target_amount: number;
  current_amount: number;
  created_at: string;
}

// ─── Monetization & Usage Types ──────────────────────────────────────────────

export interface UserSubscription {
  id: string;
  user_id: string | null;
  plan_id: string | null;          // string | null no banco (era union restrita)
  status: string;                  // string no banco (era union restrita)
  started_at: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
  payment_provider: string | null;
  external_subscription_id: string | null;
  created_at: string | null;
}

export interface UserAiUsage {
  id: string;
  user_id: string | null;
  images_generated: number | null;
  requests_count: number | null;
  period_start: string | null;
  updated_at: string | null;
}

// ─── Analytics & Creator Ecosystem Types ─────────────────────────────────────

export interface PostView {
  id: string;
  post_id: string;
  viewer_id: string | null;
  viewed_at: string;
  watch_seconds: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: 'holiday' | 'beauty' | 'cultural' | 'commercial';
  category: string | null;
  suggested_content: string;
  icon: string;
}

export interface CreatorPartnership {
  id: string;
  professional_id: string;
  creator_id: string | null;
  title: string;
  description: string | null;
  budget_type: "paid" | "trade";
  status: "open" | "applied" | "closed";
  location: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface Repost {
  id: string;
  original_post_id: string;
  original_creator_id: string;
  reposted_by_id: string;
  reposted_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  is_private: boolean;
  member_count: number;
  created_at: string;
}

export interface ChatGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface CommunityMessage {
  id: string;
  category: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessageModel {
  id: string;
  consumer_id: string;
  professional_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  target_type: string | null;
  target_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: any; };
      posts: { Row: Post; Insert: Partial<Post>; Update: Partial<Post>; Relationships: any; };
      comments: { Row: Comment; Insert: Partial<Comment>; Update: Partial<Comment>; Relationships: any; };
      marketplace_items: { Row: MarketplaceItem; Insert: Partial<MarketplaceItem>; Update: Partial<MarketplaceItem>; Relationships: any; };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification>; Relationships: any; };
      conversations: { Row: Conversation; Insert: Partial<Conversation>; Update: Partial<Conversation>; Relationships: any; };
      direct_messages: { Row: DirectMessage; Insert: Partial<DirectMessage>; Update: Partial<DirectMessage>; Relationships: any; };
      community_messages: { Row: CommunityMessage; Insert: Partial<CommunityMessage>; Update: Partial<CommunityMessage>; Relationships: any; };
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment>; Relationships: any; };
      reviews: { Row: Review; Insert: Partial<Review>; Update: Partial<Review>; Relationships: any; };
      moderation_rules: { Row: ModerationRule; Insert: Partial<ModerationRule>; Update: Partial<ModerationRule>; Relationships: any; };
      content_flags: { Row: ContentFlag; Insert: Partial<ContentFlag>; Update: Partial<ContentFlag>; Relationships: any; };
      user_behavior_scores: { Row: UserBehaviorScore; Insert: Partial<UserBehaviorScore>; Update: Partial<UserBehaviorScore>; Relationships: any; };
      chat_groups: { Row: ChatGroup; Insert: Partial<ChatGroup>; Update: Partial<ChatGroup>; Relationships: any; };
      chat_group_members: { Row: ChatGroupMember; Insert: Partial<ChatGroupMember>; Update: Partial<ChatGroupMember>; Relationships: any; };
      group_messages: { Row: GroupMessage; Insert: Partial<GroupMessage>; Update: Partial<GroupMessage>; Relationships: any; };
      schedules: { Row: Schedule; Insert: Partial<Schedule>; Update: Partial<Schedule>; Relationships: any; };
      ai_actions: { Row: AIAction; Insert: Partial<AIAction>; Update: Partial<AIAction>; Relationships: any; };
      ai_chat_messages: { Row: AIChatMessage; Insert: Partial<AIChatMessage>; Update: Partial<AIChatMessage>; Relationships: any; };
      automation_preferences: { Row: AutomationPreferences; Insert: Partial<AutomationPreferences>; Update: Partial<AutomationPreferences>; Relationships: any; };
      client_profiles: { Row: ClientProfile; Insert: Partial<ClientProfile>; Update: Partial<ClientProfile>; Relationships: any; };
      chat_messages: { Row: ChatMessageModel; Insert: Partial<ChatMessageModel>; Update: Partial<ChatMessageModel>; Relationships: any; };
      revenue_goals: { Row: RevenueGoals; Insert: Partial<RevenueGoals>; Update: Partial<RevenueGoals>; Relationships: any; };
      user_subscriptions: { Row: UserSubscription; Insert: Partial<UserSubscription>; Update: Partial<UserSubscription>; Relationships: any; };
      user_ai_usage: { Row: UserAiUsage; Insert: Partial<UserAiUsage>; Update: Partial<UserAiUsage>; Relationships: any; };
      post_views: { Row: PostView; Insert: Partial<PostView>; Update: Partial<PostView>; Relationships: any; };
      calendar_events: { Row: CalendarEvent; Insert: Partial<CalendarEvent>; Update: Partial<CalendarEvent>; Relationships: any; };
      creator_partnerships: { Row: CreatorPartnership; Insert: Partial<CreatorPartnership>; Update: Partial<CreatorPartnership>; Relationships: any; };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
