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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      documentos: {
        Row: {
          campos_dudosos: Json
          cliente: string | null
          created_at: string
          cuit_cliente: string | null
          cuit_proveedor: string | null
          empresa_id: string
          fecha: string | null
          id: string
          items: Json
          numero: string | null
          proveedor: string
          tipo: string
        }
        Insert: {
          campos_dudosos?: Json
          cliente?: string | null
          created_at?: string
          cuit_cliente?: string | null
          cuit_proveedor?: string | null
          empresa_id: string
          fecha?: string | null
          id?: string
          items?: Json
          numero?: string | null
          proveedor: string
          tipo: string
        }
        Update: {
          campos_dudosos?: Json
          cliente?: string | null
          created_at?: string
          cuit_cliente?: string | null
          cuit_proveedor?: string | null
          empresa_id?: string
          fecha?: string | null
          id?: string
          items?: Json
          numero?: string | null
          proveedor?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          categoria: string
          concepto: string
          created_at: string
          empresa_id: string
          fecha: string
          id: string
          monto: number
          origen: string
        }
        Insert: {
          categoria: string
          concepto: string
          created_at?: string
          empresa_id: string
          fecha: string
          id?: string
          monto: number
          origen?: string
        }
        Update: {
          categoria?: string
          concepto?: string
          created_at?: string
          empresa_id?: string
          fecha?: string
          id?: string
          monto?: number
          origen?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      licencias: {
        Row: {
          clave: string
          cliente: string
          created_at: string
          estado: string
          id: string
          max_terminales: number
          vencimiento: string | null
        }
        Insert: {
          clave: string
          cliente: string
          created_at?: string
          estado?: string
          id?: string
          max_terminales?: number
          vencimiento?: string | null
        }
        Update: {
          clave?: string
          cliente?: string
          created_at?: string
          estado?: string
          id?: string
          max_terminales?: number
          vencimiento?: string | null
        }
        Relationships: []
      }
      terminales: {
        Row: {
          activada_at: string
          id: string
          licencia_id: string
          machine_id: string
          nombre_pc: string
          ultima_conexion: string
        }
        Insert: {
          activada_at?: string
          id?: string
          licencia_id: string
          machine_id: string
          nombre_pc?: string
          ultima_conexion?: string
        }
        Update: {
          activada_at?: string
          id?: string
          licencia_id?: string
          machine_id?: string
          nombre_pc?: string
          ultima_conexion?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminales_licencia_id_fkey"
            columns: ["licencia_id"]
            isOneToOne: false
            referencedRelation: "licencias"
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
      usuarios_empresa: {
        Row: {
          created_at: string
          empresa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activar_licencia: {
        Args: { _clave: string; _machine_id: string; _nombre_pc: string }
        Returns: Json
      }
      cambiar_estado_licencia: {
        Args: { _estado: string; _licencia_id: string }
        Returns: Json
      }
      crear_empresa: {
        Args: { _nombre: string }
        Returns: {
          codigo: string
          created_at: string
          id: string
          nombre: string
        }
        SetofOptions: {
          from: "*"
          to: "empresas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_licencia: {
        Args: {
          _cliente: string
          _max_terminales?: number
          _vencimiento?: string
        }
        Returns: Json
      }
      estado_licencia: {
        Args: { _clave: string; _machine_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      liberar_terminal: { Args: { _terminal_id: string }; Returns: Json }
      listar_licencias: { Args: never; Returns: Json }
      mi_empresa_id: { Args: never; Returns: string }
      unirse_empresa: {
        Args: { _codigo: string }
        Returns: {
          codigo: string
          created_at: string
          id: string
          nombre: string
        }
        SetofOptions: {
          from: "*"
          to: "empresas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
