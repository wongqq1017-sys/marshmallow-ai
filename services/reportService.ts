// 成長報告服務
// 處理用戶成長報告的生成、查詢和管理

import { supabase } from './supabaseClient';
import { 
  GrowthReport, 
  ReportType, 
  MoodDataPoint, 
  GrowthScores, 
  Achievement, 
  ReportSummary,
  DiaryEntry 
} from '../types';
import { getDiaryEntries } from './storageService';

// ============= 報告生成 =============

// 根據日期範圍計算情緒數據
const calculateMoodData = (entries: DiaryEntry[]): MoodDataPoint[] => {
  return entries.map((entry, index) => {
    // 根據 emoji 轉換為情緒值
    let moodValue = 50;
    if (entry.emoji === '😊' || entry.emoji === '😄' || entry.emoji === '✨') {
      moodValue = 80;
    } else if (entry.emoji === '🙂' || entry.emoji === '💪' || entry.emoji === '🌸') {
      moodValue = 65;
    } else if (entry.emoji === '😐' || entry.emoji === '😌') {
      moodValue = 50;
    } else if (entry.emoji === '😔' || entry.emoji === '😢') {
      moodValue = 35;
    } else if (entry.emoji === '😢' || entry.emoji === '💔') {
      moodValue = 20;
    }

    // 從內容中提取簡短的筆記
    const note = entry.content.length > 30 
      ? entry.content.substring(0, 30) + '...' 
      : entry.content;

    return {
      date: entry.date.toISOString().split('T')[0].slice(5), // MM/DD 格式
      val: moodValue,
      note
    };
  });
};

// 根據日記內容分析成長分數
const analyzeGrowthScores = (entries: DiaryEntry[]): GrowthScores => {
  // 關鍵詞匹配來評估不同領域的成長
  const keywordWeights: Record<keyof GrowthScores, Record<string, number>> = {
    social: {
      '朋友': 5, '聚會': 5, '聊天': 4, '對話': 4, '社交': 5, 
      '同事': 4, '見面': 4, '約': 3, '通話': 3, '訊息': 2
    },
    confidence: {
      '自信': 10, '勇敢': 8, '成功': 7, '達成': 6, '表現': 5,
      '驕傲': 7, '滿意': 5, '成長': 4, '進步': 4, '突破': 6
    },
    work: {
      '工作': 5, '會議': 4, '報告': 4, '提案': 5, '完成': 4,
      '任務': 3, '上司': 4, '同事': 3, '升職': 7, '專案': 4
    },
    health: {
      '運動': 5, '睡眠': 5, '休息': 4, '健康': 6, '冥想': 6,
      '跑步': 4, '瑜伽': 5, '飲食': 4, '身體': 3, '能量': 4
    },
    courage: {
      '嘗試': 6, '挑戰': 6, '面對': 5, '克服': 6, '開始': 4,
      '第一次': 7, '突破': 6, '不安': -3, '害怕': -3, '恐懼': -4
    }
  };

  // 初始化分數
  const scores: GrowthScores = {
    social: 50,
    confidence: 50,
    work: 50,
    health: 50,
    courage: 50
  };

  // 計算每個領域的分數
  (Object.keys(scores) as Array<keyof GrowthScores>).forEach(category => {
    const weights = keywordWeights[category];
    let totalScore = 50;
    
    entries.forEach(entry => {
      const text = entry.title + ' ' + entry.content;
      Object.entries(weights).forEach(([keyword, weight]) => {
        if (text.includes(keyword)) {
          totalScore += weight;
        }
      });
    });

    // 限制分數在 10-100 範圍內
    scores[category] = Math.max(10, Math.min(100, totalScore));
  });

  return scores;
};

