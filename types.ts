
export enum AppView {
  WELCOME = 'WELCOME',
  LOGIN = 'LOGIN',
  SIGNUP_1 = 'SIGNUP_1',
  SIGNUP_2 = 'SIGNUP_2',
  SIGNUP_3 = 'SIGNUP_3',
  SIGNUP_4 = 'SIGNUP_4',
  DASHBOARD = 'DASHBOARD',
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY'
}

export enum DashboardTab {
  CHAT = 'CHAT',
  EXPLORE = 'EXPLORE',
  DIARY = 'DIARY',
  REPORT = 'REPORT',
  SETTINGS = 'SETTINGS'
}

export enum ExploreSubView {
  HUB = 'HUB',
  BREATHING = 'BREATHING',
  MEDITATION_LIST = 'MEDITATION_LIST',
  MEDITATION_PLAYER = 'MEDITATION_PLAYER',
  AFFIRMATIONS = 'AFFIRMATIONS',
  VISUALIZATION = 'VISUALIZATION'
}

export enum SettingsSubView {
  MAIN = 'MAIN',
  NOTIFICATIONS = 'NOTIFICATIONS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  APPEARANCE = 'APPEARANCE',
  PRIVACY = 'PRIVACY',
  HELP = 'HELP',
  ENCOURAGEMENT = 'ENCOURAGEMENT'
}

export enum Tone {
  GENTLE = 'GENTLE',
  HUMOROUS = 'HUMOROUS',
  RATIONAL = 'RATIONAL',
  CUSTOM = 'CUSTOM'
}

export enum GrowthArea {
  SOCIAL = 'SOCIAL',      // 社交
  WORK = 'WORK',          // 工作
  EXTERNAL = 'EXTERNAL',  // 外在
  SELF = 'SELF',          // 自我
  HEALTH = 'HEALTH',      // 健康
  RELATIONSHIP = 'RELATIONSHIP'  // 關係
}

export enum Category {
  SOCIAL = 'SOCIAL',
  WORK = 'WORK',
  EXTERNAL = 'EXTERNAL',
  SELF = 'SELF'
}

export interface DiaryEntry {
  id: string;
  date: Date;
  title: string;
  content: string;
  emoji: string;
  tags: string[];
}

export enum Language {
  ZH_TW = 'zh-TW',
  ZH_HK = 'zh-HK'
}

export interface UserProfile {
  nickname: string;
  email: string;
  tone: Tone;
  customTone?: string;  // 用戶自訂的語氣描述
  goals: Category[];
  growthArea?: GrowthArea;  // 用戶希望在哪個區域看到成長
  language: Language;
  avatarUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

// ============= 成長報告類型 =============

export type ReportType = 'weekly' | 'monthly' | 'quarterly';

// 情緒數據點
export interface MoodDataPoint {
  date: string;
  val: number;
  note?: string;
}

// 成長分數
export interface GrowthScores {
  social: number;
  confidence: number;
  work: number;
  health: number;
  courage: number;
}

// 成就
export interface Achievement {
  id: string;
  name: string;
  icon: string;
}

// 報告摘要
export interface ReportSummary {
  total_diary_entries: number;
  total_chat_messages: number;
  average_mood: number;
  streak_days: number;
  top_category: string;
}

// 成長報告
export interface GrowthReport {
  id: string;
  user_id: string;
  report_type: ReportType;
  report_date: Date;
  mood_data: MoodDataPoint[];
  growth_scores: GrowthScores;
  achievements: Achievement[];
  marshmallow_message: string;
  summary: ReportSummary;
  is_generated: boolean;
}
