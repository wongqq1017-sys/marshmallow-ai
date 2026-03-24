// Supabase 客戶端配置
// 連接到您的 Supabase 項目

import { createClient } from '@supabase/supabase-js';

// Supabase 項目憑據
const SUPABASE_URL = 'https://xneuktrppphtxtdrowok.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZXVrdHJwcHBodHh0ZHJvd29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NzE2MzYsImV4cCI6MjA4NzI0NzYzNn0.codFJ19agihc1Kbk3HYS-yBrX1vHEMC0RB6SG3Y-LLE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// 導出類型
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          nickname: string;
          tone: string;
          goals: string[];
          language: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname?: string;
          tone?: string;
          goals?: string[];
          language?: string;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          nickname?: string;
          tone?: string;
          goals?: string[];
          language?: string;
          avatar_url?: string | null;
        };
      };
      chat_histories: {
        Row: {
          id: string;
          user_id: string;
          messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
        };
        Update: {
          messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
        };
      };
      diary_entries: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          emoji: string;
          tags: string[];
          date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          content: string;
          emoji?: string;
          tags?: string[];
          date?: string;
        };
        Update: {
          title?: string;
          content?: string;
          emoji?: string;
          tags?: string[];
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          notifications_enabled: boolean;
          encouragement: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: string;
          notifications_enabled?: boolean;
          encouragement?: string;
        };
        Update: {
          theme?: string;
          notifications_enabled?: boolean;
          encouragement?: string;
        };
      };
    };
  };
};
