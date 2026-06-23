export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      connections: {
        Row: {
          access_secret_id: string | null
          account_label: string | null
          auth_class: string
          config: Json | null
          created_at: string
          expires_at: string | null
          id: string
          refresh_secret_id: string | null
          scopes: string[]
          service: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_secret_id?: string | null
          account_label?: string | null
          auth_class: string
          config?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_secret_id?: string | null
          scopes?: string[]
          service: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_secret_id?: string | null
          account_label?: string | null
          auth_class?: string
          config?: Json | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_secret_id?: string | null
          scopes?: string[]
          service?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboards: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          active_product_id: string | null
          current_period_end: string | null
          last_event_id: string | null
          last_event_ms: number | null
          status: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_product_id?: string | null
          current_period_end?: string | null
          last_event_id?: string | null
          last_event_ms?: number | null
          status: string
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_product_id?: string | null
          current_period_end?: string | null
          last_event_id?: string | null
          last_event_ms?: number | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kiosk_configs: {
        Row: {
          control_backlight: boolean
          curve: Json
          dashboard_id: string
          exit: Json | null
          keep_awake: boolean
          night_interval_multiplier: number
          pinning: Json | null
          profile: Json
          schedule: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          control_backlight?: boolean
          curve: Json
          dashboard_id: string
          exit?: Json | null
          keep_awake?: boolean
          night_interval_multiplier?: number
          pinning?: Json | null
          profile: Json
          schedule: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          control_backlight?: boolean
          curve?: Json
          dashboard_id?: string
          exit?: Json | null
          keep_awake?: boolean
          night_interval_multiplier?: number
          pinning?: Json | null
          profile?: Json
          schedule?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_configs_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: true
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_transactions: {
        Row: {
          code_verifier: string | null
          expires_at: string
          id: string
          service: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          expires_at: string
          id?: string
          service: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          expires_at?: string
          id?: string
          service?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      proxy_cache: {
        Row: {
          expires_at: string
          fetched_at: string
          params_hash: string
          payload: Json
          service: string
          user_id: string
          widget_type: string
        }
        Insert: {
          expires_at: string
          fetched_at?: string
          params_hash: string
          payload: Json
          service: string
          user_id: string
          widget_type: string
        }
        Update: {
          expires_at?: string
          fetched_at?: string
          params_hash?: string
          payload?: Json
          service?: string
          user_id?: string
          widget_type?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          preferences: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          preferences?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          preferences?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      widget_instances: {
        Row: {
          config: Json
          created_at: string
          dashboard_id: string
          id: string
          rect: Json
          refresh: Json | null
          service_id: string
          size: string
          updated_at: string
          user_id: string
          widget_type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          dashboard_id: string
          id?: string
          rect: Json
          refresh?: Json | null
          service_id: string
          size: string
          updated_at?: string
          user_id: string
          widget_type: string
        }
        Update: {
          config?: Json
          created_at?: string
          dashboard_id?: string
          id?: string
          rect?: Json
          refresh?: Json | null
          service_id?: string
          size?: string
          updated_at?: string
          user_id?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_instances_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

