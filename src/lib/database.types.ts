export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      character_skills: {
        Row: {
          character_id: string;
          skill_id: string;
        };
        Insert: {
          character_id: string;
          skill_id: string;
        };
        Update: {
          character_id?: string;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_skills_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "character_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          description: string;
          entity_type: string;
          id: string;
          target_character_id: string | null;
          target_owner_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          description: string;
          entity_type: string;
          id?: string;
          target_character_id?: string | null;
          target_owner_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          description?: string;
          entity_type?: string;
          id?: string;
          target_character_id?: string | null;
          target_owner_id?: string | null;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          class_id: string | null;
          created_at: string;
          current_hp: number;
          id: string;
          is_dead: boolean;
          kind: string;
          level: number;
          max_hp: number;
          name: string;
          notes: string;
          owner_id: string | null;
          stats: Json;
          updated_at: string;
          xp: number;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          current_hp?: number;
          id?: string;
          is_dead?: boolean;
          kind?: string;
          level?: number;
          max_hp?: number;
          name: string;
          notes?: string;
          owner_id?: string | null;
          stats?: Json;
          updated_at?: string;
          xp?: number;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          current_hp?: number;
          id?: string;
          is_dead?: boolean;
          kind?: string;
          level?: number;
          max_hp?: number;
          name?: string;
          notes?: string;
          owner_id?: string | null;
          stats?: Json;
          updated_at?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "characters_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "characters_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          name: string;
          points_per_level: number;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          points_per_level?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          points_per_level?: number;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          character_id: string;
          created_at: string;
          id: string;
          item_id: string | null;
          item_name: string;
          quantity: number;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          id?: string;
          item_id?: string | null;
          item_name: string;
          quantity?: number;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          id?: string;
          item_id?: string | null;
          item_name?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id: string;
          role?: string;
        };
        Relationships: [];
      };
      session_notes: {
        Row: {
          content_md: string;
          created_at: string;
          id: string;
          occurred_on: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content_md?: string;
          created_at?: string;
          id?: string;
          occurred_on?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          content_md?: string;
          created_at?: string;
          id?: string;
          occurred_on?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          class_id: string;
          cost: number;
          created_at: string;
          description: string;
          id: string;
          is_default: boolean;
          name: string;
          prereq_skill_ids: string[];
        };
        Insert: {
          class_id: string;
          cost?: number;
          created_at?: string;
          description?: string;
          id?: string;
          is_default?: boolean;
          name: string;
          prereq_skill_ids?: string[];
        };
        Update: {
          class_id?: string;
          cost?: number;
          created_at?: string;
          description?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          prereq_skill_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "skills_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      adjust_inventory: {
        Args: { p_character: string; p_delta: number; p_item: string };
        Returns: undefined;
      };
      dm_update_character: {
        Args: { p_id: string; p_updates: Json };
        Returns: undefined;
      };
      grant_default_skills: {
        Args: { p_character: string };
        Returns: undefined;
      };
      lock_skill: {
        Args: { p_character: string; p_skill: string };
        Returns: undefined;
      };
      transfer_inventory: {
        Args: {
          p_from_character: string;
          p_item_name: string;
          p_quantity: number;
          p_to_character: string;
        };
        Returns: undefined;
      };
      unlock_skill: {
        Args: { p_character: string; p_skill: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type CharacterRow = Database["public"]["Tables"]["characters"]["Row"];
export type CharacterInsert =
  Database["public"]["Tables"]["characters"]["Insert"];
export type CharacterUpdate =
  Database["public"]["Tables"]["characters"]["Update"];
export type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
export type SkillRow = Database["public"]["Tables"]["skills"]["Row"];
export type ItemRow = Database["public"]["Tables"]["items"]["Row"];
export type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
export type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];
export type SessionNoteRow =
  Database["public"]["Tables"]["session_notes"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
