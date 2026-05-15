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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          campo: string
          changed_at: string
          id: string
          registro_id: string | null
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          changed_at?: string
          id?: string
          registro_id?: string | null
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          changed_at?: string
          id?: string
          registro_id?: string | null
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros"
            referencedColumns: ["id"]
          },
        ]
      }
      competencias: {
        Row: {
          ano: number
          arquivo_nome: string | null
          created_at: string
          created_by: string | null
          id: string
          mes: number
          registros_count: number
          valor_total: number
        }
        Insert: {
          ano: number
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mes: number
          registros_count?: number
          valor_total?: number
        }
        Update: {
          ano?: number
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mes?: number
          registros_count?: number
          valor_total?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      registros: {
        Row: {
          bairro: string | null
          banco: string | null
          cnpj: string | null
          codigo: string | null
          cofins: number | null
          coletivo: number | null
          competencia_id: string
          conta_financeiro: string | null
          created_at: string
          csll: number | null
          data_abertura: string | null
          data_gerado: string | null
          data_pagamento: string | null
          email: string | null
          empresarial: number | null
          id: string
          individual: number | null
          inss: number | null
          ir: number | null
          iss: number | null
          lote: string | null
          municipio: string | null
          nome_titular: string | null
          ortodontia: number | null
          pis: number | null
          prestador: string
          qtde_procedimentos: number | null
          telefone: string | null
          uf: string | null
          updated_at: string
          valor_acerto: number | null
          valor_bruto: number | null
          valor_glosa: number | null
          valor_liquido: number | null
          valor_lote: number | null
          valor_pago: number | null
          valor_procedimentos: number | null
        }
        Insert: {
          bairro?: string | null
          banco?: string | null
          cnpj?: string | null
          codigo?: string | null
          cofins?: number | null
          coletivo?: number | null
          competencia_id: string
          conta_financeiro?: string | null
          created_at?: string
          csll?: number | null
          data_abertura?: string | null
          data_gerado?: string | null
          data_pagamento?: string | null
          email?: string | null
          empresarial?: number | null
          id?: string
          individual?: number | null
          inss?: number | null
          ir?: number | null
          iss?: number | null
          lote?: string | null
          municipio?: string | null
          nome_titular?: string | null
          ortodontia?: number | null
          pis?: number | null
          prestador: string
          qtde_procedimentos?: number | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          valor_acerto?: number | null
          valor_bruto?: number | null
          valor_glosa?: number | null
          valor_liquido?: number | null
          valor_lote?: number | null
          valor_pago?: number | null
          valor_procedimentos?: number | null
        }
        Update: {
          bairro?: string | null
          banco?: string | null
          cnpj?: string | null
          codigo?: string | null
          cofins?: number | null
          coletivo?: number | null
          competencia_id?: string
          conta_financeiro?: string | null
          created_at?: string
          csll?: number | null
          data_abertura?: string | null
          data_gerado?: string | null
          data_pagamento?: string | null
          email?: string | null
          empresarial?: number | null
          id?: string
          individual?: number | null
          inss?: number | null
          ir?: number | null
          iss?: number | null
          lote?: string | null
          municipio?: string | null
          nome_titular?: string | null
          ortodontia?: number | null
          pis?: number | null
          prestador?: string
          qtde_procedimentos?: number | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          valor_acerto?: number | null
          valor_bruto?: number | null
          valor_glosa?: number | null
          valor_liquido?: number | null
          valor_lote?: number | null
          valor_pago?: number | null
          valor_procedimentos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      app_role: "admin" | "operacional"
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
      app_role: ["admin", "operacional"],
    },
  },
} as const
