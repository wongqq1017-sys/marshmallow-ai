import { Language } from '../types';

// UI Translation Strings
export interface TranslationStrings {
  // General
  appName: string;
  
  // Navigation
  chat: string;
  explore: string;
  diary: string;
  report: string;
  settings: string;
  
  // Chat
  chatPlaceholder: string;
  send: string;
  
  // Settings
  personalSettings: string;
  notifications: string;
  notificationsDesc: string;
  encouragementSettings: string;
  subscription: string;
  appearance: string;
  privacy: string;
  help: string;
  logout: string;
  
  // Theme
  themeClassic: string;
  themeMint: string;
  themeLavender: string;
  
  // Language
  language: string;
  languageSettings: string;
  traditionalChinese: string;
  cantonese: string;
  
  // Profile
  editProfile: string;
  nickname: string;
  uploading: string;
  
  // Messages
  welcomeBack: string;
  thinking: string;
  
  // Tour
  tourWelcome: string;
  tourChat: string;
  tourExplore: string;
  tourDiary: string;
  tourReport: string;
  tourInteract: string;
  
  // Diary
  addDiary: string;
  diaryTitle: string;
  diaryContent: string;
  save: string;
  cancel: string;
  
  // Explore
  breathing: string;
  meditation: string;
  affirmations: string;
  visualization: string;
  
  // Notifications
  dailyReminder: string;
  dailyReminderDesc: string;
  growthReport: string;
  enableEncouragement: string;
  enableEncouragementDesc: string;
  pickupTime: string;
  offlineDelivery: string;
  offlineDeliveryDesc: string;
  
  // Subscription
  upgradePlan: string;
  premium: string;
  basic: string;
  monthly: string;
  yearly: string;
  save20: string;
  
  // Privacy
  biometricLock: string;
  biometricDesc: string;
  encryption: string;
  deleteAccount: string;
  
  // Help
  faq: string;
  contactSupport: string;
  
  // Tones
  gentle: string;
  humorous: string;
  rational: string;
  
  // Goals
  social: string;
  work: string;
  external: string;
  self: string;
  
  // Affirmations
  affirmationGenerated: string;
  
  // Misc
  back: string;
  next: string;
  done: string;
  close: string;
  confirm: string;
  loading: string;
  error: string;
  success: string;
}

