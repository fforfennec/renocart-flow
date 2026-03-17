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
      item_responses: {
        Row: {
          can_fulfill: boolean | null
          id: string
          item_id: string
          response_id: string
          supplier_note: string | null
        }
        Insert: {
          can_fulfill?: boolean | null
          id?: string
          item_id: string
          response_id: string
          supplier_note?: string | null
        }
        Update: {
          can_fulfill?: boolean | null
          id?: string
          item_id?: string
          response_id?: string
          supplier_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_responses_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "supplier_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          client_note: string | null
          id: string
          image_url: string | null
          name: string
          order_id: string
          quantity: number
          sku: string | null
          sort_order: number | null
        }
        Insert: {
          client_note?: string | null
          id?: string
          image_url?: string | null
          name: string
          order_id: string
          quantity?: number
          sku?: string | null
          sort_order?: number | null
        }
        Update: {
          client_note?: string | null
          id?: string
          image_url?: string | null
          name?: string
          order_id?: string
          quantity?: number
          sku?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          sender_name: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          sender_name: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_address: string
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          delivery_date: string
          delivery_time_window: string
          id: string
          internal_notes: string | null
          order_number: string
          status: string
          truck_type: string | null
          updated_at: string
        }
        Insert: {
          client_address: string
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date: string
          delivery_time_window: string
          id?: string
          internal_notes?: string | null
          order_number: string
          status?: string
          truck_type?: string | null
          updated_at?: string
        }
        Update: {
          client_address?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          delivery_time_window?: string
          id?: string
          internal_notes?: string | null
          order_number?: string
          status?: string
          truck_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          supplier_type: Database["public"]["Enums"]["supplier_type"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_type: Database["public"]["Enums"]["supplier_type"]
          id: string
          order_id: string
          supplier_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_type?: Database["public"]["Enums"]["supplier_type"]
          id?: string
          order_id: string
          supplier_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_type?: Database["public"]["Enums"]["supplier_type"]
          id?: string
          order_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_responses: {
        Row: {
          alternative_date: string | null
          alternative_time: string | null
          alternative_truck: string | null
          assignment_id: string
          can_deliver_date: boolean | null
          can_deliver_time: boolean | null
          can_deliver_truck: boolean | null
          confirmed_at: string | null
          id: string
          responded_at: string | null
          status: string
          supplier_general_note: string | null
        }
        Insert: {
          alternative_date?: string | null
          alternative_time?: string | null
          alternative_truck?: string | null
          assignment_id: string
          can_deliver_date?: boolean | null
          can_deliver_time?: boolean | null
          can_deliver_truck?: boolean | null
          confirmed_at?: string | null
          id?: string
          responded_at?: string | null
          status?: string
          supplier_general_note?: string | null
        }
        Update: {
          alternative_date?: string | null
          alternative_time?: string | null
          alternative_truck?: string | null
          assignment_id?: string
          can_deliver_date?: boolean | null
          can_deliver_time?: boolean | null
          can_deliver_truck?: boolean | null
          confirmed_at?: string | null
          id?: string
          responded_at?: string | null
          status?: string
          supplier_general_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "supplier_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supplier"
      supplier_type: "material" | "delivery"
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
    Enums: {
      app_role: ["admin", "supplier"],
      supplier_type: ["material", "delivery"],
    },
  },
} as const