// 根據日記內容生成棉花糖訊息
const generateMarshmallowMessage = (
  entries: DiaryEntry[], 
  scores: GrowthScores,
  summary: ReportSummary
): string => {
  if (entries.length === 0) {
    return '開始記錄你的自信日記吧！每一天的記錄都是成長的足跡，我會一直陪著你。✨';
  }

  // 找出最高分的領域
  const maxScore = Math.max(...Object.values(scores));
  const topCategory = Object.entries(scores).find(([_, v]) => v === maxScore)?.[0] || 'confidence';
  
  const categoryNames: Record<keyof GrowthScores, string> = {
    social: '社交',
    confidence: '自信',
    work: '工作',
    health: '健康',
    courage: '勇氣'
  };

  const messages = [
    `本月你在${categoryNames[topCategory]}領域的進步非常顯著！繼續保持這股熱情，你會變得越來越棒。🌸`,
    `看到你這段時間的記錄，我感到非常欣慰。${categoryNames[topCategory]}方面的成長是你努力的證明！💪`,
    `每一天的記錄都是自信的累積。你在${categoryNames[topCategory]}的表現真讓人驚喜！繼續加油，我一直都在。✨`,
    `很高興看到你持續記錄日記！這是自我覺察的第一步。你已經做得很棒了，繼續朝向更好的自己前進吧！🌟`
  ];

  // 根據記錄天數添加額外訊息
  if (summary.streak_days >= 7) {
    return messages[0] + ' 連續 ' + summary.streak_days + ' 天的記錄真是太厲害了！🔥';
  }

  return messages[Math.floor(Math.random() * messages.length)];
};

// 根據記錄解鎖成就
const calculateAchievements = (summary: ReportSummary): Achievement[] => {
  const achievements: Achievement[] = [];

  // 基礎成就
  if (summary.total_diary_entries >= 1) {
    achievements.push({
      id: 'first_diary',
      name: '自信紀錄',
      icon: 'edit_note'
    });
  }

  // 持續記錄成就
  if (summary.streak_days >= 3) {
    achievements.push({
      id: 'three_day_streak',
      name: '初試身手',
      icon: 'self_improvement'
    });
  }

  if (summary.streak_days >= 7) {
    achievements.push({
      id: 'week_streak',
      name: '一週持續',
      icon: 'local_fire_department'
    });
  }

  if (summary.streak_days >= 14) {
    achievements.push({
      id: 'two_week_streak',
      name: '雙週持續',
      icon: 'whatshot'
    });
  }

  if (summary.streak_days >= 30) {
    achievements.push({
      id: 'monthly_complete',
      name: '月度圓滿',
      icon: 'stars'
    });
  }

  // 記錄數量成就
  if (summary.total_diary_entries >= 10) {
    achievements.push({
      id: 'ten_entries',
      name: '十篇日記',
      icon: 'book'
    });
  }

  if (summary.total_diary_entries >= 21) {
    achievements.push({
      id: 'twenty_one_entries',
      name: '自信累積',
      icon: 'emoji_events'
    });
  }

  // 情緒穩定成就
  if (summary.average_mood >= 70) {
    achievements.push({
      id: 'happy_mood',
      name: '心情愉快',
      icon: 'sentiment_very_satisfied'
    });
  }

  if (summary.average_mood >= 60) {
    achievements.push({
      id: 'stable_mood',
      name: '情緒穩定',
      icon: 'sentiment_satisfied'
    });
  }

  return achievements;
};