export const translations: Record<Language, TranslationStrings> = {
  [Language.ZH_TW]: {
    // General
    appName: '棉花糖夥伴',
    
    // Navigation
    chat: '對話',
    explore: '探索',
    diary: '日記',
    report: '報告',
    settings: '設定',
    
    // Chat
    chatPlaceholder: '分享你的心情...',
    send: '傳送',
    
    // Settings
    personalSettings: '個人化設置',
    notifications: '通知偏好設定',
    notificationsDesc: '在早晨為你送上第一份勇氣',
    encouragementSettings: '鼓勵訊息設定',
    subscription: '訂閱方案管理',
    appearance: '應用程式外觀設定',
    privacy: '隱私與安全',
    help: '幫助與回饋',
    logout: '登出帳號',
    
    // Theme
    themeClassic: '經典橙',
    themeMint: '薄荷清風',
    themeLavender: '薰衣草柔和',
    
    // Language
    language: '語言',
    languageSettings: '語言設定',
    traditionalChinese: '繁體中文',
    cantonese: '廣東話',
    
    // Profile
    editProfile: '編輯個人資料',
    nickname: '暱稱',
    uploading: '上傳中...',
    
    // Messages
    welcomeBack: '歡迎回來！',
    thinking: '棉花糖正在思考...',
    
    // Tour
    tourWelcome: '歡迎來到棉花糖旅程！',
    tourChat: '暖心 AI 夥伴',
    tourExplore: '心靈探索功能',
    tourDiary: '自信日記記錄',
    tourReport: '成長報告週報',
    tourInteract: '與我互動',
    
    // Diary
    addDiary: '寫下今日自信',
    diaryTitle: '日記標題',
    diaryContent: '記錄今天的成就...',
    save: '儲存',
    cancel: '取消',
    
    // Explore
    breathing: '呼吸練習',
    meditation: '冥想',
    affirmations: '自我肯定',
    visualization: '自信噴發',
    
    // Notifications
    dailyReminder: '每日暖心提醒',
    dailyReminderDesc: '在早晨為你送上第一份勇氣',
    growthReport: '成長報告週報',
    enableEncouragement: '開啟每日鼓勵',
    enableEncouragementDesc: '棉花糖會在指定時間為你送上專屬的自信悄悄話',
    pickupTime: '預選送達時間',
    offlineDelivery: '離線送達說明',
    offlineDeliveryDesc: '開啟後，即使應用程式處於後台或關閉狀態，棉花糖也會透過系統通知準時出現唷！',
    
    // Subscription
    upgradePlan: '升級你的幸福等級',
    premium: '進階版 Premium',
    basic: '基礎版 Basic',
    monthly: '月',
    yearly: '年',
    save20: '省 20%',
    
    // Privacy
    biometricLock: '生物辨識鎖定',
    biometricDesc: '開啟 Face ID 或指紋解鎖',
    encryption: '對話加密保護',
    deleteAccount: '刪除個人帳號與所有紀錄',
    
    // Help
    faq: '常見問題',
    contactSupport: '聯繫客服棉花糖',
    
    // Tones
    gentle: '溫柔',
    humorous: '幽默',
    rational: '理性',
    
    // Goals
    social: '社交互動',
    work: '工作事業',
    external: '外在環境',
    self: '自我成長',
    
    // Affirmations
    affirmationGenerated: '今日肯定句',
    
    // Misc
    back: '返回',
    next: '下一步',
    done: '完成',
    close: '關閉',
    confirm: '確認',
    loading: '載入中...',
    error: '發生錯誤',
    success: '成功',
  },
  [Language.ZH_HK]: {
    // General
    appName: '棉花糖夥伴',
    
    // Navigation
    chat: '對話',
    explore: '探索',
    diary: '日記',
    report: '報告',
    settings: '設定',
    
    // Chat
    chatPlaceholder: '分享你嘅心情...',
    send: '傳送',
    
    // Settings
    personalSettings: '個人化設置',
    notifications: '通知偏好設定',
    notificationsDesc: '喺早晨為你送上第一份勇氣',
    encouragementSettings: '鼓勵訊息設定',
    subscription: '訂閱方案管理',
    appearance: '應用程式外觀設定',
    privacy: '隱私與安全',
    help: '幫助與回饋',
    logout: '登出帳號',
    
    // Theme
    themeClassic: '經典橙',
    themeMint: '薄荷清風',
    themeLavender: '薰衣草柔和',
    
    // Language
    language: '語言',
    languageSettings: '語言設定',
    traditionalChinese: '繁體中文',
    cantonese: '廣東話',
    
    // Profile
    editProfile: '編輯個人資料',
    nickname: '暱稱',
    uploading: '上傳緊...',
    
    // Messages
    welcomeBack: '歡迎返嚟！',
    thinking: '棉花糖嘅思考緊...',
    
    // Tour
    tourWelcome: '歡迎嚟到棉花糖旅程！',
    tourChat: '暖心 AI 夥伴',
    tourExplore: '心靈探索功能',
    tourDiary: '自信日記記錄',
    tourReport: '成長報告週報',
    tourInteract: '同我互動',
    
    // Diary
    addDiary: '寫下今日自信',
    diaryTitle: '日記標題',
    diaryContent: '記錄今日嘅成就...',
    save: '儲存',
    cancel: '取消',
    
    // Explore
    breathing: '呼吸練習',
    meditation: '冥想',
    affirmations: '自我肯定',
    visualization: '自信噴發',
    
    // Notifications
    dailyReminder: '每日暖心提醒',
    dailyReminderDesc: '喺早晨為你送上第一份勇氣',
    growthReport: '成長報告週報',
    enableEncouragement: '開啟每日鼓勵',
    enableEncouragementDesc: '棉花糖會喺指定時間為你送上專屬嘅自信悄悄話',
    pickupTime: '預設送達時間',
    offlineDelivery: '離線送達說明',
    offlineDeliveryDesc: '開啟後，即使應用程式處於後台或關閉狀態，棉花糖都會透過系統通知準時出現啊！',
    
    // Subscription
    upgradePlan: '升級你嘅幸福等級',
    premium: '進階版 Premium',
    basic: '基礎版 Basic',
    monthly: '月',
    yearly: '年',
    save20: '慳 20%',
    
    // Privacy
    biometricLock: '生物辨識鎖定',
    biometricDesc: '開啟 Face ID 或指紋解鎖',
    encryption: '對話加密保護',
    deleteAccount: '刪除個人帳號同所有紀錄',
    
    // Help
    faq: '常見問題',
    contactSupport: '聯繫客服棉花糖',
    
    // Tones
    gentle: '溫柔',
    humorous: '幽默',
    rational: '理性',
    
    // Goals
    social: '社交互動',
    work: '工作事業',
    external: '外在環境',
    self: '自我成長',
    
    // Affirmations
    affirmationGenerated: '今日肯定句',
    
    // Misc
    back: '返回',
    next: '下一步',
    done: '完成',
    close: '關閉',
    confirm: '確認',
    loading: '載入緊...',
    error: '發生錯誤',
    success: '成功',
  }
};

// Helper function to get translation
export function getTranslation(lang: Language): TranslationStrings {
  return translations[lang] || translations[Language.ZH_TW];
}
