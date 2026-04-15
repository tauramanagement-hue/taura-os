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
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          agency_id: string
          athlete_id: string | null
          contract_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          agency_id: string
          athlete_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          agency_id?: string
          athlete_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          onboarding_completed: boolean | null
          plan: string | null
          roster_size_range: string | null
          sport_sector: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean | null
          plan?: string | null
          roster_size_range?: string | null
          sport_sector?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean | null
          plan?: string | null
          roster_size_range?: string | null
          sport_sector?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      athletes: {
        Row: {
          agency_id: string
          category: string | null
          created_at: string | null
          date_of_birth: string | null
          full_name: string
          id: string
          instagram_followers: number | null
          instagram_handle: string | null
          nationality: string | null
          notes: string | null
          photo_url: string | null
          sport: string
          status: string | null
          tiktok_followers: number | null
          tiktok_handle: string | null
          updated_at: string | null
          youtube_followers: number | null
          youtube_handle: string | null
        }
        Insert: {
          agency_id: string
          category?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name: string
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          nationality?: string | null
          notes?: string | null
          photo_url?: string | null
          sport: string
          status?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          updated_at?: string | null
          youtube_followers?: number | null
          youtube_handle?: string | null
        }
        Update: {
          agency_id?: string
          category?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string
          id?: string
          instagram_followers?: number | null
          instagram_handle?: string | null
          nationality?: string | null
          notes?: string | null
          photo_url?: string | null
          sport?: string
          status?: string | null
          tiktok_followers?: number | null
          tiktok_handle?: string | null
          updated_at?: string | null
          youtube_followers?: number | null
          youtube_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliverables: {
        Row: {
          ai_overview: string | null
          athlete_id: string | null
          campaign_id: string
          content_approved: boolean | null
          content_type: string
          created_at: string | null
          description: string | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          link_clicks: number | null
          notes: string | null
          post_confirmed: boolean | null
          reach: number | null
          scheduled_date: string | null
          updated_at: string | null
        }
        Insert: {
          ai_overview?: string | null
          athlete_id?: string | null
          campaign_id: string
          content_approved?: boolean | null
          content_type: string
          created_at?: string | null
          description?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          notes?: string | null
          post_confirmed?: boolean | null
          reach?: number | null
          scheduled_date?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_overview?: string | null
          athlete_id?: string | null
          campaign_id?: string
          content_approved?: boolean | null
          content_type?: string
          created_at?: string | null
          description?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          notes?: string | null
          post_confirmed?: boolean | null
          reach?: number | null
          scheduled_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliverables_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliverables_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agency_id: string
          brand: string
          brief_file_url: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          brand: string
          brief_file_url?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          brand?: string
          brief_file_url?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conflicts: {
        Row: {
          agency_id: string
          conflict_type: string
          contract_a_id: string
          contract_b_id: string | null
          created_at: string | null
          description: string
          id: string
          resolution_note: string | null
          severity: string
          status: string | null
          suggestion: string | null
        }
        Insert: {
          agency_id: string
          conflict_type: string
          contract_a_id: string
          contract_b_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          resolution_note?: string | null
          severity: string
          status?: string | null
          suggestion?: string | null
        }
        Update: {
          agency_id?: string
          conflict_type?: string
          contract_a_id?: string
          contract_b_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          resolution_note?: string | null
          severity?: string
          status?: string | null
          suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conflicts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_contract_a_id_fkey"
            columns: ["contract_a_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_contract_b_id_fkey"
            columns: ["contract_b_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          agency_id: string
          ai_extracted_clauses: Json | null
          athlete_id: string
          brand: string
          contract_type: string
          created_at: string | null
          currency: string | null
          end_date: string
          exclusivity_category: string | null
          exclusivity_territory: string | null
          file_url: string | null
          id: string
          image_rights: string | null
          obligations: string | null
          penalties: string | null
          renewal_clause: string | null
          social_obligations: string | null
          start_date: string
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          agency_id: string
          ai_extracted_clauses?: Json | null
          athlete_id: string
          brand: string
          contract_type: string
          created_at?: string | null
          currency?: string | null
          end_date: string
          exclusivity_category?: string | null
          exclusivity_territory?: string | null
          file_url?: string | null
          id?: string
          image_rights?: string | null
          obligations?: string | null
          penalties?: string | null
          renewal_clause?: string | null
          social_obligations?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          agency_id?: string
          ai_extracted_clauses?: Json | null
          athlete_id?: string
          brand?: string
          contract_type?: string
          created_at?: string | null
          currency?: string | null
          end_date?: string
          exclusivity_category?: string | null
          exclusivity_territory?: string | null
          file_url?: string | null
          id?: string
          image_rights?: string | null
          obligations?: string | null
          penalties?: string | null
          renewal_clause?: string | null
          social_obligations?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agency_id: string
          assigned_to: string | null
          athlete_id: string
          brand: string
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          currency: string | null
          deal_type: string | null
          expected_close_date: string | null
          id: string
          last_activity_date: string | null
          notes: string | null
          probability: number | null
          stage: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          athlete_id: string
          brand: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          currency?: string | null
          deal_type?: string | null
          expected_close_date?: string | null
          id?: string
          last_activity_date?: string | null
          notes?: string | null
          probability?: number | null
          stage?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          athlete_id?: string
          brand?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          currency?: string | null
          deal_type?: string | null
          expected_close_date?: string | null
          id?: string
          last_activity_date?: string | null
          notes?: string | null
          probability?: number | null
          stage?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          severity: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
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
      profiles: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          last_briefing_date: string | null
          last_login: string | null
          role: string | null
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          last_briefing_date?: string | null
          last_login?: string | null
          role?: string | null
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_briefing_date?: string | null
          last_login?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          agency_id: string
          athlete_id: string | null
          campaign_id: string | null
          content: string
          generated_at: string | null
          id: string
          report_type: string
          title: string
        }
        Insert: {
          agency_id: string
          athlete_id?: string | null
          campaign_id?: string | null
          content: string
          generated_at?: string | null
          id?: string
          report_type?: string
          title: string
        }
        Update: {
          agency_id?: string
          athlete_id?: string | null
          campaign_id?: string | null
          content?: string
          generated_at?: string | null
          id?: string
          report_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
