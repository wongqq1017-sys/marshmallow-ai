// 認證服務
// 處理用戶註冊、登入、登出

import { supabase } from './supabaseClient';
import { Tone, Category, Language } from '../types';

export interface AuthUser {
  id: string;
  email: string;
}

export interface SignUpData {
  email: string;
  password: string;
  nickname?: string;
}

// 註冊新用戶
export const signUp = async ({ email, password, nickname }: SignUpData) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname || '棉花糖夥伴'
      },
      // 跳過郵箱確認，讓用戶可以直接登入（需要在 Supabase 儀表板關閉 Confirm email）
      emailConfirmTo: false
    }
  });

  if (error) throw error;

  // 自動登入
  if (data.user) {
    return { user: data.user, needsConfirmation: data.session === null };
  }

  return { user: null, needsConfirmation: true };
};

// 使用郵箱密碼登入
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  return {
    user: data.user,
    session: data.session
  };
};

// 登出
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// 獲取當前登入用戶
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) return null;
  return user;
};

// 獲取當前 session（用於 OAuth 回調處理）
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
};

// 監聽認證狀態變化
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

// 密碼重置請求
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
};

// 更新密碼
export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
};

// 重新發送驗證郵件
// 重新發送驗證郵件
export const resendVerificationEmail = async (email: string) => {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: `${window.location.origin}/`
    }
  });

  if (error) throw error;
  return data;
};

// 處理郵箱確認 URL 的函數
export const handleEmailConfirmation = async () => {
  // 檢查 URL hash 是否包含確認資訊
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const type = hashParams.get('type');

  if (accessToken && refreshToken && type === 'signup') {
    // 設置 session
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      console.error('確認郵箱失敗:', error);
      throw error;
    }

    return data.session;
  }

  return null;
};

// 使用 Google OAuth 登入
export const signInWithGoogle = async () => {
  // 在 iOS Capacitor 環境，window.location.origin 是 capacitor://localhost
  // 這會導致 Google OAuth 跳錯「網址無效」，所以需要判斷環境使用正確的 https 回調網址
  let redirectTo: string;

  if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
    // Web 環境：正常使用當前網址
    redirectTo = window.location.origin;
  } else {
    // Capacitor/App 環境：使用 Supabase 的回調網址
    redirectTo = 'https://xneuktrppphtxtdrowok.supabase.co/auth/v1/callback';
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo
    }
  });

  if (error) throw error;
  return data;
};
