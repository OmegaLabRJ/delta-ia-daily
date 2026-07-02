export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_feedbacks: {
        Row: {
          action_type: string
          created_at: string | null
          feedback: string
          id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          feedback: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          feedback?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_feedbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          action_type: string
          agent_type: string
          created_at: string | null
          id: string
          input_context: Json | null
          output_response: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          agent_type?: string
          created_at?: string | null
          id?: string
          input_context?: Json | null
          output_response?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          agent_type?: string
          created_at?: string | null
          id?: string
          input_context?: Json | null
          output_response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_history: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          latency_ms: number | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          latency_ms?: number | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          client_id: string
          client_profile_id: string | null
          created_at: string
          id: string
          notes: string | null
          service_id: string
          status: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_id: string
          client_profile_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          service_id: string
          status?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_id?: string
          client_profile_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          service_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_preferences: {
        Row: {
          auto_reminders: boolean | null
          booking_fee_amount: number | null
          booking_fee_enabled: boolean | null
          created_at: string | null
          id: string
          professional_id: string
          whatsapp_notifications: boolean | null
        }
        Insert: {
          auto_reminders?: boolean | null
          booking_fee_amount?: number | null
          booking_fee_enabled?: boolean | null
          created_at?: string | null
          id?: string
          professional_id: string
          whatsapp_notifications?: boolean | null
        }
        Update: {
          auto_reminders?: boolean | null
          booking_fee_amount?: number | null
          booking_fee_enabled?: boolean | null
          created_at?: string | null
          id?: string
          professional_id?: string
          whatsapp_notifications?: boolean | null
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          id: string
          word: string
        }
        Insert: {
          id?: string
          word: string
        }
        Update: {
          id?: string
          word?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string | null
          blocker_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id?: string | null
          blocker_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string | null
          blocker_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          category: string | null
          created_at: string | null
          event_date: string
          event_type: string
          icon: string | null
          id: string
          is_active: boolean | null
          suggested_content: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          event_date: string
          event_type: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          suggested_content: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          event_date?: string
          event_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          suggested_content?: string
          title?: string
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          group_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          is_private: boolean | null
          max_members: number | null
          member_count: number | null
          minimum_age: number | null
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_private?: boolean | null
          max_members?: number | null
          member_count?: number | null
          minimum_age?: number | null
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_private?: boolean | null
          max_members?: number | null
          member_count?: number | null
          minimum_age?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          consumer_id: string | null
          content: string
          created_at: string | null
          id: string
          professional_id: string | null
          role: string
        }
        Insert: {
          consumer_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          professional_id?: string | null
          role: string
        }
        Update: {
          consumer_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          professional_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          last_service_name: string | null
          last_visit_date: string | null
          notes: string | null
          preferences: string | null
          professional_id: string | null
          updated_at: string | null
          visit_count: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_service_name?: string | null
          last_visit_date?: string | null
          notes?: string | null
          preferences?: string | null
          professional_id?: string | null
          updated_at?: string | null
          visit_count?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_service_name?: string | null
          last_visit_date?: string | null
          notes?: string | null
          preferences?: string | null
          professional_id?: string | null
          updated_at?: string | null
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profiles_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          ai_reasoning: string | null
          caption: string | null
          created_at: string | null
          hashtags: string[] | null
          id: string
          image_prompt: string | null
          image_url: string | null
          post_type: string | null
          professional_id: string | null
          scheduled_date: string
          service_highlight: string | null
          status: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          caption?: string | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          post_type?: string | null
          professional_id?: string | null
          scheduled_date: string
          service_highlight?: string | null
          status?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          caption?: string | null
          created_at?: string | null
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          post_type?: string | null
          professional_id?: string | null
          scheduled_date?: string
          service_highlight?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_flags: {
        Row: {
          action_taken: string | null
          content: string
          created_at: string | null
          flag_source: string
          id: string
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          rule_id: string | null
          severity: string | null
          surface: string
          target_id: string | null
          user_confirmed: boolean | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          content: string
          created_at?: string | null
          flag_source: string
          id?: string
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id?: string | null
          severity?: string | null
          surface: string
          target_id?: string | null
          user_confirmed?: boolean | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          content?: string
          created_at?: string | null
          flag_source?: string
          id?: string
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id?: string | null
          severity?: string | null
          surface?: string
          target_id?: string | null
          user_confirmed?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_flags_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "moderation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          followup_sent: boolean | null
          id: string
          last_message: string | null
          last_message_at: string | null
          participant_1: string
          participant_2: string
          status: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          followup_sent?: boolean | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_1: string
          participant_2: string
          status?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          followup_sent?: boolean | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_1?: string
          participant_2?: string
          status?: string | null
          type?: string | null
        }
        Relationships: []
      }
      creator_memory: {
        Row: {
          confidence: number | null
          content: string
          created_at: string | null
          creator_id: string | null
          id: string
          memory_type: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          content: string
          created_at?: string | null
          creator_id?: string | null
          id?: string
          memory_type: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          content?: string
          created_at?: string | null
          creator_id?: string | null
          id?: string
          memory_type?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_memory_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_partnerships: {
        Row: {
          budget_type: string
          category: string | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          location: string | null
          professional_id: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          budget_type: string
          category?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          professional_id: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          budget_type?: string
          category?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          professional_id?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          group_id: string | null
          id: string
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_feedback: {
        Row: {
          confidence: number
          correct: boolean
          created_at: string
          id: string
          predicted_intent: string
          text: string
          user_id: string | null
        }
        Insert: {
          confidence: number
          correct: boolean
          created_at?: string
          id?: string
          predicted_intent: string
          text: string
          user_id?: string | null
        }
        Update: {
          confidence?: number
          correct?: boolean
          created_at?: string
          id?: string
          predicted_intent?: string
          text?: string
          user_id?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_items: {
        Row: {
          availability: Json | null
          available_days: number[] | null
          available_times: string[] | null
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          item_type: Database["public"]["Enums"]["marketplace_item_type"]
          name: string
          price: number
          seller_id: string
          views_count: number | null
          whatsapp_clicks: number | null
        }
        Insert: {
          availability?: Json | null
          available_days?: number[] | null
          available_times?: string[] | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          item_type?: Database["public"]["Enums"]["marketplace_item_type"]
          name: string
          price: number
          seller_id: string
          views_count?: number | null
          whatsapp_clicks?: number | null
        }
        Update: {
          availability?: Json | null
          available_days?: number[] | null
          available_times?: string[] | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          item_type?: Database["public"]["Enums"]["marketplace_item_type"]
          name?: string
          price?: number
          seller_id?: string
          views_count?: number | null
          whatsapp_clicks?: number | null
        }
        Relationships: []
      }
      moderation_rules: {
        Row: {
          active: boolean | null
          applies_to_minors: boolean | null
          created_at: string | null
          id: string
          rule_type: string
          severity: string
          surfaces: string[] | null
          value: string
        }
        Insert: {
          active?: boolean | null
          applies_to_minors?: boolean | null
          created_at?: string | null
          id?: string
          rule_type: string
          severity: string
          surfaces?: string[] | null
          value: string
        }
        Update: {
          active?: boolean | null
          applies_to_minors?: boolean | null
          created_at?: string | null
          id?: string
          rule_type?: string
          severity?: string
          surfaces?: string[] | null
          value?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string | null
          id: string
          read: boolean | null
          related_post_id: string | null
          target_type: string | null
          title: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          related_post_id?: string | null
          target_type?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          related_post_id?: string | null
          target_type?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          id: string
          post_id: string
          viewed_at: string | null
          viewer_id: string | null
          watch_seconds: number | null
        }
        Insert: {
          id?: string
          post_id: string
          viewed_at?: string | null
          viewer_id?: string | null
          watch_seconds?: number | null
        }
        Update: {
          id?: string
          post_id?: string
          viewed_at?: string | null
          viewer_id?: string | null
          watch_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          category: string
          comments_count: number | null
          created_at: string | null
          description: string
          id: string
          is_ad: boolean | null
          is_bot_content: boolean | null
          is_private: boolean | null
          latitude: number | null
          likes_count: number | null
          linked_item_id: string | null
          location: string | null
          location_name: string | null
          longitude: number | null
          media_type: string | null
          media_url: string | null
          product_id: string | null
          shares_count: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          user_id: string | null
          views_count: number | null
        }
        Insert: {
          category: string
          comments_count?: number | null
          created_at?: string | null
          description: string
          id?: string
          is_ad?: boolean | null
          is_bot_content?: boolean | null
          is_private?: boolean | null
          latitude?: number | null
          likes_count?: number | null
          linked_item_id?: string | null
          location?: string | null
          location_name?: string | null
          longitude?: number | null
          media_type?: string | null
          media_url?: string | null
          product_id?: string | null
          shares_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          views_count?: number | null
        }
        Update: {
          category?: string
          comments_count?: number | null
          created_at?: string | null
          description?: string
          id?: string
          is_ad?: boolean | null
          is_bot_content?: boolean | null
          is_private?: boolean | null
          latitude?: number | null
          likes_count?: number | null
          linked_item_id?: string | null
          location?: string | null
          location_name?: string | null
          longitude?: number | null
          media_type?: string | null
          media_url?: string | null
          product_id?: string | null
          shares_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean | null
          created_at: string | null
          description: string | null
          id: string
          price: number | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          available?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          price?: number | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          available?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          price?: number | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_memory: {
        Row: {
          confidence: number | null
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          memory_type: string
          professional_id: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          memory_type: string
          professional_id?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          memory_type?: string
          professional_id?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_memory_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          profile_id: string | null
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_home_service: boolean | null
          account_type: string | null
          age_verified: boolean | null
          avatar_url: string | null
          avg_rating: number | null
          bio: string | null
          birth_date: string | null
          bot_category: string | null
          business_hours: string | null
          business_name: string | null
          cover_url: string | null
          created_at: string | null
          differentials: string | null
          display_name: string | null
          document: string | null
          document_type: string | null
          expo_push_token: string | null
          followers_count: number
          following_count: number
          guardian_consent: boolean | null
          guardian_email: string | null
          id: string
          is_banned: boolean | null
          is_bot: boolean | null
          is_private: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string | null
          nickname: string | null
          notifications_enabled: boolean | null
          offered_services: string | null
          payment_methods: string | null
          phone: string | null
          pinned_posts: string[] | null
          posts_count: number
          profile_type: string | null
          role: string | null
          specialty: string | null
          target_audience: string | null
          total_reviews: number | null
          username: string | null
          verified: boolean | null
          website: string | null
          whatsapp: string | null
          whatsapp_clicks: number | null
          years_experience: number | null
        }
        Insert: {
          accepts_home_service?: boolean | null
          account_type?: string | null
          age_verified?: boolean | null
          avatar_url?: string | null
          avg_rating?: number | null
          bio?: string | null
          birth_date?: string | null
          bot_category?: string | null
          business_hours?: string | null
          business_name?: string | null
          cover_url?: string | null
          created_at?: string | null
          differentials?: string | null
          display_name?: string | null
          document?: string | null
          document_type?: string | null
          expo_push_token?: string | null
          followers_count?: number
          following_count?: number
          guardian_consent?: boolean | null
          guardian_email?: string | null
          id: string
          is_banned?: boolean | null
          is_bot?: boolean | null
          is_private?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string | null
          nickname?: string | null
          notifications_enabled?: boolean | null
          offered_services?: string | null
          payment_methods?: string | null
          phone?: string | null
          pinned_posts?: string[] | null
          posts_count?: number
          profile_type?: string | null
          role?: string | null
          specialty?: string | null
          target_audience?: string | null
          total_reviews?: number | null
          username?: string | null
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
          whatsapp_clicks?: number | null
          years_experience?: number | null
        }
        Update: {
          accepts_home_service?: boolean | null
          account_type?: string | null
          age_verified?: boolean | null
          avatar_url?: string | null
          avg_rating?: number | null
          bio?: string | null
          birth_date?: string | null
          bot_category?: string | null
          business_hours?: string | null
          business_name?: string | null
          cover_url?: string | null
          created_at?: string | null
          differentials?: string | null
          display_name?: string | null
          document?: string | null
          document_type?: string | null
          expo_push_token?: string | null
          followers_count?: number
          following_count?: number
          guardian_consent?: boolean | null
          guardian_email?: string | null
          id?: string
          is_banned?: boolean | null
          is_bot?: boolean | null
          is_private?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string | null
          nickname?: string | null
          notifications_enabled?: boolean | null
          offered_services?: string | null
          payment_methods?: string | null
          phone?: string | null
          pinned_posts?: string[] | null
          posts_count?: number
          profile_type?: string | null
          role?: string | null
          specialty?: string | null
          target_audience?: string | null
          total_reviews?: number | null
          username?: string | null
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
          whatsapp_clicks?: number | null
          years_experience?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          reported_post_id: string | null
          reported_user_id: string | null
          reporter_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          reported_post_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_post_id_fkey"
            columns: ["reported_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reposts: {
        Row: {
          id: string
          original_creator_id: string
          original_post_id: string
          reposted_at: string | null
          reposted_by_id: string
        }
        Insert: {
          id?: string
          original_creator_id: string
          original_post_id: string
          reposted_at?: string | null
          reposted_by_id: string
        }
        Update: {
          id?: string
          original_creator_id?: string
          original_post_id?: string
          reposted_at?: string | null
          reposted_by_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_goals: {
        Row: {
          created_at: string | null
          id: string
          month_year: string
          monthly_target: number
          professional_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month_year: string
          monthly_target: number
          professional_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month_year?: string
          monthly_target?: number
          professional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_goals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          item_id: string
          profile_id: string | null
          rating: number
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          item_id: string
          profile_id?: string | null
          rating: number
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          item_id?: string
          profile_id?: string | null
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          auto_approve: boolean | null
          break_between_min: number
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          professional_id: string
          slot_duration_min: number
          start_time: string
        }
        Insert: {
          auto_approve?: boolean | null
          break_between_min?: number
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          professional_id: string
          slot_duration_min?: number
          start_time: string
        }
        Update: {
          auto_approve?: boolean | null
          break_between_min?: number
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          professional_id?: string
          slot_duration_min?: number
          start_time?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
        }
        Insert: {
          features?: Json | null
          id: string
          is_active?: boolean | null
          name: string
          price_cents: number
        }
        Update: {
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      user_ai_usage: {
        Row: {
          id: string
          images_generated: number | null
          period_start: string | null
          requests_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          images_generated?: number | null
          period_start?: string | null
          requests_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          images_generated?: number | null
          period_start?: string | null
          requests_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_behavior_scores: {
        Row: {
          critical_attempts: number | null
          high_attempts: number | null
          id: string
          last_incident_at: string | null
          medium_flags: number | null
          risk_score: number | null
          status: string | null
          suspended_until: string | null
          suspension_reason: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          critical_attempts?: number | null
          high_attempts?: number | null
          id?: string
          last_incident_at?: string | null
          medium_flags?: number | null
          risk_score?: number | null
          status?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          critical_attempts?: number | null
          high_attempts?: number | null
          id?: string
          last_incident_at?: string | null
          medium_flags?: number | null
          risk_score?: number | null
          status?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_behavior_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          external_subscription_id: string | null
          id: string
          payment_provider: string | null
          plan_id: string | null
          started_at: string | null
          status: string
          trial_ends_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          external_subscription_id?: string | null
          id?: string
          payment_provider?: string | null
          plan_id?: string | null
          started_at?: string | null
          status?: string
          trial_ends_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          external_subscription_id?: string | null
          id?: string
          payment_provider?: string | null
          plan_id?: string | null
          started_at?: string | null
          status?: string
          trial_ends_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      market_price_reference: {
        Row: {
          avg_price: number | null
          category: string | null
          p25_price: number | null
          p75_price: number | null
          region_type: string | null
          sample_size: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_ban_user: { Args: { p_target_id: string }; Returns: undefined }
      check_user_is_pro: { Args: { target_user_id: string }; Returns: boolean }
      clean_old_chat_messages: { Args: never; Returns: undefined }
      decrement_follow_counts: {
        Args: { _follower_id: string; _following_id: string }
        Returns: undefined
      }
      decrement_likes: { Args: { post_id_input: string }; Returns: undefined }
      get_or_create_ai_usage: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          images_generated: number | null
          period_start: string | null
          requests_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_ai_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_today_availability: {
        Args: { p_date: string; p_professional_id: string }
        Returns: Json
      }
      get_week_availability: {
        Args: {
          p_current_time: string
          p_date_end: string
          p_date_start: string
          p_professional_id: string
        }
        Returns: Json
      }
      increment_ai_image_usage: { Args: { p_user_id: string }; Returns: number }
      increment_ai_usage: { Args: { p_user_id: string }; Returns: number }
      increment_comments: {
        Args: { post_id_input: string }
        Returns: undefined
      }
      increment_follow_counts: {
        Args: { _follower_id: string; _following_id: string }
        Returns: undefined
      }
      increment_likes: { Args: { post_id_input: string }; Returns: undefined }
      increment_whatsapp_clicks: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_not_banned: { Args: never; Returns: boolean }
    }
    Enums: {
      marketplace_item_type: "product" | "service"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      marketplace_item_type: ["product", "service"],
    },
  },
} as const

