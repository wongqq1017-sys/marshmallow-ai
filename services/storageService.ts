// 數據存儲服務
// 處理用戶資料、聊天記錄、日記、設置的持久化

import { supabase } from './supabaseClient';
import { Tone, Category, Language, DiaryEntry, UserProfile, ChatMessage, GrowthArea } from '../types';

// ============= 用戶資料 =============

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId);

  if (error) throw error;
  
  // 如果沒有資料，返回 null
  if (!data || data.length === 0) return null;
  
  // 如果有多筆資料，取第一筆
  return data[0];
};

export const updateUserProfile = async (userId: string, updates: {
  nickname?: string;
  tone?: Tone;
  customTone?: string | null;
  goals?: Category[];
  growthArea?: GrowthArea | null;
  language?: Language;
  avatar_url?: string;
}) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      goals: updates.goals ? JSON.stringify(updates.goals) : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data?.[0] || null;
};

// ============= 聊天記錄 =============

export const getChatHistory = async (userId: string) => {
  const { data, error } = await supabase
    .from('chat_histories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.messages || [];
};

export const saveChatHistory = async (userId: string, messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>) => {
  // 查找現有記錄
  const { data: existing } = await supabase
    .from('chat_histories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existing && existing.length > 0) {
    // 更新現有記錄
    const { error } = await supabase
      .from('chat_histories')
      .update({
        messages,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
  } else {
    // 創建新記錄
    const { error } = await supabase
      .from('chat_histories')
      .insert({
        user_id: userId,
        messages
      });

    if (error) throw error;
  }
};

// ============= 日記 =============

export const getDiaryEntries = async (userId: string) => {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  
  // 轉換數據格式
  return data?.map(entry => ({
    id: entry.id,
    date: new Date(entry.date),
    title: entry.title,
    content: entry.content,
    emoji: entry.emoji,
    tags: entry.tags || []
  })) || [];
};

export const saveDiaryEntry = async (userId: string, entry: Omit<DiaryEntry, 'id'>) => {
  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      title: entry.title,
      content: entry.content,
      emoji: entry.emoji,
      tags: entry.tags,
      date: entry.date.toISOString().split('T')[0]
    })
    .select();

  if (error) throw error;
  
  if (!data || data.length === 0) {
    throw new Error('Failed to save diary entry');
  }
  
  return {
    id: data[0].id,
    date: new Date(data[0].date),
    title: data[0].title,
    content: data[0].content,
    emoji: data[0].emoji,
    tags: data[0].tags || []
  };
};

export const updateDiaryEntry = async (entryId: string, updates: {
  title?: string;
  content?: string;
  emoji?: string;
  tags?: string[];
}) => {
  const { data, error } = await supabase
    .from('diary_entries')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', entryId)
    .select();

  if (error) throw error;
  
  if (!data || data.length === 0) {
    throw new Error('Failed to update diary entry');
  }
  
  return {
    id: data[0].id,
    date: new Date(data[0].date),
    title: data[0].title,
    content: data[0].content,
    emoji: data[0].emoji,
    tags: data[0].tags || []
  };
};

export const deleteDiaryEntry = async (entryId: string) => {
  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw error;
};

// ============= 用戶設置 =============

export const getUserSettings = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  
  // 如果沒有資料，返回 null
  if (!data || data.length === 0) return null;
  
  // 如果有多筆資料，取第一筆
  return data[0];
};

export const updateUserSettings = async (userId: string, updates: {
  theme?: string;
  notifications_enabled?: boolean;
  encouragement?: string;
}) => {
  const { data, error } = await supabase
    .from('user_settings')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select();

  if (error) throw error;
  return data?.[0] || null;
};

// ============= 離線支持 =============

// 本地緩存鍵
const CACHE_KEYS = {
  PROFILE: 'marshmallow_profile',
  CHAT: 'marshmallow_chat',
  DIARY: 'marshmallow_diary',
  SETTINGS: 'marshmallow_settings'
};

// 本地緩存讀取
export const getLocalCache = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

// 本地緩存保存
export const setLocalCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Local cache save failed:', e);
  }
};

// 本地緩存清除
export const clearLocalCache = () => {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};