// 計算報告摘要
const calculateSummary = (entries: DiaryEntry[], moodData: MoodDataPoint[]): ReportSummary => {
  // 計算平均情緒
  const avgMood = moodData.length > 0
    ? Math.round(moodData.reduce((sum, d) => sum + d.val, 0) / moodData.length)
    : 50;

  // 計算連續記錄天數（按日期排序）
  let streakDays = 0;
  if (entries.length > 0) {
    const sortedDates = [...new Set(
      entries.map(e => e.date.toISOString().split('T')[0])
    )].sort().reverse();
    
    const today = new Date().toISOString().split('T')[0];
    if (sortedDates[0] === today || sortedDates[0] === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
      streakDays = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          streakDays++;
        } else {
          break;
        }
      }
    }
  }

  // 找出最常見的標籤
  const tagCounts: Record<string, number> = {};
  entries.forEach(entry => {
    (entry.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topCategory = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '一般';

  return {
    total_diary_entries: entries.length,
    total_chat_messages: 0, // 可以從 chat_histories 獲取
    average_mood: avgMood,
    streak_days: streakDays,
    top_category: topCategory
  };
};

// 生成成長報告
export const generateGrowthReport = async (
  userId: string,
  reportType: ReportType = 'monthly'
): Promise<GrowthReport> => {
  // 計算日期範圍
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (reportType) {
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarterly':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // 獲取日期範圍內的日記
  const allEntries = await getDiaryEntries(userId);
  const filteredEntries = allEntries.filter(
    entry => entry.date >= startDate && entry.date <= endDate
  );

  // 計算各項數據
  const moodData = calculateMoodData(filteredEntries);
  const growthScores = analyzeGrowthScores(filteredEntries);
  const summary = calculateSummary(filteredEntries, moodData);
  const achievements = calculateAchievements(summary);
  const marshmallowMessage = generateMarshmallowMessage(filteredEntries, growthScores, summary);

  // 檢查是否已有當天報告
  const today = now.toISOString().split('T')[0];
  const { data: existingReports } = await supabase
    .from('growth_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_type', reportType)
    .eq('report_date', today)
    .limit(1);

  let reportId: string;

  if (existingReports && existingReports.length > 0) {
    // 更新現有報告
    const { data, error } = await supabase
      .from('growth_reports')
      .update({
        mood_data: moodData,
        growth_scores: growthScores,
        achievements: achievements,
        marshmallow_message: marshmallowMessage,
        summary: summary,
        is_generated: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingReports[0].id)
      .select();

    if (error) throw error;
    reportId = data?.[0]?.id || existingReports[0].id;
  } else {
    // 創建新報告
    const { data, error } = await supabase
      .from('growth_reports')
      .insert({
        user_id: userId,
        report_type: reportType,
        report_date: today,
        mood_data: moodData,
        growth_scores: growthScores,
        achievements: achievements,
        marshmallow_message: marshmallowMessage,
        summary: summary,
        is_generated: true
      })
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Failed to generate growth report');
    }
    reportId = data[0].id;
  }

  return {
    id: reportId,
    user_id: userId,
    report_type: reportType,
    report_date: now,
    mood_data: moodData,
    growth_scores: growthScores,
    achievements: achievements,
    marshmallow_message: marshmallowMessage,
    summary: summary,
    is_generated: true
  };
};

// ============= 報告查詢 =============

// 獲取用戶的成長報告列表
export const getGrowthReports = async (userId: string): Promise<GrowthReport[]> => {
  const { data, error } = await supabase
    .from('growth_reports')
    .select('*')
    .eq('user_id', userId)
    .order('report_date', { ascending: false });

  if (error) throw error;

  return data?.map(report => ({
    id: report.id,
    user_id: report.user_id,
    report_type: report.report_type,
    report_date: new Date(report.report_date),
    mood_data: report.mood_data || [],
    growth_scores: report.growth_scores || {
      social: 50,
      confidence: 50,
      work: 50,
      health: 50,
      courage: 50
    },
    achievements: report.achievements || [],
    marshmallow_message: report.marshmallow_message || '',
    summary: report.summary || {
      total_diary_entries: 0,
      total_chat_messages: 0,
      average_mood: 0,
      streak_days: 0,
      top_category: ''
    },
    is_generated: report.is_generated || false
  })) || [];
};

// 獲取最新的成長報告
export const getLatestGrowthReport = async (
  userId: string,
  reportType: ReportType = 'monthly'
): Promise<GrowthReport | null> => {
  const { data, error } = await supabase
    .from('growth_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_type', reportType)
    .order('report_date', { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    return null;
  }

  const report = data[0];
  return {
    id: report.id,
    user_id: report.user_id,
    report_type: report.report_type,
    report_date: new Date(report.report_date),
    mood_data: report.mood_data || [],
    growth_scores: report.growth_scores || {
      social: 50,
      confidence: 50,
      work: 50,
      health: 50,
      courage: 50
    },
    achievements: report.achievements || [],
    marshmallow_message: report.marshmallow_message || '',
    summary: report.summary || {
      total_diary_entries: 0,
      total_chat_messages: 0,
      average_mood: 0,
      streak_days: 0,
      top_category: ''
    },
    is_generated: report.is_generated || false
  };
};

// 獲取特定日期的報告
export const getGrowthReportByDate = async (
  userId: string,
  reportDate: string,
  reportType: ReportType = 'monthly'
): Promise<GrowthReport | null> => {
  const { data, error } = await supabase
    .from('growth_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_type', reportType)
    .eq('report_date', reportDate)
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    return null;
  }

  const report = data[0];
  return {
    id: report.id,
    user_id: report.user_id,
    report_type: report.report_type,
    report_date: new Date(report.report_date),
    mood_data: report.mood_data || [],
    growth_scores: report.growth_scores || {
      social: 50,
      confidence: 50,
      work: 50,
      health: 50,
      courage: 50
    },
    achievements: report.achievements || [],
    marshmallow_message: report.marshmallow_message || '',
    summary: report.summary || {
      total_diary_entries: 0,
      total_chat_messages: 0,
      average_mood: 0,
      streak_days: 0,
      top_category: ''
    },
    is_generated: report.is_generated || false
  };
};

// ============= 報告管理 =============

// 更新成長報告（使用 AI 增強）
export const enhanceGrowthReportWithAI = async (
  userId: string,
  reportId: string,
  diaryEntries: DiaryEntry[]
): Promise<GrowthReport> => {
  // 這裡可以調用 AI 服務來生成更詳細的分析
  // 目前先使用本地計算的數據

  const { data, error } = await supabase
    .from('growth_reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Report not found');
  }

  const report = data[0];
  return {
    id: report.id,
    user_id: report.user_id,
    report_type: report.report_type,
    report_date: new Date(report.report_date),
    mood_data: report.mood_data || [],
    growth_scores: report.growth_scores || {
      social: 50,
      confidence: 50,
      work: 50,
      health: 50,
      courage: 50
    },
    achievements: report.achievements || [],
    marshmallow_message: report.marshmallow_message || '',
    summary: report.summary || {
      total_diary_entries: 0,
      total_chat_messages: 0,
      average_mood: 0,
      streak_days: 0,
      top_category: ''
    },
    is_generated: report.is_generated || false
  };
};

// 刪除成長報告
export const deleteGrowthReport = async (reportId: string): Promise<void> => {
  const { error } = await supabase
    .from('growth_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw error;
};

// 導出成長報告（分享功能）
export const exportGrowthReport = async (
  userId: string,
  reportId: string
): Promise<{
  report: GrowthReport;
  shareText: string;
}> => {
  const { data, error } = await supabase
    .from('growth_reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Report not found');
  }

  const report = data[0];
  const growthReport: GrowthReport = {
    id: report.id,
    user_id: report.user_id,
    report_type: report.report_type,
    report_date: new Date(report.report_date),
    mood_data: report.mood_data || [],
    growth_scores: report.growth_scores || {
      social: 50,
      confidence: 50,
      work: 50,
      health: 50,
      courage: 50
    },
    achievements: report.achievements || [],
    marshmallow_message: report.marshmallow_message || '',
    summary: report.summary || {
      total_diary_entries: 0,
      total_chat_messages: 0,
      average_mood: 0,
      streak_days: 0,
      top_category: ''
    },
    is_generated: report.is_generated || false
  };

  // 生成分享文字
  const shareText = `
🌸 棉花糖夥伴 - 成長報告 🌸

📅 報告期間：${report.report_date}
📝 總記錄天數：${growthReport.summary.total_diary_entries} 天
💝 平均心情指數：${growthReport.summary.average_mood}%

🏆 達成成就：
${growthReport.achievements.map(a => `- ${a.name}`).join('\n') || '尚未解鎖成就'}

💬 棉花糖的話：
${growthReport.marshmallow_message}

#棉花糖夥伴 #自信成長
  `.trim();

  return {
    report: growthReport,
    shareText
  };
};
