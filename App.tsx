
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { AppView, DashboardTab, ExploreSubView, SettingsSubView, Tone, Category, DiaryEntry, UserProfile, ChatMessage, Language, GrowthReport, ReportType, GrowthArea } from './types';
import { createMarshmallowChat, sendMessage, generateAffirmation, generateVisualization, type MarshmallowChat, sendExploreVoiceMessage } from './services/geminiService';
import { generateDiaryResponse, getLocalComfortText } from './services/deepseekService';
import { AudioService } from './services/audioService';
import { generateGrowthReport, getLatestGrowthReport, getGrowthReports } from './services/reportService';
import { isSpeechSupported, isTtsSupported, startSpeechRecognition, speakText, cancelSpeech, setExternalTtsProvider } from './services/voiceService';
import { createQwenTtsProvider } from './services/externalTtsProvider';
import { createGTTsProvider } from './services/gttsProvider';
import { createEdgeTtsProvider } from './services/edgeTtsProvider';
import { createCantoneseTtsProvider } from './services/cantoneseTtsProvider';
import { createQwen3TtsProvider } from './services/qwen3TtsProvider';
import { createTextReadTtsProvider } from './services/textReadTtsProvider';
import { createEdgeProxyTtsProvider } from './services/edgeProxyTtsProvider';
import { TTS_CONFIG } from './services/ttsConfig';
// Supabase 服務
import { supabase } from './services/supabaseClient';
import { signIn, signUp, signOut, getCurrentUser, getSession, onAuthStateChange, resendVerificationEmail, signInWithGoogle, handleEmailConfirmation } from './services/authService';
import { getUserProfile, updateUserProfile, getChatHistory, saveChatHistory, getDiaryEntries, saveDiaryEntry, getUserSettings, updateUserSettings } from './services/storageService';

// --- 移除 iOS 輸入框焦點藍色邊框 ---
if (typeof window !== 'undefined') {
  // 創建樣式元素
  const style = document.createElement('style');
  style.id = 'ios-focus-fix';
  style.textContent = `
    input:focus, textarea:focus, select:focus, button:focus, [contenteditable]:focus {
      outline: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    * {
      -webkit-tap-highlight-color: transparent !important;
    }
    html, body {
      -webkit-focus-ring-color: transparent !important;
      outline: none !important;
    }
    .wk-textfield-focus {
      -webkit-user-select: none;
    }
  `;
  // 嘗試盡早注入樣式
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(style);
    });
  }
  
  // 監控並移除動態添加的藍色邊框
  const observer = new MutationObserver(() => {
    document.querySelectorAll('input, textarea, select, button').forEach((el: any) => {
      el.style.outline = 'none';
      el.style.webkitTapHighlightColor = 'transparent';
      el.style.boxShadow = 'none';
    });
  });
  if (document.body) {
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    });
  }
}

// --- Utilities for Voice Reply Normalization ---

const MAX_VOICE_REPLY_CHARS = 40;

const isSuspiciousVoiceReply = (text: string): boolean => {
  const lower = text.toLowerCase();
  const suspiciousEnglish = ['system prompt', 'debug', 'test', 'example', 'sample', 'trial', 'testtest', '123', 'abc'];
  const suspiciousChinese = ['測試', '系統提示', '範例', '示範', '這是', '以下', '範例回覆', '示範回覆', '測試內容'];
  // 檢查是否只有數字或英文字母（可能是測試）
  const isOnlyAlphanumeric = /^[a-zA-Z0-9\s.,!?]+$/.test(text) && text.length < 20;
  if (suspiciousEnglish.some(k => lower.includes(k))) return true;
  if (suspiciousChinese.some(k => text.includes(k))) return true;
  if (isOnlyAlphanumeric) return true;
  return false;
};

const normalizeVoiceReply = (text: string): string => {
  if (!text) return '';
  let result = text.trim();

  // 取第一句（以句號/問號/驚嘆號為界）
  const sentenceEndMatch = result.search(/[。？！?!]/);
  if (sentenceEndMatch !== -1) {
    result = result.slice(0, sentenceEndMatch + 1);
  }

  // 限制長度
  if (result.length > MAX_VOICE_REPLY_CHARS) {
    result = result.slice(0, MAX_VOICE_REPLY_CHARS).trimEnd() + '…';
  }

  // 確保結尾溫柔標點（若沒有句號/波浪/emoji）
  const softEndPattern = /[。！？?!～~）\)\]\]}]|[\u{1F300}-\u{1FAFF}]$/u;
  if (!softEndPattern.test(result)) {
    result = result + '。';
  }

  return result;
};

// --- Meditation Data ---
const MEDITATION_PLAYLIST = [
  // 引導式冥想（使用本地音訊）
  { id: '1', title: '舒緩焦慮', desc: '讓緊繃的心靈像棉花糖般柔軟', time: '02:35', icon: 'air', color: 'text-blue-500', bg: 'bg-blue-100', url: '/audio/舒緩焦慮 冥想.mp3', isMusicOnly: false },
  { id: '2', title: '建立自信', desc: '發掘內心深處那道溫溫的光芒', time: '03:15', icon: 'auto_awesome', color: 'text-candy-orange', bg: 'bg-orange-100', url: '/audio/自信.wav', isMusicOnly: false },
  { id: '3', title: '睡前放鬆', desc: '準備進入一個充滿安全感的夢境', time: '04:20', icon: 'dark_mode', color: 'text-indigo-400', bg: 'bg-indigo-100', url: '/audio/睡眠冥想.mp3', isMusicOnly: false },
  { id: '4', title: '晨間喚醒', desc: '用溫溫的正能量開啟新的一天', time: '03:50', icon: 'sunny', color: 'text-amber-500', bg: 'bg-amber-100', url: 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e02f9.mp3', isMusicOnly: false },
  { id: '5', title: '專注當下', desc: '在喧囂中找回平靜的自己', time: '05:00', icon: 'center_focus_weak', color: 'text-emerald-500', bg: 'bg-emerald-100', url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808f3030c.mp3', isMusicOnly: false },
  { id: '6', title: '接納情緒', desc: '溫柔地擁抱每一種心情', time: '02:45', icon: 'favorite', color: 'text-pink-400', bg: 'bg-pink-100', url: 'https://cdn.pixabay.com/audio/2021/11/24/audio_8236f60f60.mp3', isMusicOnly: false },
  // 純音樂練習
  { id: '7', title: '純音樂：海洋寧靜', desc: '讓海浪聲與純淨音樂帶你進入深度放鬆', time: '05:00', icon: 'music_note', color: 'text-purple-500', bg: 'bg-purple-100', url: '/audio/5 Minute Timer - Relaxing Music with Ocean Waves.mp3', isMusicOnly: true },
  { id: '8', title: '純音樂：心靈療癒', desc: '無需言語，只有音樂與你的內心對話', time: '05:00', icon: 'spa', color: 'text-teal-500', bg: 'bg-teal-100', url: '/audio/5 Minute Timer with Relaxing Music and Alarm.mp3', isMusicOnly: true },
  { id: '9', title: '純音樂：專注冥想', desc: '純音樂陪伴，專注當下的每一刻', time: '04:45', icon: 'self_improvement', color: 'text-violet-500', bg: 'bg-violet-100', url: 'https://cdn.pixabay.com/audio/2022/10/03/audio_8204212c46.mp3', isMusicOnly: true },
  { id: '10', title: '純音樂：深度放鬆', desc: '讓音樂的節奏引導你進入完全放鬆的狀態', time: '07:15', icon: 'bedtime', color: 'text-slate-500', bg: 'bg-slate-100', url: 'https://cdn.pixabay.com/audio/2022/11/20/audio_91b32e02f9.mp3', isMusicOnly: true },
  { id: '11', title: '純音樂：清晨能量', desc: '用純音樂喚醒身心，迎接美好的一天', time: '04:00', icon: 'wb_twilight', color: 'text-rose-500', bg: 'bg-rose-100', url: 'https://cdn.pixabay.com/audio/2022/12/05/audio_1808f3030c.mp3', isMusicOnly: true },
  // 使用你提供的三個新純音樂音訊
  { id: '12', title: '純音樂：靜心放鬆', desc: '柔和的旋律陪你做一個 5 分鐘的靜心小休息', time: '05:00', icon: 'self_improvement', color: 'text-emerald-500', bg: 'bg-emerald-100', url: '/audio/5 Minute Timer - Relaxing Music.mp3', isMusicOnly: true },
  { id: '13', title: '純音樂：柔和細雨', desc: '像細雨一樣溫柔的音樂，幫你慢慢安定下來', time: '05:00', icon: 'rainy', color: 'text-sky-500', bg: 'bg-sky-100', url: '/audio/5 Minute Timer - Soft Music.mp3', isMusicOnly: true },
  { id: '14', title: '純音樂：十分鐘深度放鬆', desc: '給自己十分鐘，好好讓身心一起慢慢鬆開', time: '10:00', icon: 'timelapse', color: 'text-cyan-500', bg: 'bg-cyan-100', url: '/audio/10 Minute Timer - Calm Music for Relaxing.mp3', isMusicOnly: true }
];

// --- 本地視覺化練習腳本 ---
const LOCAL_VISUALIZATIONS: Record<Category, string[]> = {
  [Category.SOCIAL]: [
    "想像你走進一個充滿笑聲的聚會，你帶著自信的微笑，每個人都感受到你溫暖的氣場。你輕鬆地與人交談，感到無比自在。✨",
    "想像你在對話中侃侃而談，你的觀點被大家認可，你感到自己是連結大家的核心力量。🌸"
  ],
  [Category.WORK]: [
    "想像你在一個重要的會議上，清晰且堅定地表達你的想法。同事們投來讚賞的眼光，你感到前所未有的掌控感與成就。🚀",
    "想像你成功解決了一個難題，桌上放著你滿意的作品，你深知自己的才華正在發光。✨"
  ],
  [Category.EXTERNAL]: [
    "想像你走在街上，陽光灑在你身上。你感到自己的儀態自信大方，每一根髮絲都散發著迷人的魅力。💖",
    "想像你穿著最喜歡的衣服，對著鏡子微笑，你深深愛著這個獨特且動人的自己。🌸"
  ],
  [Category.SELF]: [
    "想像你坐在一片寧靜的湖邊，內心充滿了平靜與愛。你接受了自己所有的不完美，感到無比的完整與強大。🌱",
    "想像你擁抱了那個曾經膽怯的小自己，告訴他：『現在有我在，我們很棒。』✨"
  ]
};

// --- Theme Definitions ---

const THEMES: Record<string, { primary: string, candyOrange: string, creamBg: string, softText: string }> = {
  'Classic Orange': {
    primary: "#FF9F43",
    candyOrange: "#FF8A5C",
    creamBg: "#FFFDF5",
    softText: "#5D5747",
  },
  'Mint Breeze': {
    primary: "#A8E6CF",
    candyOrange: "#5BCFB1",
    creamBg: "#F0F9F6",
    softText: "#2D4030",
  },
  'Lavender Soft': {
    primary: "#D1C4E9",
    candyOrange: "#9575CD",
    creamBg: "#F3E5F5",
    softText: "#4A148C",
  }
};

const applyThemeToDOM = (themeName: string) => {
  const theme = THEMES[themeName] || THEMES['Classic Orange'];
  const styleId = 'marshmallow-theme-overrides';
  let styleTag = document.getElementById(styleId);
  
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = styleId;
    document.head.appendChild(styleTag);
  }

  styleTag.innerHTML = `
    :root {
      --theme-primary: ${theme.primary};
      --theme-candy-orange: ${theme.candyOrange};
      --theme-cream-bg: ${theme.creamBg};
      --theme-soft-text: ${theme.softText};
    }
    .bg-cream-bg { background-color: ${theme.creamBg} !important; }
    .bg-candy-orange { background-color: ${theme.candyOrange} !important; }
    .text-soft-text { color: ${theme.softText} !important; }
    .text-candy-orange { color: ${theme.candyOrange} !important; }
    .border-candy-orange { border-color: ${theme.candyOrange} !important; }
    .border-bubble-border { border-color: ${theme.candyOrange}33 !important; }
    .ios-button-marshmallow { 
      background: linear-gradient(180deg, ${theme.primary} 0%, ${theme.candyOrange} 100%) !important; 
      box-shadow: 0 8px 0px ${theme.candyOrange}CC !important; 
    }
    .ios-button-marshmallow:active {
      box-shadow: 0 2px 0px ${theme.candyOrange}CC !important;
      transform: translateY(4px);
    }
    .ios-input { border-color: ${theme.candyOrange}20 !important; }
    .ios-input:focus { border-color: ${theme.candyOrange}80 !important; }
    .chip-active { 
      background-color: ${theme.candyOrange} !important; 
      border-color: ${theme.candyOrange} !important; 
    }
    .ios-chat-bubble-user { background-color: ${theme.candyOrange} !important; }
    .garden-gradient { 
      background: linear-gradient(180deg, ${theme.creamBg} 0%, ${theme.primary}40 60%, ${theme.candyOrange}50 100%) !important; 
    }
    .marshmallow-ai {
      background: radial-gradient(circle at 30% 30%, #ffffff 0%, ${theme.creamBg} 100%) !important;
    }
    .marshmallow-ai-bust {
      background: radial-gradient(circle at 30% 30%, #ffffff 0%, ${theme.creamBg} 100%) !important;
    }
    .bubble-pattern {
      background-image: radial-gradient(circle, ${theme.primary}20 20%, transparent 20%),
                        radial-gradient(circle, ${theme.candyOrange}15 20%, transparent 20%) !important;
    }
  `;
};

// --- Particle Background Component ---
const ParticleBackground: React.FC = () => {
  const particles = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 10}s`,
    duration: `${8 + Math.random() * 7}s`,
    size: `${4 + Math.random() * 8}px`
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40 z-0">
      {particles.map(p => (
        <div 
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size
          }}
        />
      ))}
    </div>
  );
};

// --- Sub-components: Guided Tour ---

interface TourStep {
  title: string;
  content: string;
  targetId?: string;
  position: 'top' | 'bottom' | 'center';
}

const GuidedTour: React.FC<{ steps: TourStep[], onComplete: () => void }> = ({ steps, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];

  const handleNext = () => {
    AudioService.playTick();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      AudioService.playSuccess();
      onComplete();
    }
  };

  return (
    <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onComplete}></div>
      
      <div className={`relative z-[210] w-[85%] max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl transition-all transform duration-500 scale-100 ${step.position === 'bottom' ? 'mt-auto mb-32' : step.position === 'top' ? 'mb-auto mt-32' : ''}`}>
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 marshmallow-bounce">
          <div className="marshmallow-ai-bust w-24 h-20 flex flex-col items-center justify-center border-4 border-white relative overflow-hidden shadow-lg bg-white">
            <div className="flex gap-4 mb-1.5">
              <div className="w-3 h-1.5 border-t-[2.5px] border-soft-text rounded-full mt-1"></div>
              <div className="w-3 h-1.5 border-t-[2.5px] border-soft-text rounded-full mt-1"></div>
            </div>
            <div className="absolute bottom-5 flex items-center justify-center">
              <div className="w-5 h-2.5 border-b-[2.5px] border-candy-orange/80 rounded-full"></div>
            </div>
            <div className="absolute bottom-7 left-3 w-3 h-1.5 bg-pink-200/60 blur-[1px] rounded-full"></div>
            <div className="absolute bottom-7 right-3 w-3 h-1.5 bg-pink-200/60 blur-[1px] rounded-full"></div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-[3px] border-white rounded-full shadow-sm"></div>
        </div>

        <div className="mt-8 text-center">
          <div className="flex justify-center items-center gap-1 mb-2">
             {steps.map((_, i) => (
               <div key={i} className={`h-1 rounded-full transition-all ${i === currentStep ? 'w-6 bg-candy-orange' : 'w-2 bg-orange-100'}`}></div>
             ))}
          </div>
          <h3 className="text-xl font-bold text-soft-text mb-3">{step.title}</h3>
          <p className="text-soft-text/70 text-sm leading-relaxed mb-8 font-medium">{step.content}</p>
          
          <div className="flex gap-3">
            <button 
              onClick={() => { AudioService.playTick(); onComplete(); }}
              className="flex-1 h-12 rounded-2xl border-2 border-orange-50 text-soft-text/40 font-bold text-sm active:bg-gray-50 transition-colors"
            >
              跳過
            </button>
            <button 
              onClick={handleNext} 
              className="flex-[2] ios-button-marshmallow h-12 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <span>{currentStep === steps.length - 1 ? '開始旅程' : '下一步'}</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components: Common ---

const LegalScreen: React.FC<{ title: string, content: string, onBack: () => void }> = ({ title, content, onBack }) => (
  <div className="relative h-full w-full flex flex-col bubble-pattern px-6 pb-8 bg-cream-bg app-safe-header">
    <div className="flex items-center justify-start mb-8">
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 cursor-pointer transition-transform active:scale-90" onClick={() => { AudioService.playTick(); onBack(); }}>
        <span className="material-symbols-outlined text-xl text-soft-text/60">close</span>
      </div>
    </div>
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2 text-soft-text">{title}</h1>
      <div className="h-1.5 w-12 bg-candy-orange mx-auto rounded-full"></div>
    </div>
    <div className="flex-1 overflow-y-auto bg-white/60 rounded-[2.5rem] p-8 border-2 border-white shadow-inner no-scrollbar">
      <div className="text-soft-text/80 leading-relaxed whitespace-pre-wrap font-medium text-sm">
        {content}
      </div>
    </div>
    <div className="mt-8">
      <button onClick={() => { AudioService.playTick(); onBack(); }} className="ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center transition-all">
        <span>我瞭解了</span>
      </button>
    </div>
  </div>
);

// --- Sub-components: Onboarding ---

// 調試日誌函數
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[DEBUG ${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
  console.log(logEntry);
  // 發送到 NDJSON 日誌伺服器
  try {
    fetch('http://127.0.0.1:7245/ingest/2b73ad25-fd9c-4da8-95fb-3d30aaecdd2e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'App.tsx:WelcomeScreen',
        message: message,
        data: data,
        timestamp: Date.now(),
        runId: 'initial'
      })
    }).catch(() => {});
  } catch (e) {}
};

const WelcomeScreen: React.FC<{ onNext: () => void, onLogin: () => void }> = ({ onNext, onLogin }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // #region agent debug log
  useEffect(() => {
    debugLog('WelcomeScreen MOUNTED');
    debugLog('Window dimensions', { w: window.innerWidth, h: window.innerHeight });
    debugLog('Body dimensions', { w: document.body.clientWidth, h: document.body.clientHeight });
    
    const checkDimensions = () => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        debugLog('Container rect', containerRect);
      }
      if (scrollRef.current) {
        const scrollRect = scrollRef.current.getBoundingClientRect();
        debugLog('Scroll container rect', {
          width: scrollRect.width,
          height: scrollRect.height,
          scrollWidth: scrollRef.current.scrollWidth,
          scrollHeight: scrollRef.current.scrollHeight,
          clientWidth: scrollRef.current.clientWidth,
          clientHeight: scrollRef.current.clientHeight,
          offsetLeft: scrollRef.current.offsetLeft,
          offsetTop: scrollRef.current.offsetTop
        });
        
        // 檢查子元素
        const cards = scrollRef.current.querySelectorAll('.feature-card-bouncy');
        debugLog('Card count', cards.length);
        cards.forEach((card, i) => {
          const cardRect = card.getBoundingClientRect();
          debugLog(`Card ${i} rect`, cardRect);
        });
      }
    };
    
    // 延遲檢查以確保 DOM 渲染完成
    setTimeout(checkDimensions, 500);
    setTimeout(checkDimensions, 1000);
    setTimeout(checkDimensions, 2000);
    window.addEventListener('resize', checkDimensions);
    return () => window.removeEventListener('resize', checkDimensions);
  }, []);
  // #endregion
  
  return (
  <div ref={containerRef} className="relative h-full w-full flex flex-col bubble-pattern overflow-visible">
    <ParticleBackground />
    <div className="flex items-center justify-between px-4 pb-4 z-10 shrink-0 app-safe-header">
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 text-soft-text/30">
        <span className="material-symbols-outlined text-xl">close</span>
      </div>
      <div className="px-5 py-1.5 rounded-full bg-bubble-green/30 border-2 border-white text-xs font-bold tracking-wider text-emerald-700 uppercase">
        Hello Friend!
      </div>
      <div 
        className="text-candy-orange font-bold text-sm bg-white/60 px-4 py-1.5 rounded-full border-2 border-white cursor-pointer active:scale-95 transition-transform"
        onClick={() => { AudioService.playTick(); onLogin(); }}
      >
        跳過
      </div>
    </div>

    <div className="flex flex-col items-center justify-center pt-0 pb-0 px-1 relative shrink-0">
      <div className="relative w-48 h-48 mb-2 flex items-center justify-center">
        <div className="absolute inset-0 bg-yellow-200/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="marshmallow-ai relative z-10 w-36 h-36 flex items-center justify-center border-4 border-white overflow-hidden">
          <div className="flex gap-8 mt-[-10px] items-center justify-center w-full">
            <div className="relative w-4 h-5 bg-soft-text rounded-full shrink-0">
              <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
            <div className="relative w-4 h-5 bg-soft-text rounded-full shrink-0">
              <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
          <div className="absolute bottom-10 left-8 w-4 h-2 bg-pink-200 blur-sm rounded-full"></div>
          <div className="absolute bottom-10 right-8 w-4 h-2 bg-pink-200 blur-sm rounded-full"></div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-6 h-3 border-b-2 border-soft-text/60 rounded-full"></div>
        </div>
        <div className="absolute top-4 right-4 w-8 h-8 bg-white/80 rounded-full shadow-sm flex items-center justify-center">
          <span className="material-symbols-outlined text-candy-orange text-lg">favorite</span>
        </div>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-center mb-0">
        擁抱你的<span className="text-candy-orange">暖心時刻</span>
      </h1>
      <p className="text-soft-text/70 text-center text-sm px-8 leading-relaxed font-medium">
        就像躺在雲朵上一樣輕鬆，<br/>讓我們一起慢慢變自信吧！
      </p>
    </div>

    <div className="flex-1 flex flex-col justify-start overflow-visible min-h-0 py-2">
      <div ref={scrollRef} className="flex overflow-x-auto overflow-y-visible no-scrollbar snap-x snap-mandatory gap-4 px-8 py-2 items-start h-[40vh] min-h-[240px] max-h-[360px]">
        <div className="snap-center shrink-0 w-[210px] h-[220px] feature-card-bouncy border-b-4 border-bubble-green p-5 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-[1rem] bg-orange-100 flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="material-symbols-outlined text-candy-orange text-2xl">face_6</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1">棉花糖 AI 夥伴</h3>
            <p className="text-soft-text/70 text-[11px] leading-relaxed">
              溫柔、耐心、懂你的每一份小情緒。
            </p>
          </div>
          <div className="mt-auto pt-2 border-t border-dashed border-bubble-border flex items-center gap-2">
            <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">With you</span>
          </div>
        </div>
        <div className="snap-center shrink-0 w-[210px] h-[220px] feature-card-bouncy border-b-4 border-bubble-green p-5 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-[1rem] bg-blue-100 flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="material-symbols-outlined text-blue-400 text-2xl">graphic_eq</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1">聲音抱抱</h3>
            <p className="text-soft-text/70 text-[11px] leading-relaxed">
              輕聲細語，把不安都化作溫慢音符流走。
            </p>
          </div>
          <div className="mt-auto pt-2 border-t border-dashed border-bubble-border flex items-center gap-2">
            <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">Soft Connection</span>
          </div>
        </div>
        <div className="snap-center shrink-0 w-[210px] h-[220px] feature-card-bouncy border-b-4 border-bubble-green p-5 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="material-symbols-outlined text-indigo-500 text-2xl">psychology</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1">心靈探索</h3>
            <p className="text-soft-text/70 text-[11px] leading-relaxed">
              透過冥想與呼吸，找回內在平靜與力量。
            </p>
          </div>
          <div className="mt-auto pt-2 border-t border-dashed border-bubble-border flex items-center gap-2">
            <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider">Peaceful Mind</span>
          </div>
        </div>
        <div className="snap-center shrink-0 w-[210px] h-[220px] feature-card-bouncy border-b-4 border-bubble-green p-5 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-[1rem] bg-rose-50 flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="material-symbols-outlined text-rose-400 text-2xl">edit_note</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1">自信日記</h3>
            <p className="text-soft-text/70 text-[11px] leading-relaxed">
              記錄微小的成就，灌溉你的自信花園。
            </p>
          </div>
          <div className="mt-auto pt-2 border-t border-dashed border-bubble-border flex items-center gap-2">
            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider">Daily Bloom</span>
          </div>
        </div>
        <div className="snap-center shrink-0 w-[210px] h-[220px] feature-card-bouncy border-b-4 border-bubble-green p-5 flex flex-col gap-3">
          <div className="w-12 h-12 rounded-[1rem] bg-bubble-green/40 flex items-center justify-center border-2 border-white shadow-inner shrink-0">
            <span className="material-symbols-outlined text-emerald-600 text-2xl">auto_awesome</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold mb-1">自信大挑戰</h3>
            <p className="text-soft-text/70 text-[11px] leading-relaxed">
              像玩遊戲一樣解鎖任務，開花結果。
            </p>
          </div>
          <div className="mt-auto pt-2 border-t border-dashed border-bubble-border flex items-center gap-2">
            <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Fun Growth</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-1">
        <div className="h-2 w-6 rounded-full bg-candy-orange shadow-sm"></div>
        <div className="h-2 w-2 rounded-full bg-white border-2 border-bubble-border"></div>
        <div className="h-2 w-2 rounded-full bg-white border-2 border-bubble-border"></div>
      </div>
    </div>

    <div className="p-8 pb-8 flex flex-col gap-10 shrink-0">
      <button 
        onClick={() => { AudioService.playTick(); onLogin(); }}
        className="ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center gap-3 transition-transform active:translate-y-1 active:shadow-none shadow-xl"
      >
        <span>開始幸福冒險</span>
        <span className="material-symbols-outlined font-bold">arrow_forward_ios</span>
      </button>
      <div className="flex justify-center items-center gap-2 opacity-30">
        <div className="h-[1px] w-8 bg-soft-text"></div>
        <p className="text-[10px] tracking-widest uppercase font-bold text-soft-text">
          Pure & Innocent Experience
        </p>
        <div className="h-[1px] w-8 bg-soft-text"></div>
      </div>
    </div>
    <div className="absolute -top-10 -left-10 w-40 h-40 bg-bubble-green/20 blur-2xl rounded-full pointer-events-none"></div>
    <div className="absolute top-1/2 -right-12 w-32 h-32 bg-orange-200/20 blur-2xl rounded-full pointer-events-none"></div>
  </div>
);
};

const LoginScreen: React.FC<{ onBack: () => void, onLogin: () => void, onLoginWithData?: (userId: string, profile: any) => void, onSignup?: () => void }> = ({ onBack, onLogin, onLoginWithData, onSignup }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('請填寫郵箱和密碼');
      return;
    }
    AudioService.playTick();
    setIsLoggingIn(true);
    setError('');

    try {
      const { user, session } = await signIn(email, password);
      if (user) {
        AudioService.playSuccess();
        if (onLoginWithData) {
          // 加載用戶數據
          const profile = await getUserProfile(user.id).catch(() => null);
          onLoginWithData(user.id, profile);
        } else {
          onLogin();
        }
      }
    } catch (err: any) {
      console.error('登入錯誤:', err);
      setError(err.message || '登入失敗，請檢查郵箱和密碼');
      AudioService.playTick();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      AudioService.playTick();
      setIsLoggingIn(true);
      setError('');

      await signInWithGoogle();
      // Supabase 會自動跳轉到 Google 登入頁面
      // 登入完成後會自動跳回來的頁面，並觸發 onAuthStateChange
    } catch (error: any) {
      console.error('Google login error:', error);
      setError('Google 登入失敗，請稍後再試');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col bubble-pattern px-6 pb-8 bg-cream-bg app-safe-header">
      <div className="flex items-center justify-start mb-8">
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 cursor-pointer transition-transform active:scale-90" onClick={() => { AudioService.playTick(); onBack(); }}>
          <span className="material-symbols-outlined text-xl text-soft-text/60">arrow_back_ios_new</span>
        </div>
      </div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">歡迎回來，<span className="text-candy-orange">朋友</span></h1>
        <p className="text-soft-text/60 text-sm font-medium">今天有什麼開心的事想分享嗎？</p>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-5">
        <div className="space-y-1.5">
          <label className="ml-4 text-xs font-bold text-soft-text/50 uppercase tracking-widest">電子郵件</label>
          <input 
            className="ios-input" 
            placeholder="hello@example.com" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="ml-4 text-xs font-bold text-soft-text/50 uppercase tracking-widest">密碼</label>
          <div className="relative">
            <input 
              className="ios-input" 
              placeholder="請輸入密碼" 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button 
              type="button"
              onClick={() => { AudioService.playTick(); setShowPassword(!showPassword); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-soft-text/40 hover:text-candy-orange transition-colors"
            >
              <span className="material-symbols-outlined">{showPassword ? "visibility" : "visibility_off"}</span>
            </button>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-4">
        <button 
          onClick={handleEmailLogin} 
          disabled={isLoggingIn}
          className="ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center gap-3"
        >
          {isLoggingIn ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>登入中...</span>
            </div>
          ) : (
            <>
              <span>登入</span>
              <span className="material-symbols-outlined font-bold">login</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-4 my-4 px-4">
          <div className="h-[1px] flex-1 bg-soft-text/10"></div>
          <span className="text-[11px] font-bold text-soft-text/25 uppercase tracking-[0.15em]">或使用快速登入</span>
          <div className="h-[1px] flex-1 bg-soft-text/10"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={isLoggingIn}
          className={`w-full h-16 bg-white border-2 border-orange-50/50 rounded-[2.5rem] shadow-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:shadow-inner relative overflow-hidden ${isLoggingIn ? 'opacity-70 pointer-events-none' : ''}`}
        >
          {isLoggingIn ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-3 border-candy-orange/30 border-t-candy-orange rounded-full animate-spin"></div>
              <span className="text-soft-text/60 font-bold text-sm italic">正在連接 Google...</span>
            </div>
          ) : (
            <>
              <div className="w-6 h-6 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              <span className="text-soft-text font-bold text-[15px]">使用 Google 帳號登入</span>
            </>
          )}
        </button>
      </div>
      <div className="mt-auto pt-6 text-center">
        <p className="text-[13px] text-soft-text/40 font-medium">
          還沒有帳號嗎？ <span onClick={() => { AudioService.playTick(); onSignup?.(); }} className="text-candy-orange font-black cursor-pointer hover:underline underline-offset-2 transition-all">立即註冊旅程</span>
        </p>
      </div>
    </div>
  );
};

const SignupStep1: React.FC<{ 
  profile: UserProfile, 
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>, 
  onNext: () => void,
  onBack: () => void,
  onLogin: () => void,
  onViewTerms: () => void,
  onViewPrivacy: () => void,
  password?: string,
  setPassword?: (p: string) => void,
  onSignupComplete?: (userId: string, needsConfirmation: boolean) => void
}> = ({ profile, setProfile, onNext, onBack, onLogin, onViewTerms, onViewPrivacy, password, setPassword, onSignupComplete }) => {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleNext = async () => {
    if (!agreed) {
      setError('請先閱讀並同意服務條款');
      return;
    }
    if (!profile.email || !password) {
      setError('請填寫郵箱和密碼');
      return;
    }
    if (password && password.length < 6) {
      setError('密碼至少需要 6 個字元');
      return;
    }
    
    setIsLoading(true);
    AudioService.playTick();
    
    try {
      // 嘗試註冊
      const { user, needsConfirmation } = await signUp({
        email: profile.email,
        password: password,
        nickname: profile.nickname
      });
      
      // 通知父組件註冊結果
      if (onSignupComplete) {
        onSignupComplete(user?.id || '', needsConfirmation);
      }
      
      // 繼續到下一步
      onNext();
    } catch (error: any) {
      console.error('註冊錯誤:', error);
      const errorMsg = error?.message || '';
      
      // 即使遇到 rate limit，仍然允許用戶繼續
      // 通知父組件註冊失敗，但仍然允許進入應用
      if (onSignupComplete) {
        onSignupComplete('', true); // 傳入空的 userId，needsConfirmation 為 true
      }
      
      // 仍然繼續到下一步，讓用戶可以完成設定並進入應用
      setIsLoading(false);
      onNext(); // 仍然繼續到下一步
    }
  };

  // 重新發送驗證郵件
  const handleResendVerificationEmail = async () => {
    if (!profile.email) {
      alert('請先填寫電子郵件');
      return;
    }
    
    setIsResending(true);
    try {
      await resendVerificationEmail(profile.email);
      AudioService.playSuccess();
      alert('✅ 驗證郵件已重新發送！請檢查你的郵箱。');
    } catch (error: any) {
      console.error('重新發送驗證郵件失敗:', error);
      AudioService.playTick();
      if (error?.message?.includes('rate limit')) {
        alert('⚠️ 發送次數過多，請稍後再試。');
      } else {
        alert('⚠️ 發送失敗，請稍後再試。');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden bg-cream-bg">
      <div className="px-6 pb-6 z-10 app-safe-header">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 cursor-pointer transition-transform active:scale-90" onClick={() => { AudioService.playTick(); onBack(); }}>
            <span className="material-symbols-outlined text-xl text-soft-text/60">arrow_back_ios_new</span>
          </div>
          <div className="font-bold text-soft-text/60">步驟 1 / 4</div>
          <div className="w-10 h-10"></div>
        </div>
        <div className="h-2 bg-white rounded-full border border-bubble-border overflow-hidden">
          <div className="h-full bg-candy-orange transition-all duration-500" style={{ width: '25%' }}></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pb-10 z-10 overflow-y-auto no-scrollbar">
        <div className="text-center mb-10 mt-2">
          <h1 className="text-[2.2rem] font-black tracking-tight mb-2 text-soft-text">為你的旅程<span className="text-candy-orange">取個名字</span></h1>
          <p className="text-soft-text/60 text-[0.95rem] font-medium">讓我們更了解你，開始這段溫溫的冒險</p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <label className="ml-1 text-sm font-bold text-soft-text/70">你的暱稱</label>
            <input 
              value={profile.nickname}
              onChange={(e) => setProfile(prev => ({ ...prev, nickname: e.target.value }))}
              className="ios-input !py-5 shadow-sm border-gray-100" 
              placeholder="例如：小棉花糖" 
              type="text"
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-sm font-bold text-soft-text/70">電子郵件</label>
            <input 
              value={profile.email}
              onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
              className="ios-input !py-5 shadow-sm border-gray-100" 
              placeholder="hello@example.com" 
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-sm font-bold text-soft-text/70">設定密碼</label>
            <div className="relative">
              <input 
                className="ios-input !py-5 shadow-sm border-gray-100" 
                placeholder="至少 6 位字元" 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword?.(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => { AudioService.playTick(); setShowPassword(!showPassword); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-soft-text/40 hover:text-candy-orange transition-colors"
              >
                <span className="material-symbols-outlined">{showPassword ? "visibility" : "visibility_off"}</span>
              </button>
            </div>
          </div>

          {/* 重新發送驗證郵件按鈕 */}
          <button 
            onClick={handleResendVerificationEmail}
            disabled={isResending || !profile.email}
            className="text-sm font-bold text-candy-orange/70 hover:text-candy-orange transition-colors flex items-center justify-center gap-2 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isResending ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                <span>發送中...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">mail</span>
                <span>沒有收到驗證郵件？點擊重新發送</span>
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-start gap-3 px-1 group cursor-pointer" onClick={() => { AudioService.playTick(); setAgreed(!agreed); }}>
              <div 
                className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center shrink-0 mt-0.5 ${agreed ? 'border-candy-orange bg-candy-orange' : 'border-gray-200 bg-white'}`}
              >
                {agreed && <span className="material-symbols-outlined text-white text-[18px] font-bold">check</span>}
              </div>
              <p className="text-[14px] text-soft-text/70 leading-relaxed font-medium">
                我已閱讀並同意 <span onClick={(e) => { e.stopPropagation(); AudioService.playTick(); onViewTerms(); }} className="text-candy-orange font-bold border-b border-candy-orange/20 cursor-pointer">服務條款</span> 與 <span onClick={(e) => { e.stopPropagation(); AudioService.playTick(); onViewPrivacy(); }} className="text-candy-orange font-bold border-b border-candy-orange/20 cursor-pointer">隱私權政策</span>
              </p>
            </div>
            {error && <p className="text-xs text-red-500 ml-10 font-bold animate-pulse">{error}</p>}
          </div>
        </div>

        <div className="mt-auto pt-2 flex flex-col items-center gap-6">
          <button 
            onClick={handleNext} 
            disabled={isLoading || !agreed}
            className={`ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center gap-3 transition-all ${(!agreed || isLoading) ? 'opacity-50 grayscale pointer-events-none' : 'active:translate-y-1 active:shadow-none shadow-xl'}`}
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>處理中...</span>
              </>
            ) : (
              <>
                <span>建立帳號</span>
                <span className="material-symbols-outlined font-bold">arrow_forward</span>
              </>
            )}
          </button>
          <p className="text-[14px] text-soft-text/50 font-medium pb-4">
            已經有帳號了？ <span onClick={() => { AudioService.playTick(); onLogin(); }} className="text-candy-orange font-black ml-1 cursor-pointer hover:underline underline-offset-4">直接登入</span>
          </p>
        </div>
      </div>
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-100/40 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
};

const SignupStep2: React.FC<{ tone: Tone, setTone: (t: Tone) => void, onNext: () => void, onBack: () => void }> = ({ tone, setTone, onNext, onBack }) => {
  return (
    <div className="relative h-full w-full flex flex-col bg-cream-bg">
      <div className="px-6 pb-6 z-10 app-safe-header">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 cursor-pointer transition-transform active:scale-90" onClick={() => { AudioService.playTick(); onBack(); }}>
            <span className="material-symbols-outlined text-xl text-soft-text/60">arrow_back_ios_new</span>
          </div>
          <div className="font-bold text-soft-text/60">步驟 2 / 4</div>
          <div className="w-10 h-10"></div>
        </div>
        <div className="h-2 bg-white rounded-full border border-bubble-border overflow-hidden">
          <div className="h-full bg-candy-orange transition-all duration-500" style={{ width: '50%' }}></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-12 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center pt-2 pb-8">
          <div className="relative w-32 h-32 mb-6 marshmallow-bounce">
            <div className="absolute inset-0 bg-yellow-200/40 rounded-full blur-2xl"></div>
            <div className="marshmallow-ai relative z-10 w-28 h-28 flex items-center justify-center border-4 border-white">
              <div className="flex gap-4 mt-[-5px]">
                <div className="relative w-2.5 h-3.5 bg-soft-text rounded-full"><div className="absolute top-1 left-0.5 w-1 h-1 bg-white rounded-full"></div></div>
                <div className="relative w-2.5 h-3.5 bg-soft-text rounded-full"><div className="absolute top-1 left-0.5 w-1 h-1 bg-white rounded-full"></div></div>
              </div>
              <div className="absolute bottom-10 w-4 h-2 border-b-2 border-soft-text/60 rounded-full"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-candy-orange rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <span className="material-symbols-outlined text-white text-[14px] font-bold">chat_bubble</span>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center mb-0">選擇最舒適的<span className="text-candy-orange">對話方式</span></h1>
          <p className="text-soft-text/70 text-center text-sm px-8 leading-relaxed">我會依照你喜歡的語氣，<br/>陪伴你度過每一天。</p>
        </div>

        <div className="flex flex-col gap-4">
          {[
            { t: Tone.GENTLE, icon: 'favorite', title: '溫柔鼓勵', desc: '像軟綿綿的雲朵，給你無限包容與安慰。', bg: 'bg-orange-100', color: 'text-candy-orange' },
            { t: Tone.HUMOROUS, icon: 'sentiment_very_satisfied', title: '幽默風趣', desc: '偶爾開點小玩笑，讓心情瞬間亮起來。', bg: 'bg-blue-100', color: 'text-blue-400' },
            { t: Tone.RATIONAL, icon: 'bolt', title: '理性引導', desc: '清晰客觀的分析，陪你找到成長的方向。', bg: 'bg-bubble-green/40', color: 'text-emerald-600' }
          ].map((item) => (
            <div key={item.t} onClick={() => { AudioService.playSoftPop(); setTone(item.t); }} className={`bg-white border-[3px] rounded-[2rem] p-6 flex items-center gap-5 transition-all duration-300 cursor-pointer ${tone === item.t && tone !== Tone.CUSTOM ? 'border-candy-orange ring-4 ring-candy-orange/20 shadow-lg scale-[1.02]' : 'border-bubble-border'}`}>
              <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center border-2 border-white shadow-inner`}>
                <span className={`material-symbols-outlined ${item.color} text-3xl ${tone === item.t ? 'fill-1' : ''}`}>{item.icon}</span>
              </div>
              <div className="flex-1"><h3 className="text-lg font-bold text-soft-text">{item.title}</h3><p className="text-xs text-soft-text/60">{item.desc}</p></div>
              {tone === item.t && tone !== Tone.CUSTOM && (
                <div className="w-6 h-6 rounded-full bg-candy-orange flex items-center justify-center"><span className="material-symbols-outlined text-white text-sm font-bold">check</span></div>
              )}
            </div>
          ))}

        </div>

        <div className="mt-auto pt-10">
          <button onClick={() => { AudioService.playTick(); onNext(); }} className="ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center gap-3 transition-transform active:translate-y-1 active:shadow-none shadow-xl">
            <span>下一步</span><span className="material-symbols-outlined font-bold">arrow_forward_ios</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const SignupStep3: React.FC<{ goals: Category[], setGoals: (c: Category[]) => void, onNext: () => void, onBack: () => void }> = ({ goals, setGoals, onNext, onBack }) => {
  const toggleGoal = (c: Category) => {
    AudioService.playSoftPop();
    if (goals.includes(c)) setGoals(goals.filter(g => g !== c));
    else setGoals([...goals, c]);
  };

  const categoryInfo: Record<Category, { label: string; description: string }> = {
    [Category.SOCIAL]: { label: '社交', description: '人際關係、溝通、表達' },
    [Category.WORK]: { label: '工作', description: '事業發展、專業能力' },
    [Category.EXTERNAL]: { label: '外在', description: '自信魅力、形象建立' },
    [Category.SELF]: { label: '自我', description: '內在成長、情緒管理' },
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-cream-bg">
      <div className="px-6 pb-6 z-10 app-safe-header">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 cursor-pointer transition-transform active:scale-90" onClick={() => { AudioService.playTick(); onBack(); }}>
            <span className="material-symbols-outlined text-xl text-soft-text/60">arrow_back_ios_new</span>
          </div>
          <div className="font-bold text-soft-text/60">步驟 3 / 4</div>
          <div className="w-10 h-10"></div>
        </div>
        <div className="h-2 bg-white rounded-full border border-bubble-border overflow-hidden">
          <div className="h-full bg-candy-orange transition-all duration-500" style={{ width: '75%' }}></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pb-12 overflow-y-auto no-scrollbar">
        <div className="text-center mb-6 mt-4">
          <h1 className="text-3xl font-bold tracking-tight mb-3">選擇你最在乎的<span className="text-candy-orange">成長區域</span></h1>
          <p className="text-soft-text/70 text-sm leading-relaxed px-2">棉花糖夥伴會根據你選擇的方向，<br/>為你提供更貼近內心的支持與建議</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 items-center justify-center py-2">
          {[
            { c: Category.SOCIAL, icon: 'diversity_3' },
            { c: Category.WORK, icon: 'handyman' },
            { c: Category.EXTERNAL, icon: 'content_cut' },
            { c: Category.SELF, icon: 'favorite' }
          ].map(item => (
            <button key={item.c} onClick={() => toggleGoal(item.c)} className="flex flex-col items-center justify-center gap-2 group">
              <div className={`w-24 h-24 rounded-full border-[3px] flex items-center justify-center shadow-lg transition-all ${goals.includes(item.c) ? 'bg-bubble-green/40 border-emerald-500 scale-105 shadow-emerald-200' : 'bg-white border-bubble-border'}`}>
                <span className={`material-symbols-outlined text-4xl ${goals.includes(item.c) ? 'text-emerald-700' : 'text-candy-orange'}`}>{item.icon}</span>
              </div>
              <span className={`text-base font-bold transition-colors ${goals.includes(item.c) ? 'text-emerald-700' : 'text-soft-text'}`}>{categoryInfo[item.c].label}</span>
              <span className="text-xs text-soft-text/50 text-center px-2 leading-relaxed">{categoryInfo[item.c].description}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-10">
          <button onClick={() => { AudioService.playTick(); onNext(); }} className="ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center gap-3 transition-transform active:translate-y-1 active:shadow-none shadow-xl">
            <span>下一步</span><span className="material-symbols-outlined font-bold">arrow_forward_ios</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const SignupStep4: React.FC<{ firstEntry: string, setFirstEntry: (s: string) => void, onComplete: () => void, onBack: () => void, onSaveDraft: (content: string) => void }> = ({ firstEntry, setFirstEntry, onComplete, onBack, onSaveDraft }) => {
  const [isSaving, setIsSaving] = useState(false);

  // 使用者輸入時直接儲存至日記
  useEffect(() => {
    const timer = setTimeout(() => {
      if (firstEntry && firstEntry.trim() && !isSaving) {
        setIsSaving(true);
        onSaveDraft(firstEntry);
        setIsSaving(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [firstEntry, onSaveDraft, isSaving]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFirstEntry(value);
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-cream-bg">
      <div className="px-6 pb-6 z-10 app-safe-header">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/60 cursor-pointer transition-transform active:scale-90" onClick={() => { AudioService.playTick(); onBack(); }}>
            <span className="material-symbols-outlined text-xl text-soft-text/60">arrow_back_ios_new</span>
          </div>
          <div className="font-bold text-soft-text/60">步驟 4 / 4</div>
          <div className="w-10 h-10"></div>
        </div>
        <div className="h-2 bg-white rounded-full border border-bubble-border overflow-hidden">
          <div className="h-full bg-candy-orange transition-all duration-500" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-12 overflow-y-auto no-scrollbar">
        <div className="text-center mb-8 mt-4">
          <h1 className="text-2xl font-bold tracking-tight mb-0">寫下今天一件<span className="text-candy-orange">值得肯定</span>的事</h1>
          <p className="text-soft-text/60 text-sm font-medium">小小的一步，也是勇氣的證明</p>
        </div>
        <div className="relative flex-1 min-h-[300px] mb-8">
          <div className="w-full h-full min-h-[320px] rounded-[2.5rem] p-8 flex flex-col bg-white border-[3px] border-bubble-border shadow-lg" style={{backgroundImage: 'linear-gradient(#f0f0f0 1.1px, transparent 1.1px)', backgroundSize: '100% 2.2rem', lineHeight: '2.2rem'}}>
            <textarea value={firstEntry} onChange={handleInputChange} className="w-full flex-1 bg-transparent border-none focus:ring-0 p-0 text-lg text-soft-text placeholder-soft-text/30 resize-none font-medium" placeholder="今天我勇敢地..." style={{lineHeight: '2.2rem'}} />
          </div>
        </div>
        <div className="mt-auto">
          <button 
            onClick={() => { AudioService.playSuccess(); onComplete(); }} 
            className="ios-button-marshmallow w-full h-16 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-xl"
          >
            <span>播下種子，開啟幸福冒險</span><span className="material-symbols-outlined font-bold">celebration</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components: Dashboard Tabs: Chat ---

const ChatTab: React.FC<{ 
  messages: ChatMessage[], 
  onSendMessage: (text: string) => void, 
  currentTone: Tone,
  onToneChange: (t: Tone) => void,
  onClearHistory: () => void,
  userGoals: Category[],
  onUpdateGoals: (goals: Category[]) => void,
  onSuggestionClick: (view: ExploreSubView) => void,
  isAiThinking: boolean,
  chatLanguage: Language,
  onChatLanguageChange: (lang: Language) => void
}> = ({ messages, onSendMessage, currentTone, onToneChange, onClearHistory, userGoals, onUpdateGoals, onSuggestionClick, isAiThinking, chatLanguage, onChatLanguageChange }) => {
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [expression, setExpression] = useState<'default' | 'happy' | 'thinking' | 'talking' | 'supportive' | 'growth'>('default');
  const [hearts, setHearts] = useState<{ id: number; left: string }[]>([]);
  const [sparkles, setSparkles] = useState<{ id: number; left: string }[]>([]);
  const [isMarshmallowClicked, setIsMarshmallowClicked] = useState(false);
  const [isMarshmallowScaling, setIsMarshmallowScaling] = useState(false);
  
  const handleMarshmallowClick = () => {
    // Randomly select different effects
    const effectType = Math.random();
    
    // Play different sounds based on effect type
    if (effectType < 0.4) {
      AudioService.playSoftPop();
    } else if (effectType < 0.7) {
      AudioService.playSparkle();
    } else {
      AudioService.playSuccess();
    }
    
    // Random expression selection
    const expressions: Array<'happy' | 'supportive' | 'growth'> = ['happy', 'supportive', 'growth'];
    const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];
    setExpression(randomExpression);
    setIsMarshmallowClicked(true);
    setIsMarshmallowScaling(true);
    
    // Add heart particle
    const newHeart = { id: Date.now(), left: `${Math.random() * 40 + 30}%` };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => { setHearts(prev => prev.filter(h => h.id !== newHeart.id)); }, 1000);
    
    // Add sparkle particle (40% chance)
    if (effectType > 0.6) {
      const newSparkle = { id: Date.now() + 1, left: `${Math.random() * 40 + 30}%` };
      setSparkles(prev => [...prev, newSparkle]);
      setTimeout(() => { setSparkles(prev => prev.filter(s => s.id !== newSparkle.id)); }, 800);
    }
    
    // Reset after animation
    setTimeout(() => { 
      setExpression('default'); 
      setIsMarshmallowClicked(false); 
      setIsMarshmallowScaling(false);
    }, 1500);
  };

  const [suggestion, setSuggestion] = useState<{ text: string, view: ExploreSubView, icon: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const emojis = ['🌸', '✨', '☁️', '🙌', '😊', '🥰', '💪', '🌈', '🎈', '🌿', '💖', '🍪', '🐱', '🐥', '🌟'];

  useEffect(() => { 
    if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); 
    }
  }, [messages, isAiThinking]);

  useEffect(() => {
    if (isAiThinking) {
      setExpression('thinking');
    } else {
      setExpression('default');
    }
  }, [isAiThinking]);

  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMsg = messages[messages.length - 1];
    const text = lastMsg.text;

    if (lastMsg.role === 'model') {
      AudioService.playSoftPop();
    }

    const happyKeywords = ['開心', '讚', '棒', '喜悅', '哈哈', '謝謝', '感謝', '愉快', '幸福', '驚喜', '😊', '✨', '🌸', '💖', '愛', '太好了'];
    const sadKeywords = ['難過', '哭', '遺憾', '難受', '累', '壓力', '沮喪', '擔心', '不安', '焦慮', '😢', '☁️', '痛', '怕', '傷心'];
    const growthKeywords = ['學習', '練習', '挑戰', '計畫', '目標', '突破', '嘗試', '進步', '改變', '💪', '🌱', '努力'];
    
    let detectedExp: 'happy' | 'supportive' | 'growth' | 'default' = 'default';
    let currentSuggestion: typeof suggestion = null;

    if (happyKeywords.some(k => text.includes(k))) detectedExp = 'happy';
    else if (sadKeywords.some(k => text.includes(k))) {
      detectedExp = 'supportive';
      currentSuggestion = text.includes('壓力') || text.includes('不安') 
        ? { text: "要試試呼吸練習來放鬆嗎？🌿", view: ExploreSubView.BREATHING, icon: 'air' }
        : { text: "讓我們一起靜心冥想吧。🧘", view: ExploreSubView.MEDITATION_LIST, icon: 'self_improvement' };
    }
    else if (growthKeywords.some(k => text.includes(k))) {
      detectedExp = 'growth';
    }

    if (lastMsg.role === 'user') {
      setExpression(detectedExp === 'default' ? 'thinking' : detectedExp);
    } else {
      setExpression(detectedExp === 'default' ? 'happy' : detectedExp);
      setSuggestion(currentSuggestion);
      const timer = setTimeout(() => {
        setExpression('default');
        setTimeout(() => setSuggestion(null), 8000);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!isAiThinking) {
      if (e.target.value.trim() !== '') {
        setExpression('thinking');
      } else {
        setExpression('default');
      }
    }
  };

  const handleSend = () => { 
    if (!input.trim() || isAiThinking) return; 
    AudioService.playTick();
    setExpression('talking');
    onSendMessage(input); 
    setInput(''); 
    setShowEmojiPicker(false); 
    setSuggestion(null);
  };

  const handleClear = () => {
    AudioService.playTick();
    onClearHistory();
    setIsMenuOpen(false);
    setExpression('default');
    setSuggestion(null);
  };

  const handleViewGoals = () => {
    AudioService.playTick();
    setShowGoalsModal(true);
    setIsMenuOpen(false);
  };

  const handleShare = async () => {
    AudioService.playTick();
    setIsMenuOpen(false);
    const formattedChat = messages.map(m => {
      const time = m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sender = m.role === 'model' ? '棉花糖夥伴' : '我';
      return `[${time}] ${sender}: ${m.text}`;
    }).join('\n\n');
    const shareContent = `嗨！我想跟你分享我與棉花糖夥伴的暖心對話：\n\n${formattedChat}\n\n讓我們一起建立自信吧！✨`;
    if (navigator.share) {
      try {
        await navigator.share({ title: '棉花糖夥伴對話紀錄', text: shareContent });
      } catch (err) { console.error("Sharing failed", err); }
    } else {
      try {
        await navigator.clipboard.writeText(shareContent);
        AudioService.playSparkle();
        setShareFeedback("對話紀錄已複製到剪貼簿！🌸");
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err) {
        console.error("Clipboard copy failed", err);
        setShareFeedback("複製失敗，請手動選取文字分享。");
        setTimeout(() => setShareFeedback(null), 3000);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    AudioService.playSoftPop();
    setExpression('happy');
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || 0;
      const end = inputRef.current.selectionEnd || 0;
      const newValue = input.substring(0, start) + emoji + input.substring(end);
      setInput(newValue);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = inputRef.current.selectionEnd = start + emoji.length;
          inputRef.current.focus();
        }
      }, 0);
    } else {
      setInput(prev => prev + emoji);
    }
    setTimeout(() => {
      if (input.trim() === '') setExpression('default');
      else setExpression('thinking');
    }, 1500);
  };

  const toggleGoal = (c: Category) => {
    AudioService.playTick();
    if (userGoals.includes(c)) onUpdateGoals(userGoals.filter(g => g !== c));
    else onUpdateGoals([...userGoals, c]);
  };

  return (
    <div className="flex flex-col h-full bg-cream-bg relative overflow-hidden">
      <ParticleBackground />
      <header className="app-safe-header pb-4 px-6 flex flex-col items-center bg-gradient-to-b from-orange-50/50 to-transparent shrink-0 z-20">
        <div className="flex justify-between w-full items-center mb-4 relative">
          <button onClick={() => AudioService.playTick()} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-soft-text/60">arrow_back_ios_new</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-candy-orange tracking-widest uppercase">My Bestie</span>
            <h1 className="text-lg font-bold">棉花糖夥伴</h1>
          </div>
          <div className="relative">
            <button onClick={() => { AudioService.playTick(); setIsMenuOpen(!isMenuOpen); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-soft-text/60">more_horiz</span>
            </button>
            {isMenuOpen && (
              <div ref={menuRef} className="absolute top-12 right-0 w-52 bg-white rounded-3xl shadow-[0_15px_50px_rgba(0,0,0,0.15)] border border-orange-50/50 py-2.5 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                <button onClick={handleClear} className="w-full px-5 py-3.5 text-left text-[14px] font-bold text-soft-text flex items-center gap-3.5 hover:bg-orange-50/50 active:bg-orange-100/50 transition-colors border-b border-gray-50/50">
                  <span className="material-symbols-outlined text-candy-orange text-[22px]">delete_sweep</span>清空聊天紀錄
                </button>
                <button onClick={handleViewGoals} className="w-full px-5 py-3.5 text-left text-[14px] font-bold text-soft-text flex items-center gap-3.5 hover:bg-orange-50/50 active:bg-orange-100/50 transition-colors border-b border-gray-50/50">
                  <span className="material-symbols-outlined text-candy-orange text-[22px]">adjust</span>設定自信目標
                </button>
                <button onClick={() => { AudioService.playTick(); onChatLanguageChange(chatLanguage === Language.ZH_TW ? Language.ZH_HK : Language.ZH_TW); setIsMenuOpen(false); }} className="w-full px-5 py-3.5 text-left text-[14px] font-bold text-soft-text flex items-center gap-3.5 hover:bg-orange-50/50 active:bg-orange-100/50 transition-colors border-b border-gray-50/50">
                  <span className="material-symbols-outlined text-candy-orange text-[22px]">translate</span>{chatLanguage === Language.ZH_TW ? '切換至廣東話' : '切換至繁體中文'}
                </button>
                <button onClick={handleShare} className="w-full px-5 py-3.5 text-left text-[14px] font-bold text-soft-text flex items-center gap-3.5 hover:bg-orange-50/50 active:bg-orange-100/50 transition-colors">
                  <span className="material-symbols-outlined text-candy-orange text-[22px]">ios_share</span>分享對話紀錄
                </button>
              </div>
            )}
          </div>
        </div>
        <div id="tour-character" className={`relative ${expression !== 'default' || isMarshmallowClicked ? 'marshmallow-bounce' : ''} cursor-pointer`} onClick={handleMarshmallowClick}>
          {hearts.map(heart => (
            <div key={heart.id} className="heart-particle" style={{ left: heart.left, top: '-20px' }}><span className="material-symbols-outlined fill-1">favorite</span></div>
          ))}
          {sparkles.map(sparkle => (
            <div key={sparkle.id} className="sparkle-particle" style={{ left: sparkle.left, top: '-10px' }}></div>
          ))}
          <div className={`marshmallow-ai-bust w-28 h-24 flex flex-col items-center justify-center border-4 border-white relative overflow-hidden transition-all duration-500 ${
            isMarshmallowScaling ? 'scale-110' :
            expression === 'happy' ? 'shadow-orange-100 scale-105' : 
            expression === 'supportive' ? 'shadow-blue-100' : 
            expression === 'growth' ? 'shadow-emerald-100' : ''
          }`}>
            <div className={`flex gap-5 mb-2 transition-all duration-300 ${expression === 'thinking' ? 'eye-think-anim' : ''}`}>
              {expression === 'happy' ? (
                <>
                  <div className="w-3.5 h-2 border-t-[3px] border-soft-text rounded-full mt-1"></div>
                  <div className="w-3.5 h-2 border-t-[3px] border-soft-text rounded-full mt-1"></div>
                </>
              ) : expression === 'supportive' ? (
                <>
                  <div className="w-3 h-1.5 border-t-2 border-soft-text/60 rounded-full mt-1"></div>
                  <div className="w-3 h-1.5 border-t-2 border-soft-text/60 rounded-full mt-1"></div>
                </>
              ) : expression === 'growth' ? (
                <>
                  <div className="relative w-3.5 h-3.5 flex items-center justify-center"><span className="material-symbols-outlined text-emerald-400 text-xs fill-1 scale-125">auto_awesome</span></div>
                  <div className="relative w-3.5 h-3.5 flex items-center justify-center"><span className="material-symbols-outlined text-emerald-400 text-xs fill-1 scale-125">auto_awesome</span></div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3.5 bg-soft-text rounded-full relative eye-blink-anim"><div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full"></div></div>
                  <div className="w-3 h-3.5 bg-soft-text rounded-full relative eye-blink-anim"><div className="absolute top-0.5 left-0.5 w-1 h-1 bg-white rounded-full"></div></div>
                </>
              )}
            </div>
            <div className={`absolute bottom-6 transition-all duration-300 flex items-center justify-center ${expression === 'talking' ? 'mouth-talk-anim' : ''}`}>
               {expression === 'happy' || expression === 'growth' ? <div className="w-6 h-3 border-b-[3px] border-candy-orange/80 rounded-full"></div> : 
                expression === 'thinking' ? <div className="w-2.5 h-2.5 border-[2px] border-soft-text/60 rounded-full"></div> : 
                expression === 'talking' ? <div className="w-4 h-4 bg-pink-400/20 border-2 border-soft-text rounded-full mouth-talk-anim" /> : 
                expression === 'supportive' ? <div className="w-3 h-1.5 border-b-2 border-soft-text/40 rounded-full"></div> : 
                <div className="w-4 h-1 border-b-2 border-soft-text/40 rounded-full"></div>}
            </div>
            <div className={`absolute bottom-8 left-4 w-4 h-2 bg-pink-200/50 blur-[2px] rounded-full transition-all duration-500 ${expression === 'happy' ? 'opacity-100 scale-125' : expression === 'growth' ? 'opacity-80 scale-110 bg-emerald-100' : expression === 'supportive' ? 'opacity-70' : 'opacity-30'}`}></div>
            <div className={`absolute bottom-8 right-4 w-4 h-2 bg-pink-200/50 blur-[2px] rounded-full transition-all duration-500 ${expression === 'happy' ? 'opacity-100 scale-125' : expression === 'growth' ? 'opacity-80 scale-110 bg-emerald-100' : expression === 'supportive' ? 'opacity-70' : 'opacity-30'}`}></div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 border-4 border-cream-bg rounded-full shadow-sm"></div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar z-10">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 max-w-[85%] ${m.role === 'user' ? 'ml-auto justify-end' : ''}`}>
            <div className={`p-4 shadow-sm ${m.role === 'user' ? 'ios-chat-bubble-user' : 'ios-chat-bubble-ai'}`}>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
              <span className={`text-[10px] mt-2 block ${m.role === 'user' ? 'text-white/60 text-right' : 'text-soft-text/30'}`}>
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        
        {isAiThinking && (
          <div className="flex items-end gap-2 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 py-5 ios-chat-bubble-ai min-w-[70px] flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 bg-candy-orange/40 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-candy-orange/60 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 bg-candy-orange/80 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </main>

      {shareFeedback && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-soft-text/90 text-white px-6 py-3 rounded-full text-sm font-bold shadow-xl animate-in fade-in slide-in-from-bottom-4 z-[110]">
          {shareFeedback}
        </div>
      )}

      <div className="px-6 py-2 shrink-0 z-20">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { t: Tone.GENTLE, label: '溫柔鼓勵', icon: 'favorite' },
            { t: Tone.HUMOROUS, label: '幽默風趣', icon: 'sentiment_very_satisfied' },
            { t: Tone.RATIONAL, label: '理性引導', icon: 'lightbulb' }
          ].map(item => (
            <button 
              key={item.t} 
              onClick={() => { AudioService.playTick(); onToneChange(item.t); setExpression('happy'); setTimeout(() => setExpression('default'), 1500); }}
              className={`whitespace-nowrap px-4 py-2 rounded-full border-2 text-sm font-bold flex items-center gap-1 transition-all ${currentTone === item.t ? 'chip-active' : 'chip-inactive'}`}
            >
              <span className="material-symbols-outlined text-sm">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 px-6 pb-8 shrink-0 z-20 relative">
        {suggestion && (
          <div className="absolute bottom-full mb-6 left-6 right-6 animate-in slide-in-from-bottom-2 fade-in duration-500">
            <button 
              onClick={() => { AudioService.playTick(); onSuggestionClick(suggestion.view); }}
              className="bg-white/90 backdrop-blur-md border-2 border-orange-100 rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3 group active:scale-95 transition-all w-full text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-candy-orange">{suggestion.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-soft-text leading-tight">{suggestion.text}</p>
                <span className="text-[10px] text-candy-orange font-black uppercase tracking-widest">棉花糖的小建議</span>
              </div>
              <span className="material-symbols-outlined text-candy-orange/40 group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="absolute bottom-full mb-4 left-6 right-6 bg-white rounded-[2rem] p-4 shadow-2xl border-2 border-orange-50 grid grid-cols-5 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
            {emojis.map(emoji => (
              <button 
                key={emoji} 
                onClick={() => handleEmojiSelect(emoji)}
                className="text-2xl hover:scale-125 transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 bg-white rounded-[2rem] p-2 pl-5 shadow-lg border border-orange-50">
          <input ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSend()} className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder:text-soft-text/30 text-soft-text" placeholder="跟棉花糖聊聊..." type="text" />
          <button onClick={() => { AudioService.playTick(); setShowEmojiPicker(!showEmojiPicker); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showEmojiPicker ? 'bg-orange-100 text-candy-orange' : 'text-soft-text/30 hover:text-candy-orange'}`}>
            <span className="material-symbols-outlined">sentiment_satisfied</span>
          </button>
          <button onClick={handleSend} className="w-10 h-10 rounded-full bg-candy-orange flex items-center justify-center text-white shadow-md active:scale-95 transition-transform">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>

      {showGoalsModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
           <div className="bg-white w-full max-sm rounded-[3rem] p-8 shadow-2xl relative overflow-hidden border-4 border-bubble-border animate-in zoom-in-95 duration-300">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-orange-50 rounded-full opacity-60"></div>
              <div className="flex flex-col items-center gap-1 mb-6">
                <div className="w-12 h-12 bg-candy-orange/10 rounded-2xl flex items-center justify-center mb-2"><span className="material-symbols-outlined text-candy-orange font-bold">adjust</span></div>
                <h2 className="text-2xl font-black text-soft-text">自信藍圖</h2>
                <p className="text-xs text-soft-text/40 font-bold">點擊圖示來調整你的目標 🌿</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { c: Category.SOCIAL, icon: 'diversity_3', label: '社交' }, { c: Category.WORK, icon: 'handyman', label: '工作' },
                  { c: Category.EXTERNAL, icon: 'content_cut', label: '外在' }, { c: Category.SELF, icon: 'favorite', label: '自我' }
                ].map(item => (
                  <button key={item.c} onClick={() => toggleGoal(item.c)} className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-2 ${userGoals.includes(item.c) ? 'bg-bubble-green/20 border-emerald-500 shadow-inner' : 'bg-white border-bubble-border shadow-sm'}`}>
                    <span className={`material-symbols-outlined text-2xl ${userGoals.includes(item.c) ? 'text-emerald-700' : 'text-candy-orange'}`}>{item.icon}</span>
                    <span className={`text-xs font-bold ${userGoals.includes(item.c) ? 'text-emerald-700' : 'text-soft-text/60'}`}>{item.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { AudioService.playSuccess(); setShowGoalsModal(false); }} className="w-full ios-button-marshmallow h-14 text-white font-bold text-lg shadow-orange-100 transition-all active:scale-95">完成設定</button>
           </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components: Affirmation View ---

const AffirmationView: React.FC<{ 
  onBack: () => void, 
  profile: UserProfile,
  onSaveToDiary: (text: string) => void
}> = ({ onBack, profile, onSaveToDiary }) => {
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAffirmation = async () => {
    setLoading(true);
    setAffirmation(null);
    const result = await generateAffirmation(profile.tone, profile.goals);
    setAffirmation(result);
    setLoading(false);
    AudioService.playSparkle();
  };

  useEffect(() => {
    fetchAffirmation();
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-orange-50 to-white animate-in fade-in duration-500 overflow-hidden relative">
      <ParticleBackground />
      <header className="app-safe-header px-8 pb-4 flex items-center justify-between shrink-0 z-20">
        <div onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-sm">
          <span className="material-symbols-outlined text-xl text-soft-text/60">close</span>
        </div>
        <div className="px-5 py-2 rounded-full bg-white/60 border border-orange-100 shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-candy-orange text-sm font-bold">flare</span>
          <span className="text-sm font-black text-soft-text tracking-tight">每日肯定</span>
        </div>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        <div className="marshmallow-ai-bust w-32 h-28 mb-10 marshmallow-bounce relative flex flex-col items-center justify-center overflow-hidden">
          <div className="flex gap-8 mb-2 z-10">
            <div className="w-2.5 h-3.5 bg-soft-text rounded-full"></div>
            <div className="w-2.5 h-3.5 bg-soft-text rounded-full"></div>
          </div>
          <div className="w-6 h-3 border-b-2 border-candy-orange/80 rounded-full z-10"></div>
          <div className="absolute top-[50%] left-6 w-5 h-2.5 bg-pink-200/60 blur-[2.5px] rounded-full"></div>
          <div className="absolute top-[50%] right-6 w-5 h-2.5 bg-pink-200/60 blur-[2.5px] rounded-full"></div>

          {loading && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px] z-20">
                <div className="w-8 h-8 border-4 border-candy-orange/20 border-t-candy-orange rounded-full animate-spin"></div>
             </div>
          )}
        </div>

        <div className={`w-full bg-white rounded-[3rem] p-8 shadow-2xl border-2 border-orange-50 text-center relative transition-all duration-700 ${loading ? 'opacity-40 blur-sm scale-95' : 'opacity-100 scale-100'}`}>
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-candy-orange text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
            Marshmallow Words
          </div>
          <span className="material-symbols-outlined text-orange-100 text-6xl mb-4 block opacity-40">format_quote</span>
          <p className="text-xl font-bold text-soft-text leading-relaxed italic min-h-[100px] flex items-center justify-center">
            {loading ? '正在為你尋找光芒...' : affirmation}
          </p>
          <div className="h-1 w-12 bg-candy-orange/20 mx-auto mt-8 rounded-full"></div>
        </div>

        <div className="mt-12 space-y-4 w-full px-4">
           {!loading && (
             <>
                <button 
                  onClick={() => { AudioService.playSuccess(); if (affirmation) onSaveToDiary(affirmation); }} 
                  className="w-full h-14 bg-white border-2 border-orange-100 rounded-2xl flex items-center justify-center gap-3 text-soft-text font-bold shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-candy-orange">auto_awesome</span>
                  <span>珍藏到自信日記</span>
                </button>
                <button 
                  onClick={fetchAffirmation} 
                  className="w-full h-14 bg-orange-50/50 rounded-2xl flex items-center justify-center gap-3 text-candy-orange font-black text-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined">refresh</span>
                  <span>再抽一張肯定卡</span>
                </button>
             </>
           )}
        </div>
      </main>

      <footer className="px-10 pb-16 flex justify-center z-10">
        <p className="text-[11px] font-black text-soft-text/30 text-center tracking-widest uppercase">
          Believe in yourself as much as I believe in you.
        </p>
      </footer>
    </div>
  );
};

// --- Sub-components: Explore Views ---

const VisualizationView: React.FC<{ 
  onBack: () => void, 
  profile: UserProfile 
}> = ({ onBack, profile }) => {
  const [vision, setVision] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const fetchVision = async (category?: Category) => {
    setLoading(true);
    // 使用 DeepSeek API 生成視覺化腳本
    try {
      // 如果用戶選擇了分類，優先使用選擇的分類
      const targetGoals = category ? [category] : profile.goals;
      const result = await generateVisualization(targetGoals);
      setVision(result);
    } catch (error) {
      console.error('Failed to generate visualization:', error);
      // Fallback 到本地劇本 - 優先使用選擇的分類
      const fallbackCategory = category || 
        (profile.goals.length > 0 
          ? profile.goals[Math.floor(Math.random() * profile.goals.length)] 
          : Category.SELF);
      const options = LOCAL_VISUALIZATIONS[fallbackCategory];
      const fallbackResult = options[Math.floor(Math.random() * options.length)];
      setVision(fallbackResult);
    }
    setLoading(false);
    AudioService.playSuccess();
  };

  const handleCategorySelect = (category: Category) => {
    AudioService.playTick();
    setSelectedCategory(category);
    fetchVision(category);
  };

  useEffect(() => {
    fetchVision();
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#1A1C1E] animate-in fade-in duration-700 relative text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-purple-900/40 pointer-events-none"></div>
      <header className="app-safe-header px-8 pb-4 flex items-center justify-between shrink-0 z-20">
        <div onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center cursor-pointer active:scale-90 transition-transform shadow-sm">
          <span className="material-symbols-outlined text-xl text-white/60">close</span>
        </div>
        <div className="px-5 py-2 rounded-full bg-white/10 border border-white/20 shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-400 text-sm font-bold">rocket_launch</span>
          <span className="text-sm font-black text-white/90 tracking-tight">自信噴發</span>
        </div>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 flex flex-col items-center px-8 py-4 relative z-10 text-center overflow-y-auto">
        <div className="relative w-48 h-48 mb-8">
          <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="marshmallow-zen w-40 h-36 mx-auto !bg-white/90 flex flex-col items-center justify-center shadow-2xl relative z-10">
             <div className="flex gap-8 mb-3">
               <div className="w-2.5 h-1 bg-soft-text rounded-full"></div>
               <div className="w-2.5 h-1 bg-soft-text rounded-full"></div>
             </div>
             <div className="w-6 h-3 border-b-2 border-candy-orange rounded-full"></div>
          </div>
        </div>

        {/* 分類選擇器 - 並排顯示 */}
        <div className="flex gap-3 mb-8 justify-center w-full max-w-md">
          {[
            { c: Category.SOCIAL, icon: 'diversity_3', label: '社交' },
            { c: Category.WORK, icon: 'handyman', label: '工作' },
            { c: Category.EXTERNAL, icon: 'content_cut', label: '外在' },
            { c: Category.SELF, icon: 'favorite', label: '自我' }
          ].map(({ c, icon, label }) => (
            <button
              key={c}
              onClick={() => handleCategorySelect(c)}
              className={`flex-1 px-3 py-2 rounded-full text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                selectedCategory === c 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-6 max-w-sm w-full">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-indigo-100">視覺化練習</h2>
          <div className={`p-8 bg-white/5 border border-white/10 rounded-[2.5rem] backdrop-blur-md transition-all duration-1000 ${loading ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-8 h-8 border-4 border-white/10 border-t-purple-400 rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">正在構築夢想場景...</p>
              </div>
            ) : (
              <p className="text-lg font-bold leading-relaxed text-purple-50/90 italic">
                「{vision}」
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="px-10 pb-8 flex justify-center z-10">
        {!loading && (
          <button onClick={() => { AudioService.playSuccess(); onBack(); }} className="ios-button-marshmallow !bg-gradient-to-r !from-purple-500 !to-indigo-500 px-12 h-16 text-white font-bold text-xl flex items-center justify-center gap-3">
            <span>感受這份能量</span>
            <span className="material-symbols-outlined">flare</span>
          </button>
        )}
      </footer>
    </div>
  );
};

const BreathingView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'finish'>('inhale');
  const [counter, setCounter] = useState(4);
  const [cycle, setCycle] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const totalCycles = 3;

  // 根據 cycle 和 phase 播放對應的音頻
  useEffect(() => {
    const playAudio = async () => {
      if (phase === 'inhale') {
        if (cycle === 2) {
          await AudioService.playBreathingAudio('again');
        } else if (cycle === 3) {
          await AudioService.playBreathingAudio('last-round');
        } else {
          await AudioService.playBreathingAudio('inhale');
        }
      } else if (phase === 'hold') {
        await AudioService.playBreathingAudio('hold');
      } else if (phase === 'exhale') {
        await AudioService.playBreathingAudio('exhale');
      } else if (phase === 'finish') {
        await AudioService.playBreathingAudio('complete');
      }
    };
    playAudio();
  }, [phase, cycle]);

  const resetPractice = () => {
    // 重設練習狀態，不再播放滴聲，避免干擾語音引導
    console.log('[BreathingView] resetPractice called');
    setPhase('inhale');
    setCounter(4);
    setCycle(1);
    setIsActive(false);
  };

  useEffect(() => {
    let timer: number;
    if (phase === 'finish' || !isActive) return;
    
    timer = window.setInterval(() => {
      setCounter(prev => {
        if (prev > 1) {
          // 每秒倒數時，不再播放滴聲，只更新數字
          console.log('[BreathingView] countdown tick', { phase, cycle, prev });
          return prev - 1;
        }
        if (phase === 'inhale') { setPhase('hold'); return 7; }
        else if (phase === 'hold') { setPhase('exhale'); return 8; }
        else {
          if (cycle < totalCycles) { setCycle(c => c + 1); setPhase('inhale'); return 4; }
          else { 
            AudioService.playSuccess();
            setPhase('finish'); 
            return 0; 
          }
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, cycle, isActive]);

  return (
    <div className="h-full flex flex-col bg-mint-bg animate-in fade-in duration-500 overflow-hidden">
      <header className="app-safe-header px-8 pb-4 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"><span className="material-symbols-outlined text-xl text-soft-text/60">close</span></div>
          <div className="flex items-center gap-2 bg-white/60 px-5 py-2 rounded-full border border-mint-glow shadow-sm">
            <span className="material-symbols-outlined text-emerald-500 text-sm fill-1">air</span>
            <span className="text-sm font-black text-soft-text tracking-tight">4-7-8 呼吸法</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center"><span className="material-symbols-outlined text-soft-text/60">volume_up</span></div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[11px] font-black tracking-wider text-soft-text/50 uppercase"><span>練習進度</span><span>第 {cycle}/{totalCycles} 組</span></div>
          <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden"><div className="h-full bg-active-green transition-all duration-1000" style={{ width: `${(cycle/totalCycles)*100}%` }}></div></div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center relative px-8">
        <div className="absolute top-20 left-10 opacity-20"><div className="w-12 h-12 bg-white rounded-full blur-xl"></div></div>
        <div className="absolute bottom-40 right-10 opacity-30"><div className="w-20 h-20 bg-mint-glow rounded-full blur-2xl"></div></div>
        
        <div className="relative w-72 h-72 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${isActive && phase === 'inhale' ? 'scale-125 opacity-100' : 'scale-90 opacity-60'}`} style={{background: 'radial-gradient(circle, #ffffff 0%, #d1f2e8 100%)', boxShadow: '0 0 60px rgba(168, 230, 207, 0.4)'}}></div>
          <div className={`absolute inset-4 border-2 border-dashed border-emerald-200/50 rounded-full ${isActive ? 'animate-spin' : ''}`} style={{animationDuration: '20s'}}></div>
          
          <div className="z-10 flex flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-black text-soft-text mb-0 drop-shadow-sm">
              {phase === 'inhale' ? '吸氣...' : phase === 'hold' ? '憋氣...' : phase === 'exhale' ? '呼氣...' : '練習完成'}
            </h2>
            <div className="bg-white/40 backdrop-blur-sm px-4 py-1 rounded-full mt-2">
              <p className="text-lg font-black text-emerald-600 tracking-[0.2em]">{counter}s</p>
            </div>
          </div>
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-soft-text/50 text-sm font-bold leading-relaxed max-w-[240px]">
            {phase === 'inhale' ? '深深吸入平靜與能量' : phase === 'hold' ? '感受體內的平衡與寧靜' : phase === 'exhale' ? '緩緩吐出所有的壓力' : '感覺身心輕盈了許多嗎？'}
          </p>
        </div>
      </main>

      <footer className="px-10 pb-16 flex flex-col items-center gap-8">
        {phase !== 'finish' ? (
          <div className="flex items-center gap-12">
            <button onClick={resetPractice} className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center text-soft-text/40 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-2xl">replay</span>
            </button>
            <button 
              onClick={async () => {
                console.log('[BreathingView] Play button clicked', { phase, cycle, isActive });

                if (phase === 'inhale') {
                  console.log('[BreathingView] about to play inhale audio', { cycle });
                  await AudioService.playBreathingAudio(
                    cycle === 2 ? 'again' : cycle === 3 ? 'last-round' : 'inhale'
                  );
                } else if (phase === 'hold') {
                  console.log('[BreathingView] about to play hold audio');
                  await AudioService.playBreathingAudio('hold');
                } else if (phase === 'exhale') {
                  console.log('[BreathingView] about to play exhale audio');
                  await AudioService.playBreathingAudio('exhale');
                } else if (phase === 'finish') {
                  console.log('[BreathingView] about to play complete audio');
                  await AudioService.playBreathingAudio('complete');
                }

                console.log('[BreathingView] toggling isActive', { from: isActive, to: !isActive });
                setIsActive(!isActive);
              }} 
              className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-200 active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-5xl fill-1">{isActive ? 'pause' : 'play_arrow'}</span>
            </button>
            <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center text-soft-text/40 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { AudioService.playSuccess(); onBack(); }} 
            className="ios-button-marshmallow !bg-emerald-500 !shadow-emerald-200 px-16 h-16 text-white font-bold text-xl flex items-center justify-center gap-2"
          >
            <span>完成練習</span>
            <span className="material-symbols-outlined">check_circle</span>
          </button>
        )}
      </footer>
    </div>
  );
};

interface HeartParticle { id: number; left: string; }
type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'replying';

const ExploreHub: React.FC<{ 
  onBack: () => void, 
  onStartBreathing: () => void, 
  onStartMeditation: () => void,
  onStartAffirmations: () => void,
  onStartVisualization: () => void,
  onVoiceTextCaptured: (text: string) => Promise<string>,
  language: Language,
  profile: { tone: Tone; goals: Category[] }
}> = ({ onBack, onStartBreathing, onStartMeditation, onStartAffirmations, onStartVisualization, onVoiceTextCaptured, language, profile }) => {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [lastUserText, setLastUserText] = useState<string | null>(null);
  const [lastAiReply, setLastAiReply] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const recognitionController = useRef<{ stop: () => void; isListening: () => boolean; getLastTranscript: () => string } | null>(null);
  
  // 语音对话历史
  const [voiceConversationHistory, setVoiceConversationHistory] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);
  
  // 当前实时转文字
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  
  // 是否正在等待回复
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  
  const handleCharacterClick = () => {
    AudioService.playSoftPop();
    const newHeart = { id: Date.now(), left: `${Math.random() * 60 + 20}%` };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => { setHearts(prev => prev.filter(h => h.id !== newHeart.id)); }, 1000);
  };

  const stopVoiceInteraction = () => {
    if (recognitionController.current) {
      recognitionController.current.stop();
      recognitionController.current = null;
    }
    setIsVoiceActive(false);
    setIsSpeaking(false);
    setVoiceStatus('idle');
    setLiveTranscript('');
    setIsWaitingForReply(false);
    // 清空对话历史
    setVoiceConversationHistory([]);
  };

  // 处理语音回复
  const handleVoiceReply = async (userText: string) => {
    if (isWaitingForReply || !userText.trim()) return;
    
    setIsWaitingForReply(true);
    setLastUserText(userText);
    setVoiceStatus('thinking');

    // 更新对话历史
    const newHistory = [...voiceConversationHistory, { role: 'user' as const, content: userText }];
    setVoiceConversationHistory(newHistory);

    try {
      // 调用传入的 onVoiceTextCaptured，它内部会使用正确的聊天历史
      const reply = await onVoiceTextCaptured(userText);
      setLastAiReply(reply);

      // 更新对话历史
      setVoiceConversationHistory(prev => [...prev, { role: 'assistant', content: reply }]);

      if (isTtsSupported()) {
        setVoiceStatus('replying');
        setIsSpeaking(true);
        setIsWaitingForReply(false);
        
        await speakText(reply, language, {
          onEnd: () => {
            setIsSpeaking(false);
            setVoiceStatus('listening');
          }
        });
      } else {
        setVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Voice AI error:', error);
      const comfort = getLocalComfortText(language);
      setLastAiReply(comfort);
      setVoiceConversationHistory(prev => [...prev, { role: 'assistant', content: comfort }]);
      
      if (isTtsSupported()) {
        setVoiceStatus('replying');
        setIsSpeaking(true);
        setIsWaitingForReply(false);
        
        await speakText(comfort, language, {
          onEnd: () => {
            setIsSpeaking(false);
            setVoiceStatus('listening');
          }
        });
      } else {
        setVoiceStatus('idle');
      }
      setSupportMessage('現在網路有點小問題，我先用口袋裡的小暖心句子陪你 💌');
    }
  };

  const startVoiceInteraction = async () => {
    AudioService.playTick();
    
    cancelSpeech();

    if (voiceStatus === 'listening' || voiceStatus === 'replying') {
      stopVoiceInteraction();
      // 播报告别语
      if (isTtsSupported()) {
        const goodbye = language === Language.ZH_TW ? '很開心和你說話，下次再見囉！' : 
                        language === Language.ZH_HK ? '好開心同你傾偈，下次再見啦！' : 'Nice talking to you! See you next time!';
        speakText(goodbye, language, {});
      }
      return;
    }

    const supported = await isSpeechSupported();
    if (!supported) {
      setSupportMessage('目前這個裝置還不能聽懂語音，不過你可以在 AI 夥伴那邊用文字跟我聊聊，我一樣可以用心陪你。🌸');
      return;
    }

    setSupportMessage(null);
    setIsVoiceActive(true);
    setVoiceStatus('listening');
    setLiveTranscript('');
    setIsWaitingForReply(false);

    try {
      recognitionController.current = await startSpeechRecognition({
        language,
        silenceTimeoutMs: 2000, // 2秒停顿后触发回复
        onPartialResult: (text: string) => {
          setLiveTranscript(text);
        },
        onSilenceDetected: () => {
          const transcript = recognitionController.current?.getLastTranscript() || liveTranscript;
          if (transcript.trim() && !isWaitingForReply) {
            handleVoiceReply(transcript);
          }
        },
        onResult: async (text: string) => {
          if (!text.trim()) return;
          await handleVoiceReply(text);
        },
        onError: (error: any) => {
          console.error('Speech recognition error:', error);
          if (error === 'not-allowed' || error?.name === 'NotAllowedError') {
            setSupportMessage('系統沒有取得麥克風權限，所以聽不到你的聲音。如果你願意，可以到系統設定裡開啟麥克風，再回來找我說說話。💕');
          }
          stopVoiceInteraction();
        }
      });
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setSupportMessage('這個裝置目前無法啟動語音對話，但我還是可以用文字陪你聊天。🌸');
      stopVoiceInteraction();
    }
  };

  useEffect(() => { return () => stopVoiceInteraction(); }, []);

  const getStatusText = (): string => {
    switch (voiceStatus) {
      case 'listening':
        return '我在聽你說話唷，慢慢講就好。💗';
      case 'thinking':
        return '我在消化你說的話，等我一下下。✨';
      case 'replying':
        return '我想把這些話送給你...';
      case 'idle':
      default:
        return '和小棉花說說話，或是摸摸我吧！';
    }
  };

  return (
    <div className="flex flex-col h-full w-full garden-gradient no-scrollbar overflow-hidden">
      <ParticleBackground />
      <header className="app-safe-header px-6 flex justify-between items-center z-20">
        <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center shadow-sm active:scale-95 transition-transform"><span className="material-symbols-outlined text-soft-text/60">arrow_back_ios_new</span></button>
        <h1 className="text-lg font-bold text-soft-text">心靈探索</h1>
        <div className="w-10"></div>
      </header>
      <main className="flex-1 relative flex flex-col items-center justify-center px-1 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-yellow-100/30 rounded-full blur-[60px]"></div>
          <div className="absolute bottom-20 left-10 opacity-60"><span className="material-symbols-outlined text-pink-300 text-4xl">local_florist</span></div>
          <div className="absolute bottom-16 right-12 opacity-60"><span className="material-symbols-outlined text-blue-300 text-3xl">local_florist</span></div>
        </div>
        {hearts.map(heart => (
          <div key={heart.id} className="heart-particle" style={{ left: heart.left }}><span className="material-symbols-outlined fill-1">favorite</span></div>
        ))}
        <div className="relative z-10 mb-3 bg-white/90 backdrop-blur-lg px-6 py-4 rounded-[2rem] shadow-xl shadow-green-900/5 border border-white max-w-[260px] text-center">
          <p className="text-sm font-medium leading-relaxed">{getStatusText()}</p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 rotate-45 border-r border-b border-white/20"></div>
        </div>
        {(lastUserText || lastAiReply) && (
          <div className="relative z-10 mb-3 bg-white/90 backdrop-blur-lg px-4 py-3 rounded-2xl shadow-md border border-white/80 max-w-[280px] text-left">
            {lastUserText && (
              <p className="text-[11px] mb-1 leading-snug text-soft-text/80">
                <span className="font-semibold mr-1">你：</span>
                {lastUserText}
              </p>
            )}
            {lastAiReply && (
              <p className="text-[11px] leading-snug text-soft-text">
                <span className="font-semibold mr-1">小棉花：</span>
                {lastAiReply}
              </p>
            )}
          </div>
        )}
        {supportMessage && (
          <div className="relative z-10 mb-2 bg-amber-50/90 backdrop-blur px-3 py-2 rounded-2xl shadow-sm border border-amber-100 max-w-[260px] text-[11px] text-soft-text/80 text-left">
            {supportMessage}
          </div>
        )}
        <div className="relative z-20 marshmallow-float mb-4 cursor-pointer" onClick={handleCharacterClick}>
          <div className={`w-44 h-44 bg-white rounded-[4.5rem] relative flex items-center justify-center glow-effect border-4 border-white transition-all duration-300 ${isSpeaking ? 'scale-105 shadow-orange-200' : 'hover:scale-105'}`}>
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-8"><div className={`w-3 h-3 bg-soft-text rounded-full transition-all duration-300 ${isSpeaking ? 'translate-y-[-2px] scale-y-125' : ''}`}></div><div className={`w-3 h-3 bg-soft-text rounded-full transition-all duration-300 ${isSpeaking ? 'translate-y-[-2px] scale-y-125' : ''}`}></div></div>
              <div className={`transition-all duration-300 flex items-center justify-center ${isSpeaking ? 'w-5 h-5 bg-pink-400/20 border-2 border-soft-text rounded-full mouth-talk-anim' : 'w-7 h-1 border-b-2 border-soft-text rounded-full'}`}></div>
            </div>
            <div className="absolute left-8 top-1/2 w-5 h-2.5 bg-pink-100 rounded-full blur-[2px]"></div>
            <div className="absolute right-8 top-1/2 w-5 h-2.5 bg-pink-100 rounded-full blur-[2px]"></div>
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-36 h-6 bg-black/5 rounded-[100%] blur-sm"></div>
        </div>
        <div className="absolute inset-0 z-10 pointer-events-none">
          <button onClick={() => { AudioService.playTick(); onStartBreathing(); }} className="action-btn pointer-events-auto absolute top-[35%] left-[8%] hover:scale-105 active:scale-95 transition-all"><span className="material-symbols-outlined text-cyan-500 text-3xl mb-1">air</span><span className="text-[10px] font-bold">呼吸練習</span></button>
          
          <button onClick={() => { AudioService.playTick(); onStartVisualization(); }} className="action-btn pointer-events-auto absolute top-[35%] right-[8%] hover:scale-105 active:scale-95 transition-all"><span className="material-symbols-outlined text-indigo-500 text-3xl mb-1">rocket_launch</span><span className="text-[10px] font-bold">自信噴發</span></button>

          <button onClick={() => { AudioService.playTick(); onStartAffirmations(); }} className="action-btn pointer-events-auto absolute top-[55%] left-[6%] hover:scale-105 active:scale-95 transition-all"><span className="material-symbols-outlined text-amber-500 text-3xl mb-1">flare</span><span className="text-[10px] font-bold">每日肯定</span></button>
          
          <button id="voice-btn" onClick={startVoiceInteraction} className={`action-btn pointer-events-auto absolute bottom-[10%] left-1/2 -translate-x-1/2 !w-28 !h-28 shadow-2xl transition-all duration-500 border-4 ${isVoiceActive ? 'bg-candy-orange text-white border-white scale-110 animate-voice-pulse' : 'bg-white/90 text-candy-orange border-candy-orange/20'}`}>
            <span className={`material-symbols-outlined text-5xl mb-1 ${isVoiceActive && !isSpeaking ? 'animate-pulse' : ''} ${isSpeaking ? 'animate-bounce' : ''}`}>{isVoiceActive ? (isSpeaking ? 'graphic_eq' : 'mic') : 'settings_voice'}</span>
            <span className="text-[10px] font-bold">{isVoiceActive ? '結束通話' : '語音交流'}</span>
          </button>
          
          <button onClick={() => { AudioService.playTick(); onStartMeditation(); }} className="action-btn pointer-events-auto absolute top-[55%] right-[6%] hover:scale-105 active:scale-95 transition-all"><span className="material-symbols-outlined text-purple-400 text-3xl mb-1">self_improvement</span><span className="text-[10px] font-bold">靜心冥想</span></button>
        </div>
      </main>
    </div>
  );
};

// --- Sub-components: Meditation & Other Views ---

const MeditationListView: React.FC<{ onSelect: (id: string) => void, onBack: () => void }> = ({ onSelect, onBack }) => {
  const [showAll, setShowAll] = useState(false);
  
  // 分離引導式和純音樂練習
  const guidedMeditations = MEDITATION_PLAYLIST.filter(m => !m.isMusicOnly);
  const musicOnlyMeditations = MEDITATION_PLAYLIST.filter(m => m.isMusicOnly);
  
  // 默認顯示：3個引導式；純音樂全部顯示，避免被藏起來
  const defaultGuided = showAll ? guidedMeditations : guidedMeditations.slice(0, 3);
  const defaultMusicOnly = musicOnlyMeditations;

  return (
    <div className="flex flex-col h-full bg-stone-100 animate-in slide-in-from-right duration-500 overflow-hidden">
      <div className="h-[340px] app-safe-header-spacious px-6 flex flex-col items-center shrink-0" style={{background: 'linear-gradient(180deg, #1A2E1F 0%, #2D4030 100%)'}}>
        <div className="w-full flex items-center justify-between mb-8 z-20">
          <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-transform">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h1 className="text-white text-lg font-bold tracking-wide">靜心冥想</h1>
          <div className="w-10"></div>
        </div>
        <div className="relative mt-2">
          <div className="marshmallow-zen w-32 h-28 relative flex items-center justify-center marshmallow-bounce !bg-white">
            <div className="flex gap-6 mt-[-4px]">
              <div className="w-2.5 h-1 bg-soft-text rounded-full"></div>
              <div className="w-2.5 h-1 bg-soft-text rounded-full"></div>
            </div>
            <div className="absolute bottom-10 w-4 h-2 border-b-2 border-soft-text/40 rounded-full"></div>
          </div>
          <div className="absolute inset-0 bg-yellow-100/10 blur-2xl rounded-full scale-150"></div>
        </div>
        <p className="text-white/80 text-sm mt-8 text-center italic">找一個舒服的地方坐下，<br/>和我一起深呼吸...</p>
        <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 border border-white/20">
          <span className="material-symbols-outlined text-[14px] text-emerald-200">update</span>
          <span className="text-[11px] font-medium text-white/90">持續更新</span>
        </div>
      </div>
      <div className="flex-1 bg-stone-100 rounded-t-[3rem] -mt-10 z-10 p-6 pb-28 overflow-y-auto no-scrollbar">
        {/* 引導式冥想區塊 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-bold text-forest-dark">引導式冥想</h2>
            {!showAll && guidedMeditations.length > 3 && (
              <button 
                onClick={() => { AudioService.playTick(); setShowAll(true); }}
                className="text-sm text-forest-mid font-medium hover:text-candy-orange transition-colors active:scale-95"
              >
                查看全部
              </button>
            )}
          </div>
          <div className="space-y-4">
            {defaultGuided.map(item => (
            <div key={item.id} onClick={() => { AudioService.playTick(); onSelect(item.id); }} className="bg-white rounded-[2.5rem] p-5 border-b-4 border-stone-200 flex items-center gap-4 cursor-pointer active:translate-y-1 active:border-b-0 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className={`w-16 h-16 ${item.bg} rounded-3xl flex items-center justify-center ${item.color}`}>
                <span className="material-symbols-outlined text-3xl">{item.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-soft-text">{item.title}</h3>
                  {item.isMusicOnly && (
                    <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[9px] font-bold">純音樂</span>
                  )}
                </div>
                <p className="text-xs text-soft-text/60">{item.desc}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="bg-forest-dark/5 px-3 py-1 rounded-full text-[10px] font-bold text-forest-mid">{item.time}</span>
                <span className="material-symbols-outlined text-candy-orange">play_circle</span>
              </div>
            </div>
          ))}
          </div>
        </div>

        {/* 純音樂冥想區塊 */}
        {defaultMusicOnly.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center mb-4 px-2 gap-2">
              <span className="material-symbols-outlined text-purple-500 text-xl">music_note</span>
              <h2 className="text-xl font-bold text-forest-dark">純音樂冥想</h2>
            </div>
            <div className="space-y-4">
              {defaultMusicOnly.map(item => (
                <div key={item.id} onClick={() => { AudioService.playTick(); onSelect(item.id); }} className="bg-white rounded-[2.5rem] p-5 border-b-4 border-stone-200 flex items-center gap-4 cursor-pointer active:translate-y-1 active:border-b-0 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`w-16 h-16 ${item.bg} rounded-3xl flex items-center justify-center ${item.color}`}>
                    <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-soft-text">{item.title}</h3>
                      <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[9px] font-bold">純音樂</span>
                    </div>
                    <p className="text-xs text-soft-text/60">{item.desc}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="bg-forest-dark/5 px-3 py-1 rounded-full text-[10px] font-bold text-forest-mid">{item.time}</span>
                    <span className="material-symbols-outlined text-candy-orange">play_circle</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAll && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={() => { AudioService.playTick(); setShowAll(false); }}
              className="text-sm text-forest-mid font-medium hover:text-candy-orange transition-colors active:scale-95"
            >
              顯示精選
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MeditationPlayerView: React.FC<{ meditationId: string, onBack: () => void }> = ({ meditationId, onBack }) => {
  const meditation = MEDITATION_PLAYLIST.find(m => m.id === meditationId) || MEDITATION_PLAYLIST[0];
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(meditation.url);
    audioRef.current = audio;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    // Auto play attempt
    audio.play().then(() => setIsPlaying(true)).catch(e => console.log("Auto-play blocked", e));

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [meditation.url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    AudioService.playTick();
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (!audioRef.current) return;
    AudioService.playTick();
    audioRef.current.currentTime = Math.min(Math.max(0, audioRef.current.currentTime + seconds), duration);
  };

  // 支援拖曳跳轉到任意時間
  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const newTime = Number(event.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-meditation-bg animate-in fade-in duration-500 text-gray-200">
      <header className="px-6 pb-4 flex items-center justify-between z-10 app-safe-header">
        <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-gray-400">arrow_back_ios_new</span>
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center px-6 overflow-y-auto no-scrollbar">
        <div className="w-full glass-card rounded-[2.5rem] p-7 text-center mt-4 border-white/10">
          <span className="text-[10px] tracking-[0.25em] uppercase font-black text-accent-green mb-3 block opacity-80">
            {meditation.isMusicOnly ? '純音樂冥想' : '正在引導您的心靈'}
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight">{meditation.title}</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">{meditation.desc}</p>
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="material-symbols-outlined text-[14px] text-accent-green">update</span>
            <span className="text-[10px] font-medium text-gray-300">持續更新</span>
          </div>
          {meditation.isMusicOnly && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-purple-400 text-sm">music_note</span>
              <span className="text-[10px] text-gray-500 font-medium">無語音引導，純音樂陪伴</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 flex items-center justify-center py-8 relative w-full min-h-[300px]">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <div className={`absolute inset-0 bg-accent-green/10 rounded-full blur-[60px] transition-all duration-1000 ${isPlaying ? 'scale-125 opacity-100' : 'scale-90 opacity-40'}`}></div>
            <div className={`marshmallow-zen relative w-44 h-40 flex flex-col items-center justify-center transition-all duration-1000 bg-white/90 shadow-2xl ${isPlaying ? 'breath-scale' : ''}`}>
              <div className="flex gap-8 mb-4">
                <div className={`w-1.5 h-1 bg-gray-600 rounded-full transition-all ${isPlaying ? 'h-3 scale-y-125' : ''}`}></div>
                <div className={`w-1.5 h-1 bg-gray-600 rounded-full transition-all ${isPlaying ? 'h-3 scale-y-125' : ''}`}></div>
              </div>
              <div className="w-6 h-3 border-b-2 border-candy-orange rounded-full"></div>
            </div>
            <div className="absolute inset-0 border-2 border-accent-green/10 rounded-full"></div>
            <div className={`absolute inset-[-15px] border border-accent-green/5 rounded-full transition-all duration-1000 ${isPlaying ? 'rotate-180 scale-110' : ''}`}></div>
          </div>
        </div>

        <div className="w-full space-y-10 pb-24">
          <div className="space-y-3">
            <div className="relative w-full h-6 flex items-center">
              {/* 可拖曳進度條 */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={duration ? currentTime : 0}
                onChange={handleSeekChange}
                className="absolute inset-0 w-full h-6 opacity-0 cursor-pointer z-20"
              />
              <div className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="progress-bar-fill absolute left-0 top-0 h-full transition-all duration-300 bg-accent-green" 
                  style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                ></div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300"
                  style={{ left: duration ? `calc(${(currentTime / duration) * 100}% - 6px)` : '-6px' }}
                ></div>
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-black text-gray-500 tracking-widest uppercase">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-6">
            <button onClick={() => skip(-10)} className="material-symbols-outlined text-3xl text-gray-400 active:text-accent-green transition-colors">replay_10</button>
            <button onClick={togglePlay} className="w-20 h-20 flex items-center justify-center rounded-full bg-accent-green text-meditation-bg glow-effect active:scale-90 transition-transform shadow-xl shadow-emerald-900/40">
              <span className="material-symbols-outlined text-5xl fill-1">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button onClick={() => skip(10)} className="material-symbols-outlined text-3xl text-gray-400 active:text-accent-green transition-colors">forward_10</button>
          </div>
          
          <div className="flex items-center justify-between glass-card px-6 py-5 rounded-3xl border-white/5">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-accent-green ${isPlaying ? 'animate-pulse' : ''}`}>graphic_eq</span>
              <div className="flex flex-col">
                <span className="text-xs font-black text-gray-200 uppercase tracking-widest">高品質音質</span>
                <span className="text-[10px] text-gray-500 font-bold">由棉花糖精心挑選</span>
              </div>
            </div>
            <div onClick={togglePlay} className={`w-12 h-6 rounded-full relative shadow-inner cursor-pointer transition-colors ${isPlaying ? 'bg-accent-green' : 'bg-gray-600'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all ${isPlaying ? 'right-0.5' : 'left-0.5'}`}></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

interface NewMomentDrawerProps {
  onSave: (title: string, content: string, tags: string[], emoji: string) => void;
  onClose: () => void;
}

const NewMomentDrawer: React.FC<NewMomentDrawerProps> = ({ onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState('✨');
  const tags = ['自信', '勇氣', '平靜', '喜悅', '小確幸', '突破', '感恩', '成長', '學習', '挑戰', '成就', '關愛'];
  const emojis = ['✨', '🌸', '🌈', '💪', '☁️', '🎈', '🌿'];
  const handleToggleTag = (tag: string) => { AudioService.playTick(); setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]); };
  const handleSave = () => { if (!content.trim()) return; AudioService.playSuccess(); onSave(title.trim() || '我的自信瞬間', content, selectedTags, selectedEmoji); };

  return (
    <div className="absolute inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { AudioService.playTick(); onClose(); }}></div>
      <div className="relative bg-white rounded-t-[3rem] p-8 pb-12 animate-in slide-in-from-bottom duration-300 w-full">
        <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
        <div className="flex justify-between items-center mb-2"><h2 className="text-2xl font-bold text-soft-text">記錄自信瞬間</h2><button onClick={() => { AudioService.playTick(); onClose(); }} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-soft-text/40"><span className="material-symbols-outlined">close</span></button></div>
        <div className="space-y-6">
          <div className="space-y-3"><label className="text-xs font-bold text-soft-text/40 uppercase tracking-widest ml-1">標題</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="為這個瞬間起個標題..." className="w-full h-12 rounded-2xl border-2 border-bubble-border px-4 focus:border-candy-orange focus:ring-0 focus:outline-none text-soft-text placeholder:text-soft-text/30 font-medium" /></div>
          <div className="space-y-3"><label className="text-xs font-bold text-soft-text/40 uppercase tracking-widest ml-1">今天發生了什麼美好的事？</label><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="寫下讓你感到自信的瞬間..." className="w-full h-32 rounded-3xl border-2 border-bubble-border p-4 focus:border-candy-orange focus:ring-0 focus:outline-none text-soft-text placeholder:text-soft-text/30 resize-none font-medium" /></div>
          <div className="space-y-3"><label className="text-xs font-bold text-soft-text/40 uppercase tracking-widest ml-1">選擇心情圖標</label><div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">{emojis.map(e => (<button key={e} onClick={() => { AudioService.playSoftPop(); setSelectedEmoji(e); }} className={`shrink-0 w-12 h-12 rounded-2xl text-2xl flex items-center justify-center transition-all ${selectedEmoji === e ? 'bg-orange-100 ring-2 ring-candy-orange' : 'bg-gray-50'}`}>{e}</button>))}</div></div>
          <div className="space-y-3"><label className="text-xs font-bold text-soft-text/40 uppercase tracking-widest ml-1">添加標籤</label><div className="flex flex-wrap gap-2">{tags.map(t => (<button key={t} onClick={() => handleToggleTag(t)} className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${selectedTags.includes(t) ? 'bg-candy-orange border-candy-orange text-white' : 'bg-white border-bubble-border text-soft-text/60'}`}>#{t}</button>))}</div></div>
          <button onClick={handleSave} disabled={!content.trim()} className={`ios-button-marshmallow w-full h-16 text-white font-bold text-xl mt-4 flex items-center justify-center gap-3 ${!content.trim() ? 'opacity-50 grayscale' : ''}`}><span>珍藏這個瞬間</span><span className="material-symbols-outlined font-bold">check</span></button>
        </div>
      </div>
    </div>
  );
};

const DiaryTab: React.FC<{ entries: DiaryEntry[], onAddEntry: (entry: DiaryEntry) => void, profile: UserProfile }> = ({ entries, onAddEntry, profile }) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiResponses, setAiResponses] = useState<Record<string, { text: string; loading: boolean }>>({});
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 計算唯一天數（相同日期的多篇日記只算一天）
  const uniqueDays = new Set(entries.map(e => e.date.toDateString())).size;
  
  const handleSaveMoment = (title: string, content: string, tags: string[], emoji: string) => {
    const newEntry: DiaryEntry = { id: Date.now().toString(), date: new Date(), title, content, emoji, tags };
    // 使用 flushSync 確保日記立即更新到 DOM
    ReactDOM.flushSync(() => {
      onAddEntry(newEntry);
      setShowDrawer(false);
    });
    // 滾動到頂部讓用戶看到新日記
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  const generateAIResponse = async (entryId: string, title: string, content: string) => {
    AudioService.playTick();
    setAiResponses(prev => ({ ...prev, [entryId]: { text: '', loading: true } }));
    
    try {
      // 呼叫 API 生成個人化的暖心回覆
      const response = await generateDiaryResponse(title, content, profile.tone, profile.goals);
      AudioService.playSparkle();
      setAiResponses(prev => ({ ...prev, [entryId]: { text: response, loading: false } }));
    } catch (error) {
      console.error('生成回覆失敗:', error);
      // API 失敗時使用本地回覆
      const mockResponses = [
        "這真是一個充滿勇氣的瞬間！我為你感到驕傲。🌸",
        "太棒了！記錄下來的每一刻都是自信的種子。🌱",
        "看著你一點一滴進步，連我也跟著變甜了呢。✨",
        "這份努力值得被好好珍藏，你是最棒的。💖"
      ];
      const randomMsg = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      AudioService.playSparkle();
      setAiResponses(prev => ({ ...prev, [entryId]: { text: randomMsg, loading: false } }));
    }
  };

  const toggleSort = () => {
    AudioService.playTick();
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  };

  const filteredEntries = entries.filter(entry => 
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortOrder === 'newest') return b.date.getTime() - a.date.getTime();
    return a.date.getTime() - b.date.getTime();
  });

  return (
    <div className="flex flex-col h-full bg-cream-bg relative overflow-hidden">
      <ParticleBackground />
      <header className="app-safe-header pb-6 px-6 shrink-0 z-20">
        <div className="flex justify-between items-center mb-6">
          {!isSearching ? <h1 className="text-2xl font-black text-soft-text">自信歷程</h1> : 
            <input autoFocus type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="搜尋關鍵字或標籤..." className="flex-1 h-10 px-4 rounded-full border-2 border-orange-100 bg-white/80 focus:border-candy-orange focus:ring-0 text-sm mr-4" />}
          <div className="flex gap-2">
            {!isSearching ? (<>
              <button onClick={() => { AudioService.playTick(); setShowDrawer(true); }} className="w-10 h-10 rounded-full bg-candy-orange text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"><span className="material-symbols-outlined">add</span></button>
              <button onClick={() => { AudioService.playTick(); setIsSearching(true); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-soft-text/60"><span className="material-symbols-outlined">search</span></button>
            </>) : <button onClick={() => { AudioService.playTick(); setIsSearching(false); setSearchTerm(''); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-soft-text/60"><span className="material-symbols-outlined">close</span></button>}
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#FF8A5C] via-[#FFB347] to-[#FF8A5C] p-6 rounded-[2.5rem] text-white shadow-2xl shadow-orange-200/50 flex flex-col justify-between overflow-hidden relative">
          <div className="flex justify-between items-start z-10">
            <div className="flex flex-col">
              <p className="text-white/80 text-[11px] font-black uppercase tracking-[0.15em] mb-1">已持續播種自信</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black tracking-tighter">{uniqueDays}</span>
                <span className="text-lg font-bold">天</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 animate-pulse">
              <span className="material-symbols-outlined text-3xl">psychiatry</span>
            </div>
          </div>
          <div className="mt-8 flex justify-end z-10">
             <div className="text-[10px] font-black text-white/90 bg-black/10 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">下一階段：嫩芽期</div>
          </div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200/10 rounded-full blur-2xl"></div>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-2 space-y-5 no-scrollbar pb-32">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-black text-soft-text/40 tracking-widest uppercase px-1">最近的自信瞬間</h2>
          <div 
            onClick={toggleSort}
            className="flex items-center gap-1 text-[11px] text-candy-orange font-black cursor-pointer hover:opacity-80 transition-all active:scale-95"
          >
            <span>{sortOrder === 'newest' ? '最新優先' : '最舊優先'}</span>
            <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${sortOrder === 'oldest' ? 'rotate-180' : ''}`}>expand_more</span>
          </div>
        </div>

        {sortedEntries.map((entry) => (
          <div className="bg-white rounded-[2.5rem] p-1.5 shadow-xl shadow-orange-100/10 border border-orange-50 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden" key={entry.id}>
            <div className="flex gap-5 p-4 pr-6">
              <div className="flex flex-col items-center justify-center bg-[#FDFBF7] rounded-[1.8rem] w-16 h-18 border border-orange-50 shadow-inner shrink-0">
                <span className="text-[10px] font-black text-candy-orange uppercase tracking-wider mb-1">{entry.date.toLocaleString('zh-TW', { month: 'short' })}</span>
                <span className="text-2xl font-black text-soft-text leading-none">{entry.date.getDate()}</span>
              </div>
              <div className="flex-1 pt-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-[17px] text-soft-text leading-tight">{entry.title}</h3>
                  <span className="text-2xl drop-shadow-sm">{entry.emoji}</span>
                </div>
                <p className="text-[13px] text-soft-text/70 font-medium leading-relaxed mb-3 whitespace-pre-wrap">{entry.content}</p>
                <div className="flex gap-2 flex-wrap mb-4">
                  {entry.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-[#F0F9F6] text-[10px] text-[#5BCFB1] rounded-full font-black border border-[#D1F2E8]">#{tag}</span>
                  ))}
                </div>

                {!aiResponses[entry.id] && (
                  <button 
                    onClick={() => generateAIResponse(entry.id, entry.title, entry.content)}
                    className="flex items-center gap-2.5 text-[11px] font-black text-[#5BCFB1] bg-[#F0F9F6] hover:bg-[#E0F2E8] px-4 py-2.5 rounded-full transition-all active:scale-95 border border-[#D1F2E8] group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:animate-bounce">auto_awesome</span>
                    <span>棉花糖的暖心回覆</span>
                  </button>
                )}

                {aiResponses[entry.id] && (
                  <div className="mt-2 bg-[#F0F9F6] rounded-[1.5rem] p-4 border border-[#D1F2E8] animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[12px] text-candy-orange font-black">favorite</span>
                      </div>
                      <span className="text-[10px] font-black text-[#5BCFB1] uppercase tracking-widest">Marshmallow AI</span>
                    </div>
                    {aiResponses[entry.id].loading ? (
                      <div className="flex gap-1.5 py-1">
                        <div className="w-1.5 h-1.5 bg-[#5BCFB1] rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-[#5BCFB1] rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-[#5BCFB1] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    ) : (
                      <p className="text-[12px] font-bold text-soft-text leading-relaxed whitespace-pre-wrap italic">「{aiResponses[entry.id].text}」</p>
                    )}
                  </div>
                )}

                <button 
                  onClick={() => setSelectedEntry(entry)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-soft-text/50 hover:text-candy-orange transition-colors mt-2"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>查看詳情</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {sortedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center space-y-4">
            <span className="material-symbols-outlined text-6xl">{searchTerm ? 'search_off' : 'history_edu'}</span>
            <p className="font-bold">{searchTerm ? '找不到相關的記錄喔' : '還沒有記錄喔，\n快來記錄第一個自信瞬間吧！'}</p>
          </div>
        )}
      </main>

      {showDrawer && <NewMomentDrawer onSave={handleSaveMoment} onClose={() => setShowDrawer(false)} />}
      
      {selectedEntry && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6" onClick={() => setSelectedEntry(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedEntry(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-soft-text/40 hover:bg-gray-100 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col items-center justify-center bg-[#FDFBF7] rounded-[1.5rem] w-14 h-16 border border-orange-50 shadow-inner">
                <span className="text-[9px] font-black text-candy-orange uppercase tracking-wider">{selectedEntry.date.toLocaleString('zh-TW', { month: 'short' })}</span>
                <span className="text-xl font-black text-soft-text leading-none">{selectedEntry.date.getDate()}</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-soft-text leading-tight">{selectedEntry.title}</h2>
                <span className="text-2xl">{selectedEntry.emoji}</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-[1.5rem] p-5 mb-5">
              <p className="text-[15px] text-soft-text font-medium leading-relaxed whitespace-pre-wrap">{selectedEntry.content}</p>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedEntry.tags.map(tag => (
                <span key={tag} className="px-4 py-1.5 bg-[#F0F9F6] text-xs text-[#5BCFB1] rounded-full font-black border border-[#D1F2E8]">#{tag}</span>
              ))}
            </div>
            
            <button 
              onClick={() => setSelectedEntry(null)}
              className="ios-button-marshmallow w-full h-12 text-white font-bold rounded-full mt-2"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportTab: React.FC<{ onBack: () => void; userId: string; diaryEntries: DiaryEntry[] }> = ({ onBack, userId, diaryEntries }) => {
  const [showLockHint, setShowLockHint] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 加載或生成成長報告
  useEffect(() => {
    const loadReport = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      try {
        // 嘗試獲取現有報告
        let existingReport = await getLatestGrowthReport(userId, 'monthly');
        
        if (!existingReport) {
          // 如果沒有現有報告，生成新的
          existingReport = await generateGrowthReport(userId, 'monthly');
        }
        
        setReport(existingReport);
      } catch (error) {
        console.error('載入報告失敗:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();
  }, [userId]);

  // 從報告或日記計算情緒數據
  const moodData = React.useMemo(() => {
    if (report?.mood_data && report.mood_data.length > 0) {
      return report.mood_data;
    }
    
    // 如果沒有報告數據，從日記計算
    if (diaryEntries.length === 0) {
      return [
        { date: '今天', val: 50, note: '開始記錄你的第一篇日記吧！🌸' }
      ];
    }
    
    // 選擇最近30天內的日記，最多6個數據點
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentEntries = diaryEntries
      .filter(e => e.date >= thirtyDaysAgo && e.date <= now)
      .slice(0, 6);
    
    if (recentEntries.length === 0) {
      return [
        { date: '今天', val: 50, note: '開始記錄你的第一篇日記吧！🌸' }
      ];
    }
    
    return recentEntries.map(entry => {
      let moodValue = 50;
      if (entry.emoji === '😊' || entry.emoji === '😄' || entry.emoji === '✨') {
        moodValue = 80;
      } else if (entry.emoji === '🙂' || entry.emoji === '💪' || entry.emoji === '🌸') {
        moodValue = 65;
      } else if (entry.emoji === '😐' || entry.emoji === '😌') {
        moodValue = 50;
      } else if (entry.emoji === '😔' || entry.emoji === '😢') {
        moodValue = 35;
      }
      
      const note = entry.content.length > 25 
        ? entry.content.substring(0, 25) + '...' 
        : entry.content;
      
      const dateStr = entry.date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
      return { date: dateStr, val: moodValue, note };
    });
  }, [report, diaryEntries]);

  // 計算成長分數
  const growthScores = report?.growth_scores || {
    social: 50,
    confidence: 50,
    work: 50,
    health: 50,
    courage: 50
  };

  // 計算成就
  const achievements = React.useMemo(() => {
    if (report?.achievements && report.achievements.length > 0) {
      return report.achievements;
    }
    
    // 從日記計算成就
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentEntries = diaryEntries.filter(e => e.date >= thirtyDaysAgo && e.date <= now);
    
    const earnedAchievements: { id: string; name: string; icon: string }[] = [];
    
    if (recentEntries.length >= 1) {
      earnedAchievements.push({ id: 'first_diary', name: '自信紀錄', icon: 'edit_note' });
    }
    if (recentEntries.length >= 3) {
      earnedAchievements.push({ id: 'three_day_streak', name: '初試身手', icon: 'self_improvement' });
    }
    if (recentEntries.length >= 7) {
      earnedAchievements.push({ id: 'week_streak', name: '一週持續', icon: 'local_fire_department' });
    }
    if (recentEntries.length >= 14) {
      earnedAchievements.push({ id: 'two_week_streak', name: '雙週持續', icon: 'whatshot' });
    }
    if (recentEntries.length >= 21) {
      earnedAchievements.push({ id: 'monthly_complete', name: '月度圓滿', icon: 'stars' });
    }
    if (recentEntries.length >= 10) {
      earnedAchievements.push({ id: 'ten_entries', name: '十篇日記', icon: 'book' });
    }
    
    return earnedAchievements;
  }, [report, diaryEntries]);

  // 獲取棉花糖訊息
  const marshmallowMessage = report?.marshmallow_message || 
    '很高興看到你這段時間的成長！每一天的記錄都是自信的累積，繼續加油，我一直都在陪著你。✨';

  // 獲取摘要統計
  const summary = report?.summary || {
    total_diary_entries: diaryEntries.length,
    average_mood: moodData.length > 0 ? Math.round(moodData.reduce((sum, d) => sum + d.val, 0) / moodData.length) : 50,
    streak_days: 0,
    top_category: '一般'
  };

  // 獲取本月天數
  const currentMonth = new Date().toLocaleDateString('zh-TW', { month: 'long' });

  // 計算雷達圖數據點
  const getRadarPoint = (score: number, index: number) => {
    const angles = [270, 330, 30, 150, 210]; // 逆時針從頂部開始
    const angle = (angles[index] * Math.PI) / 180;
    const radius = (score / 100) * 60;
    return {
      x: 100 + radius * Math.cos(angle),
      y: 100 + radius * Math.sin(angle)
    };
  };

  const svgWidth = 300;
  const svgHeight = 160;
  const paddingX = 40;
  const paddingY = 30;
  const chartHeight = svgHeight - (paddingY * 2);
  const chartWidth = svgWidth - (paddingX * 2);

  const getY = (val: number) => svgHeight - paddingY - (val / 100) * chartHeight;
  const getX = (index: number) => paddingX + (index / Math.max(moodData.length - 1, 1)) * chartWidth;

  const baselineY = getY(0);

  const generatePath = () => {
    if (moodData.length < 2) return '';
    let d = `M ${getX(0)} ${getY(moodData[0].val)}`;
    for (let i = 0; i < moodData.length - 1; i++) {
      const x1 = getX(i);
      const y1 = getY(moodData[i].val);
      const x2 = getX(i + 1);
      const y2 = getY(moodData[i + 1].val);
      const cp1x = x1 + (x2 - x1) / 2;
      const cp1y = y1;
      const cp2x = x1 + (x2 - x1) / 2;
      const cp2y = y2;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }
    return d;
  };

  const pathData = generatePath();
  const areaData = `${pathData} L ${getX(moodData.length - 1)} ${baselineY} L ${getX(0)} ${baselineY} Z`;

  // 處理分享功能
  const handleShare = async () => {
    AudioService.playTick();
    
    const shareText = `
🌸 棉花糖夥伴 - 成長報告 🌸

📅 報告期間：${currentMonth}
📝 總記錄天數：${summary.total_diary_entries} 天
💝 平均心情指數：${summary.average_mood}%

🏆 達成成就：
${achievements.map(a => `- ${a.name}`).join('\n') || '尚未解鎖成就'}

💬 棉花糖的話：
${marshmallowMessage}

#棉花糖夥伴 #自信成長
    `.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: '棉花糖夥伴 - 成長報告',
          text: shareText
        });
      } catch (err) {
        console.log('分享取消');
      }
    } else {
      // 複製到剪貼簿
      navigator.clipboard.writeText(shareText).then(() => {
        alert('報告已複製到剪貼簿！📋');
      }).catch(() => {
        alert(shareText);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-cream-bg relative overflow-hidden">
        <ParticleBackground />
        <header className="app-safe-header pb-6 px-6 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-soft-text/60">arrow_back_ios_new</span>
          </button>
          <h1 className="text-xl font-black tracking-tight text-soft-text">月度成長報告</h1>
          <div className="w-10"></div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-candy-orange border-t-transparent rounded-full animate-spin"></div>
            <p className="text-soft-text/60 font-bold">正在生成你的專屬報告...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-cream-bg relative overflow-hidden">
      <ParticleBackground />
      <header className="app-safe-header pb-6 px-6 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-soft-text/60">arrow_back_ios_new</span>
        </button>
        <h1 className="text-xl font-black tracking-tight text-soft-text">{currentMonth}成長報告</h1>
        <button onClick={handleShare} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-soft-text/60">share</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-8 no-scrollbar pb-28">
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="text-2xl font-black text-soft-text">情緒波動</h2>
            <span className="text-[12px] font-black text-candy-orange bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100/50 shadow-sm">
              {summary.average_mood >= 70 ? '持續進步中' : summary.average_mood >= 50 ? '穩定成長' : '需要多愛自己'} 💪
            </span>
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-orange-100/30 border border-orange-50 relative overflow-visible flex flex-col gap-4">
            <div className="flex gap-4 mb-4 px-1 justify-start">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF8A5C]"></div>
                <span className="text-[10px] font-black text-soft-text/40 uppercase tracking-widest">興奮躍動</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#A8E6CF]"></div>
                <span className="text-[10px] font-black text-soft-text/40 uppercase tracking-widest">平穩安適</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#81D4FA]"></div>
                <span className="text-[10px] font-black text-soft-text/40 uppercase tracking-widest">靜心放鬆</span>
              </div>
            </div>

            <div className="w-full relative overflow-visible">
              <svg 
                className="w-full h-auto overflow-visible" 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <rect x="0" y={getY(100)} width={svgWidth} height={getY(70) - getY(100)} fill="#FFF4E6" fillOpacity="0.3" rx="4" />
                <rect x="0" y={getY(70)} width={svgWidth} height={getY(30) - getY(70)} fill="#F0F9F6" fillOpacity="0.3" rx="4" />
                <rect x="0" y={getY(30)} width={svgWidth} height={getY(0) - getY(30)} fill="#F0F7FF" fillOpacity="0.3" rx="4" />
                
                <line x1="0" y1={getY(30)} x2={svgWidth} y2={getY(30)} stroke="#D1E8F5" strokeDasharray="6 4" strokeWidth="1.5" />
                <line x1="0" y1={getY(70)} x2={svgWidth} y2={getY(70)} stroke="#E5F3EF" strokeDasharray="6 4" strokeWidth="1.5" />
                <line x1="0" y1={getY(0)} x2={svgWidth} y2={getY(0)} stroke="#E5E7EB" strokeWidth="1" />

                <defs>
                  <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8A5C" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#FF8A5C" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <path d={areaData} fill="url(#moodGradient)" className="animate-in fade-in duration-1000" />
                
                <path 
                  d={pathData} 
                  fill="none" 
                  stroke="#FF8A5C" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="animate-[draw_2s_ease-out_forwards]"
                  style={{ strokeDasharray: 1000, strokeDashoffset: 1000 }}
                />

                {moodData.map((d, i) => (
                  <g 
                    key={i} 
                    className="cursor-pointer group" 
                    onClick={() => { AudioService.playTick(); setSelectedPoint(i === selectedPoint ? null : i); }}
                  >
                    <circle cx={getX(i)} cy={getY(d.val)} r="10" fill="transparent" />
                    <circle 
                      cx={getX(i)} 
                      cy={getY(d.val)} 
                      r={selectedPoint === i ? 7 : 5} 
                      fill="white" 
                      stroke="#FF8A5C" 
                      strokeWidth="2.5" 
                      className="transition-all duration-300 group-hover:r-7" 
                    />
                  </g>
                ))}

                {moodData.map((d, i) => (
                  <text 
                    key={`label-${i}`} 
                    x={getX(i)} 
                    y={svgHeight - 4} 
                    textAnchor="middle" 
                    className="text-[10px] font-black fill-soft-text/30 tracking-tight"
                  >
                    {d.date}
                  </text>
                ))}
              </svg>

              {selectedPoint !== null && (
                <div 
                  className="absolute z-30 transition-all duration-300 pointer-events-none" 
                  style={{ 
                    left: `${(getX(selectedPoint) / svgWidth) * 100}%`, 
                    top: `${(getY(moodData[selectedPoint].val) / svgHeight) * 100}%`, 
                    transform: 'translate(-50%, -125%)' 
                  }}
                >
                  <div className="bg-white border-2 border-candy-orange/20 rounded-[1.5rem] p-4 shadow-[0_15px_35px_rgba(255,138,92,0.25)] min-w-[150px] animate-in zoom-in-90 fade-in duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black text-candy-orange uppercase tracking-widest">{moodData[selectedPoint].date}</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-candy-orange text-[14px]">face_6</span>
                        <span className="text-xs font-black text-soft-text">{moodData[selectedPoint].val}%</span>
                      </div>
                    </div>
                    <p className="text-[12px] leading-relaxed font-bold text-soft-text/80 italic">「{moodData[selectedPoint].note}」</p>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-candy-orange/20 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-[11px] font-black text-soft-text/25 italic leading-relaxed">
              ✨ 點擊圖表中的圓點，查看棉花糖對你的心情紀錄 ✨
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-soft-text">核心成長領域</h2>
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-orange-100/20 border border-orange-50 flex flex-col items-center py-10">
            <div className="relative w-56 h-56">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200">
                <polygon fill="none" points="100,20 180,75 150,165 50,165 20,75" stroke="#F5F5F5" strokeWidth="1.5"></polygon>
                <polygon fill="none" points="100,50 150,85 130,140 70,140 50,85" stroke="#F5F5F5" strokeWidth="1.5"></polygon>
                <polygon 
                  className="radar-shape fill-candy-orange/10 stroke-candy-orange" 
                  points={`100,${100 - growthScores.confidence * 0.6} ${100 + growthScores.courage * 0.52},${100 + growthScores.courage * 0.3} ${100 + growthScores.work * 0.52},${100 + growthScores.work * 0.3} ${100 + growthScores.health * 0.3},${165 - growthScores.health * 0.15} ${100 - growthScores.social * 0.3},${165 - growthScores.social * 0.15} ${100 - growthScores.social * 0.52},${100 + growthScores.social * 0.3}`}
                ></polygon>
                
                <text fill="#5D5747" fontSize="11" fontWeight="900" textAnchor="middle" x="100" y="12">社交 {growthScores.social}%</text>
                <text fill="#5D5747" fontSize="11" fontWeight="900" textAnchor="start" x="185" y="78">自信 {growthScores.confidence}%</text>
                <text fill="#5D5747" fontSize="11" fontWeight="900" textAnchor="middle" x="160" y="180">工作 {growthScores.work}%</text>
                <text fill="#5D5747" fontSize="11" fontWeight="900" textAnchor="middle" x="40" y="180">健康 {growthScores.health}%</text>
                <text fill="#5D5747" fontSize="11" fontWeight="900" textAnchor="end" x="15" y="78">勇氣 {growthScores.courage}%</text>
              </svg>
            </div>
            <div className="mt-10 p-5 bg-orange-50/50 rounded-[2rem] border border-orange-100/50 text-center">
              <p className="text-sm font-bold text-soft-text/80 leading-relaxed px-2">
                做得好！你在<span className="text-candy-orange font-black mx-1">{summary.top_category || '各'}領域</span>的記錄很棒。繼續保持，讓<span className="text-candy-orange font-black">自信心</span>持續提升！🌸
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-soft-text">達成成就</h2>
          <div className="grid grid-cols-3 gap-4">
            {achievements.length > 0 ? (
              achievements.slice(0, 3).map((achievement) => (
                <div key={achievement.id} className="flex flex-col items-center group cursor-pointer transition-transform active:scale-95" onClick={() => AudioService.playSparkle()}>
                  <div className="achievement-badge shadow-[0_8px_0_#FFE4B5] bg-gradient-to-br from-[#FFF8F0] to-[#FFEBD0] border-2 border-white">
                    <span className="material-symbols-outlined text-candy-orange text-3xl">{achievement.icon}</span>
                  </div>
                  <span className="text-[11px] font-black text-center leading-tight mt-1 text-soft-text">{achievement.name}</span>
                </div>
              ))
            ) : (
              <>
                <div className="flex flex-col items-center group cursor-pointer transition-transform active:scale-95 opacity-40 grayscale" onClick={() => AudioService.playTick()}>
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-soft-text/20 bg-transparent flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-soft-text/40 text-3xl">lock</span>
                  </div>
                  <span className="text-[11px] font-black text-center leading-tight text-soft-text/40">記錄<br/>日記</span>
                </div>
                <div className="flex flex-col items-center group cursor-pointer transition-transform active:scale-95 opacity-40 grayscale" onClick={() => AudioService.playTick()}>
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-soft-text/20 bg-transparent flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-soft-text/40 text-3xl">lock</span>
                  </div>
                  <span className="text-[11px] font-black text-center leading-tight text-soft-text/40">持續<br/>記錄</span>
                </div>
                <div className="flex flex-col items-center group cursor-pointer transition-transform active:scale-95 opacity-40 grayscale" onClick={() => AudioService.playTick()}>
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-soft-text/20 bg-transparent flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-soft-text/40 text-3xl">lock</span>
                  </div>
                  <span className="text-[11px] font-black text-center leading-tight text-soft-text/40">月度<br/>圓滿</span>
                </div>
              </>
            )}
            {achievements.length < 3 && (
              <div className="flex flex-col items-center relative">
                <div onClick={() => { AudioService.playTick(); setShowLockHint(!showLockHint); }} className="w-16 h-16 rounded-2xl border-2 border-dashed border-soft-text/20 bg-transparent flex items-center justify-center mb-2 cursor-pointer opacity-40 grayscale transition-transform active:scale-95">
                  <span className="material-symbols-outlined text-soft-text/40 text-3xl">lock</span>
                </div>
                <span className="text-[11px] font-black text-center leading-tight text-soft-text/40">更多<br/>成就</span>
                {showLockHint && (
                  <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 w-32 bg-forest-dark text-white text-[10px] p-2 rounded-xl shadow-xl z-20 animate-in fade-in zoom-in-90 duration-200">
                    <div className="text-center font-bold">解鎖條件</div>
                    <div className="mt-1 opacity-80 text-center leading-normal">持續記錄日記來解鎖更多成就！✨</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-forest-dark"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="p-8 bg-candy-orange rounded-[3rem] text-white shadow-xl shadow-orange-200/50 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined">format_quote</span>
              棉花糖的話
            </h3>
            <p className="text-[15px] font-bold leading-relaxed opacity-95">
              {marshmallowMessage}
            </p>
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </section>
      </main>

      <div className="absolute -z-10 top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-40 -left-10 w-64 h-64 bg-bubble-green rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 -right-10 w-64 h-64 bg-candy-orange rounded-full blur-3xl"></div>
      </div>
      
      <style>{`
        @keyframes draw {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

// --- Sub-components: SettingsTab ---

const SettingsTab: React.FC<{ 
  onBack: () => void, 
  onLogout: () => void,
  appTheme: string,
  onThemeChange: (t: string) => void,
  profile: UserProfile,
  onUpdateProfile: (p: UserProfile) => void
}> = ({ onBack, onLogout, appTheme, onThemeChange, profile, onUpdateProfile }) => {
  const [subView, setSubView] = useState<SettingsSubView>(SettingsSubView.MAIN);
  const [notifs, setNotifs] = useState({ daily: true, encouragement: true, growth: false });
  const [encourageSettings, setEncourageSettings] = useState({ enabled: true, time: '09:00' });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [showEmail, setShowEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const Toggle = ({ active, onToggle }: { active: boolean, onToggle: () => void }) => (<div onClick={() => { AudioService.playTick(); onToggle(); }} className={`w-12 h-6 rounded-full relative transition-all cursor-pointer ${active ? 'bg-candy-orange' : 'bg-gray-200'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${active ? 'right-1' : 'left-1'}`}></div></div>);
  const SubHeader = ({ title }: { title: string }) => (<header className="app-safe-header pb-6 px-6 flex justify-between items-center bg-gradient-to-b from-orange-50/30 to-transparent shrink-0"><button onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.MAIN); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform"><span className="material-symbols-outlined text-soft-text/60">arrow_back_ios_new</span></button><h1 className="text-lg font-bold">{title}</h1><div className="w-10"></div></header>);
  
  const handleAvatarClick = () => {
    AudioService.playTick();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        AudioService.playSparkle();
        onUpdateProfile({ ...profile, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleEncouragement = async () => {
    const newState = !encourageSettings.enabled;
    if (newState && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('請開啟通知權權限，以便棉花糖能為你送上鼓勵！🌸');
        return;
      }
    }
    setEncourageSettings(prev => ({ ...prev, enabled: newState }));
  };

  const renderContent = () => {
    switch (subView) {
      case SettingsSubView.NOTIFICATIONS:
        return (<div className="flex flex-col h-full animate-in slide-in-from-right duration-300"><SubHeader title="通知偏好設定" /><main className="px-6 space-y-4"><div className="bg-white rounded-[2rem] p-6 shadow-sm border border-orange-50/50 space-y-6"><div className="flex items-center justify-between"><div className="flex flex-col"><span className="font-bold text-soft-text">每日暖心提醒</span><span className="text-xs text-soft-text/50">在早晨為你送上第一份勇氣</span></div><Toggle active={notifs.daily} onToggle={() => setNotifs(p => ({...p, daily: !p.daily}))} /></div><div className="flex items-center justify-between"><div className="flex flex-col"><span className="font-bold text-soft-text">成長報告週報</span><span className="text-xs text-soft-text/50">每週末回顧你的自信足跡</span></div><Toggle active={notifs.growth} onToggle={() => setNotifs(p => ({...p, daily: p.daily, growth: !p.growth}))} /></div></div></main></div>);
      case SettingsSubView.ENCOURAGEMENT:
        return (
          <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
            <SubHeader title="鼓勵訊息設定" />
            <main className="px-6 space-y-6">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-orange-50/50 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-soft-text">開啟每日鼓勵</span>
                    <span className="text-[11px] text-soft-text/40 font-bold leading-relaxed">棉花糖會在指定時間為你送上<br/>專屬的自信悄悄話 🌸</span>
                  </div>
                  <Toggle active={encourageSettings.enabled} onToggle={handleToggleEncouragement} />
                </div>
                
                <div className={`space-y-4 transition-all duration-300 ${encourageSettings.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none grayscale'}`}>
                  <label className="text-[10px] font-black text-candy-orange uppercase tracking-[0.15em] ml-1">預選送達時間</label>
                  <div className="relative">
                    <input 
                      type="time" 
                      value={encourageSettings.time}
                      onChange={(e) => { AudioService.playTick(); setEncourageSettings(prev => ({ ...prev, time: e.target.value })); }}
                      className="w-full h-16 bg-orange-50/50 rounded-3xl border-2 border-orange-100 px-6 font-black text-soft-text text-xl focus:ring-0 focus:border-candy-orange transition-all"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="material-symbols-outlined text-candy-orange">schedule</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-bubble-green/10 rounded-[2rem] border-2 border-dashed border-emerald-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="material-symbols-outlined text-emerald-500 text-sm">info</span>
                    <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">離線送達說明</span>
                  </div>
                  <p className="text-[12px] font-medium text-soft-text/60 leading-relaxed">
                    開啟後，即使應用程式處於後台或關閉狀態，棉花糖也會透過系統通知準時出現唷！✨
                  </p>
                </div>
              </div>
            </main>
          </div>
        );
      case SettingsSubView.SUBSCRIPTION:
        return (<div className="flex flex-col h-full animate-in slide-in-from-right duration-500 bg-cream-bg overflow-y-auto no-scrollbar pb-28"><SubHeader title="訂閱方案管理" /><main className="px-6 space-y-6"><div className="text-center space-y-2 mt-4"><h2 className="text-2xl font-black text-soft-text">升級你的<span className="text-candy-orange">幸福等級</span></h2><p className="text-xs font-bold text-soft-text opacity-50">解鎖更多暖心功能，讓自信開花結果</p></div><div className="flex justify-center"><div className="bg-gray-100 p-1.5 rounded-full flex items-center shadow-inner"><button onClick={() => { AudioService.playTick(); setBillingCycle('monthly'); }} className={`px-8 py-2.5 rounded-full text-xs font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white text-candy-orange shadow-md scale-[1.02]' : 'text-soft-text/40'}`}>按月付</button><button onClick={() => { AudioService.playTick(); setBillingCycle('yearly'); }} className={`px-8 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-white text-candy-orange shadow-md scale-[1.02]' : 'text-soft-text/40'}`}>按年付<span className="bg-emerald-400 text-[10px] px-2 py-0.5 rounded-md text-white">省 20%</span></button></div></div><div className="bg-gradient-to-br from-candy-orange to-primary rounded-[3rem] p-8 text-white shadow-2xl border-[6px] border-white/20 relative overflow-hidden transition-transform active:scale-[0.98]"><div className="absolute top-6 right-6 bg-yellow-400 text-candy-orange text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg animate-bounce border-2 border-white z-20">首月 HK$9.9</div><div className="relative z-10"><div className="flex items-center gap-4 mb-6"><div className="w-14 h-14 bg-white/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md border-2 border-white/30"><span className="material-symbols-outlined text-4xl">stars</span></div><div><h3 className="text-xl font-black">進階版 Premium</h3><p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Full Experience</p></div></div><div className="flex flex-col mb-8"><div className="flex items-baseline gap-2"><span className="text-5xl font-black">HK$ {billingCycle === 'monthly' ? '9.9' : '191'}</span><span className="text-sm font-bold opacity-50">/ {billingCycle === 'monthly' ? '月' : '年'}</span></div>{billingCycle === 'monthly' && <p className="text-xs font-bold text-yellow-300 mt-2">首月僅需 HK$9.9，續費 HK$19.9/月</p>}{billingCycle === 'yearly' && <p className="text-xs font-bold text-yellow-300 mt-2">年費方案：一次付費可省 20%</p>}</div><div className="space-y-4 mb-10">{['無限次 AI 夥伴深度對話', '24H 即時語音交流互動', '解鎖完整冥想與呼吸庫', '深度自信成長分析報告', '自定義棉花糖外觀與主題'].map((feat, idx) => (<div key={idx} className="flex items-center gap-3"><span className="material-symbols-outlined text-xl text-yellow-400">check_circle</span><span className="text-xs font-bold leading-tight">{feat}</span></div>))}</div><button onClick={() => AudioService.playSuccess()} className="w-full bg-white text-candy-orange h-16 rounded-[2rem] font-black text-xl shadow-xl transition-all active:scale-[0.95] flex items-center justify-center gap-2"><span>立即升級</span><span className="material-symbols-outlined">arrow_forward</span></button></div><div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div><div className="absolute top-20 -left-20 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div></div><div className="bg-white/80 rounded-[2.5rem] p-8 border border-gray-100 opacity-80 shadow-sm transition-all"><div className="flex items-center gap-4 mb-6"><div className="w-14 h-14 bg-gray-50 rounded-[1.5rem] flex items-center justify-center border border-gray-100"><span className="material-symbols-outlined text-soft-text/30 text-3xl">face_6</span></div><div><h3 className="text-xl font-black text-soft-text">基礎版 Basic</h3><p className="text-[10px] font-bold text-soft-text opacity-30 uppercase tracking-widest">Entry Level</p></div></div><div className="flex items-baseline gap-2 mb-8"><span className="text-5xl font-black text-soft-text">免費</span><span className="text-sm font-bold text-soft-text opacity-30">/ 永遠</span></div><div className="space-y-4 mb-8">{['每日 20 則基礎對話', '入門呼吸練習', '簡單日記'].map((feat, idx) => (<div key={idx} className="flex items-center gap-3"><span className="material-symbols-outlined text-xl text-emerald-400">check</span><span className="text-xs font-bold text-soft-text/60 leading-tight">{feat}</span></div>))}</div><button disabled className="w-full bg-gray-100 text-soft-text opacity-30 h-16 rounded-[2rem] font-black text-lg border-2 border-gray-200/50 cursor-not-allowed">目前使用的方案</button></div><p className="text-center text-[10px] font-bold text-soft-text opacity-30 px-8 pb-10 leading-relaxed">確認購買即表示同意我們的服務條款與隱私權政策。訂閱會自動續期，您隨時可以在系統設置中取消。</p></main></div>);
      case SettingsSubView.APPEARANCE:
        return (<div className="flex flex-col h-full animate-in slide-in-from-right duration-300"><SubHeader title="外觀設定" /><main className="px-6 space-y-4"><div className="bg-white rounded-[2rem] p-6 shadow-sm border border-orange-50/50 space-y-4"><span className="text-xs font-bold text-soft-text/40 uppercase tracking-widest block mb-2">主題配色</span>{[{ id: 'Classic Orange', label: '經典橙 (預設)', primary: '#FF9F43', secondary: '#FF8A5C' }, { id: 'Mint Breeze', label: '薄荷清風', primary: '#A8E6CF', secondary: '#5BCFB1' }, { id: 'Lavender Soft', label: '薰衣草柔和', primary: '#D1C4E9', secondary: '#9575CD' }].map(theme => (<div key={theme.id} onClick={() => { AudioService.playSoftPop(); onThemeChange(theme.id); }} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${appTheme === theme.id ? 'border-candy-orange bg-orange-50/30' : 'border-gray-50'}`}><div className="flex items-center gap-4"><div className="flex -space-x-3"><div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: theme.primary }}></div><div className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: theme.secondary }}></div></div><span className="font-bold text-soft-text">{theme.label}</span></div>{appTheme === theme.id ? <span className="material-symbols-outlined text-candy-orange">radio_button_checked</span> : <span className="material-symbols-outlined text-soft-text/20">radio_button_unchecked</span>}</div>))}</div></main></div>);
      case SettingsSubView.PRIVACY:
        return (<div className="flex flex-col h-full animate-in slide-in-from-right duration-300"><SubHeader title="隱私與安全" /><main className="px-6 space-y-4"><div className="bg-white rounded-[2rem] p-6 shadow-sm border border-orange-50/50 space-y-6"><div className="flex items-center justify-between"><div className="flex flex-col"><span className="font-bold text-soft-text">生物辨識鎖定</span><span className="text-xs text-soft-text/50">開啟 Face ID 或指紋解鎖</span></div><Toggle active={true} onToggle={() => {}} /></div><div className="flex items-center justify-between"><div className="flex flex-col"><span className="font-bold text-soft-text">對話加密保護</span><span className="text-xs text-soft-text/50">確保你的心情只有我們知道</span></div><span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full">已開啟</span></div><button onClick={() => AudioService.playTick()} className="w-full text-left py-3 text-red-400 font-bold text-sm">刪除個人帳號與所有紀錄</button></div></main></div>);
      case SettingsSubView.HELP:
        return (<div className="flex flex-col h-full animate-in slide-in-from-right duration-300"><SubHeader title="幫助與回饋" /><main className="px-6 space-y-4 overflow-y-auto no-scrollbar pb-20"><div className="bg-white rounded-[2rem] p-6 shadow-sm border border-orange-50/50 space-y-4"><h3 className="font-bold text-soft-text mb-2">常見問題</h3><div className="p-4 bg-gray-50 rounded-2xl"><p className="text-sm font-bold text-soft-text">如何更換 AI 的語氣？</p><p className="text-xs text-soft-text/60 mt-1">在對話框上方可以直接點擊語氣標籤進行切換喔！</p></div><div className="p-4 bg-gray-50 rounded-2xl"><p className="text-sm font-bold text-soft-text">我的日記會被別人看到嗎？</p><p className="text-xs text-soft-text/60 mt-1">絕對不會的，所有的紀錄都經過加密保護，只有你能閱讀。</p></div></div><div className="space-y-4"><button onClick={() => { AudioService.playTick(); setShowEmail(!showEmail); }} className="candy-button w-full h-14 text-white font-bold text-lg transition-all">聯繫客服棉花糖</button>{showEmail && <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 border-orange-100 text-center animate-in fade-in slide-in-from-top-2 duration-300"><p className="text-xs font-bold text-soft-text/40 uppercase tracking-widest mb-1">客服電子郵件</p><p className="text-lg font-black text-candy-orange select-all">wongqq1017@gmail.com</p></div>}</div></main></div>);
      default:
        return (
          <div className="flex flex-col h-full">
            <header className="app-safe-header-settings pb-4 px-6 flex justify-between items-center bg-gradient-to-b from-orange-50/30 to-transparent shrink-0">
              <button onClick={() => { AudioService.playTick(); onBack(); }} className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-95 transition-transform"><span className="material-symbols-outlined text-soft-text/60">arrow_back_ios_new</span></button>
              <h1 className="text-lg font-bold">個人化設置</h1>
              <div className="w-10"></div>
            </header>
            <main className="flex-1 overflow-y-auto px-6 py-2 no-scrollbar pb-28">
              <div className="flex flex-col items-center py-6 mb-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
                <div 
                  className="relative mb-3 group cursor-pointer transition-transform hover:scale-105 active:scale-95" 
                  onClick={handleAvatarClick}
                >
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-white overflow-hidden flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center relative overflow-hidden">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-14 h-12 bg-white rounded-full relative flex flex-col items-center justify-center pt-2">
                          <div className="flex gap-3 mb-1"><div className="w-1.5 h-1.5 bg-soft-text rounded-full"></div><div className="w-1.5 h-1.5 bg-soft-text rounded-full"></div></div>
                          <div className="w-4 h-1 border-b-2 border-candy-orange rounded-full"></div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 bg-candy-orange w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white shadow-md">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-soft-text">{profile.nickname || '沐光之行者'}</h2>
                <p className="text-xs text-soft-text/50 mt-1 tracking-wide font-medium">✨ 正在穩定累積勇氣能量</p>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-orange-50/50 overflow-hidden">
                  <div onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.NOTIFICATIONS); }} className="flex items-center justify-between p-4 active:bg-orange-50/30 transition-colors cursor-pointer border-b border-orange-50/50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mr-4 bg-blue-50 text-blue-400"><span className="material-symbols-outlined">notifications</span></div>
                      <span className="font-medium">通知偏好設定</span>
                    </div>
                    <span className="material-symbols-outlined text-soft-text/30">chevron_right</span>
                  </div>
                  <div onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.ENCOURAGEMENT); }} className="flex items-center justify-between p-4 active:bg-orange-50/30 transition-colors cursor-pointer border-b border-orange-50/50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mr-4 bg-orange-50 text-candy-orange"><span className="material-symbols-outlined">campaign</span></div>
                      <span className="font-medium">鼓勵訊息設定</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-soft-text/30 font-bold">{encourageSettings.enabled ? encourageSettings.time : '已關閉'}</span>
                      <span className="material-symbols-outlined text-soft-text/30">chevron_right</span>
                    </div>
                  </div>
                  <div onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.SUBSCRIPTION); }} className="flex items-center justify-between p-4 active:bg-orange-50/30 transition-colors cursor-pointer border-b border-orange-50/50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mr-4 bg-purple-50 text-purple-400"><span className="material-symbols-outlined">stars</span></div>
                      <span className="font-medium">訂閱方案管理</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-candy-orange font-bold">Premium</span>
                      <span className="material-symbols-outlined text-soft-text/30">chevron_right</span>
                    </div>
                  </div>
                  <div onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.APPEARANCE); }} className="flex items-center justify-between p-4 active:bg-orange-50/30 transition-colors cursor-pointer">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mr-4 bg-orange-50 text-candy-orange"><span className="material-symbols-outlined">palette</span></div>
                      <span className="font-medium">應用程式外觀設定</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-candy-orange"></div>
                      <span className="material-symbols-outlined text-soft-text/30">chevron_right</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-orange-50/50 overflow-hidden">
                  <div onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.PRIVACY); }} className="flex items-center justify-between p-4 active:bg-orange-50/30 transition-colors cursor-pointer border-b border-orange-50/50">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mr-4 bg-green-50 text-green-400"><span className="material-symbols-outlined">security</span></div>
                      <span className="font-medium">隱私與安全</span>
                    </div>
                    <span className="material-symbols-outlined text-soft-text/30">chevron_right</span>
                  </div>
                  <div onClick={() => { AudioService.playTick(); setSubView(SettingsSubView.HELP); }} className="flex items-center justify-between p-4 active:bg-orange-50/30 transition-colors cursor-pointer">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mr-4 bg-gray-50 text-gray-400"><span className="material-symbols-outlined">help_outline</span></div>
                      <span className="font-medium">幫助與回饋</span>
                    </div>
                    <span className="material-symbols-outlined text-soft-text/30">chevron_right</span>
                  </div>
                </div>
                <button onClick={() => { AudioService.playTick(); onLogout(); }} className="w-full py-4 text-center text-soft-text/40 text-sm font-medium active:text-candy-orange transition-colors">登出帳號</button>
              </div>
            </main>
          </div>
        );
    }
  };
  return (<div className="flex flex-col h-full bg-cream-bg relative overflow-hidden">{renderContent()}<div className="absolute -z-10 top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden"><div className="absolute top-10 -right-10 w-48 h-48 bg-candy-orange/10 rounded-full blur-3xl"></div><div className="absolute bottom-40 -left-10 w-40 h-40 bg-bubble-green/10 rounded-full blur-3xl"></div></div></div>);
};

// --- Main App Component ---

export default function App() {
  const [view, setView] = useState<AppView>(AppView.WELCOME);
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.CHAT);
  const [exploreView, setExploreView] = useState<ExploreSubView>(ExploreSubView.HUB);
  const [selectedMeditationId, setSelectedMeditationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ nickname: '', email: '', tone: Tone.GENTLE, customTone: '', goals: [], growthArea: undefined });
  const [firstEntry, setFirstEntry] = useState('');
  const [signupStatus, setSignupStatus] = useState<{userId: string, needsConfirmation: boolean} | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showTour, setShowTour] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('marshmallow-theme') || 'Classic Orange');
  const [chatLanguage, setChatLanguage] = useState<Language>(() => (localStorage.getItem('marshmallow-chat-language') as Language) || Language.ZH_TW);
  const chatRef = useRef<any>(null);
  const exploreChatRef = useRef<MarshmallowChat | null>(null);
  
  // Supabase 狀態
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [signupPassword, setSignupPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 檢查登入狀態
  useEffect(() => {
    console.log('checkAuth useEffect 執行');
    const checkAuth = async () => {
      try {
        console.log('checkAuth 開始執行');
        
        // 處理郵箱確認 URL
        try {
          const confirmationSession = await handleEmailConfirmation();
          if (confirmationSession) {
            console.log('郵箱確認成功');
          }
        } catch (e) {
          console.log('處理郵箱確認時發生錯誤（可能已過期）:', e);
        }
        
        // 等待一下讓 URL 參數被處理（Google OAuth 回調時需要）
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 先嘗試獲取 session（處理 OAuth 回調）
        let session = await getSession();
        console.log('getSession 返回:', session);
        
        // 如果沒有 session，嘗試獲取 user
        let user = session?.user || await getCurrentUser();
        console.log('getCurrentUser 返回:', user);
        
        if (user) {
          console.log('用戶已登入，ID:', user.id);
          setCurrentUserId(user.id);
          // 加載用戶數據
          const [userProfile, userDiaries, userSettings] = await Promise.all([
            getUserProfile(user.id).catch(() => null),
            getDiaryEntries(user.id).catch(() => []),
            getUserSettings(user.id).catch(() => null)
          ]);
          
          if (userProfile) {
            setProfile({
              nickname: userProfile.nickname,
              email: user.email || '',
              tone: (userProfile.tone as Tone) || Tone.GENTLE,
              goals: userProfile.goals || [],
              language: (userProfile.language as Language) || Language.ZH_TW,
              avatarUrl: userProfile.avatar_url
            });
          }
          
          if (userDiaries.length > 0) {
            setDiaryEntries(userDiaries);
          }
          
          if (userSettings) {
            setAppTheme(userSettings.theme || 'Classic Orange');
          }
          
          // 根據用戶資料決定導航
          console.log('checkAuth - userProfile:', userProfile);
          console.log('checkAuth - userProfile?.nickname:', userProfile?.nickname);
          console.log('checkAuth - userProfile?.tone:', userProfile?.tone);
          if (userProfile?.nickname && userProfile?.tone) {
            // 已完成設定的用戶進入儀表板
            console.log('導航到 DASHBOARD');
            setView(AppView.DASHBOARD);
          } else {
            // 新用戶從步驟 2/4 開始，先設定 email
            console.log('導航到 SIGNUP_2');
            setProfile(prev => ({...prev, email: user.email || ''}));
            setView(AppView.SIGNUP_2);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // 監聽認證狀態變化
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('onAuthStateChange event:', event, 'session:', session?.user?.id);
      
      // 處理 OAuth 回調後的 session（可能是 SIGNED_IN 或 INITIAL_SESSION）
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        console.log('認證事件觸發，用戶 ID:', session.user.id);
        setCurrentUserId(session.user.id);
        
        // Google 登入完成後，檢查用戶資料並導航
        console.log('正在獲取用戶資料...');
        const userProfile = await getUserProfile(session.user.id).catch(() => null);
        console.log('onAuthStateChange - userProfile:', userProfile);
        
        if (userProfile?.nickname && userProfile?.tone) {
          // 已完成設定的用戶進入儀表板
          console.log('onAuthStateChange 導航到 DASHBOARD');
          setProfile({
            nickname: userProfile.nickname,
            email: session.user.email || '',
            tone: (userProfile.tone as Tone) || Tone.GENTLE,
            goals: userProfile.goals || [],
            language: (userProfile.language as Language) || Language.ZH_TW,
            avatarUrl: userProfile.avatar_url
          });
          setView(AppView.DASHBOARD);
        } else {
          // 新用戶從步驟 2/4 開始
          console.log('onAuthStateChange 導航到 SIGNUP_2');
          setProfile(prev => ({...prev, email: session.user.email || ''}));
          setView(AppView.SIGNUP_2);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // 初始化 TTS provider
  useEffect(() => {
    if (!TTS_CONFIG.useExternal) {
      setExternalTtsProvider(null);
      console.log('Using browser TTS (no external provider)');
      return;
    }

    switch (TTS_CONFIG.ttsProvider) {
      case 'gtts':
        setExternalTtsProvider(createGTTsProvider());
        console.log('gTTS provider initialized (free, no API key required)');
        break;
      case 'textread':
        setExternalTtsProvider(createTextReadTtsProvider());
        console.log('TextReadTTS provider initialized (free, supports Cantonese zh-HK)');
        break;
      case 'qwen3':
        setExternalTtsProvider(createQwen3TtsProvider());
        console.log('Qwen3-TTS provider initialized (free 500k chars/month, supports Cantonese)');
        break;
      case 'cantonese':
        setExternalTtsProvider(createCantoneseTtsProvider());
        console.log('Cantonese.ai provider initialized (requires API key)');
        break;
      case 'edge':
        setExternalTtsProvider(createEdgeTtsProvider());
        console.log('Edge TTS provider initialized (NOT WORKING on iOS!)');
        break;
      case 'qwen':
        setExternalTtsProvider(createQwenTtsProvider());
        console.log('Qwen WebSocket TTS provider initialized');
        break;
      case 'edgeproxy':
        setExternalTtsProvider(createEdgeProxyTtsProvider());
        console.log('Edge Proxy TTS provider initialized (free, supports Cantonese)');
        break;
      default:
        setExternalTtsProvider(null);
        console.log('Using browser TTS');
    }
  }, []);

  const tourSteps: TourStep[] = [
    { title: "歡迎來到棉花糖旅程！", content: "讓我帶你簡單認識一下你的新空間，這裡將陪伴你建立滿滿的自信。", position: 'center' },
    { title: "暖心 AI 夥伴", content: "這裡是你的對話空間。無論何時，我都在這裡聽你分享心情，並給予你最溫柔的支持。", position: 'bottom' },
    { title: "心靈探索功能", content: "這裡有呼吸練習與冥想。當你感到焦慮時，來這裡找回平靜吧。", position: 'bottom' },
    { title: "自信日記記錄", content: "點擊這個大按鈕，隨時記錄下值得肯定的瞬間. 一個小成就都值得被珍藏！", position: 'bottom' },
    { title: "成長報告週報", content: "我們會根據你的心情與記錄，為你整理出自信成長的軌跡。", position: 'bottom' },
    { title: "與我互動", content: "點擊上方的小棉花，我也會對你的關心做出回應唷！", position: 'top' },
  ];

  useEffect(() => { localStorage.setItem('marshmallow-theme', appTheme); applyThemeToDOM(appTheme); }, [appTheme]);
  useEffect(() => { localStorage.setItem('marshmallow-chat-language', chatLanguage); }, [chatLanguage]);

  useEffect(() => {
    if (view === AppView.DASHBOARD) {
      chatRef.current = createMarshmallowChat(profile.tone, profile.goals, chatLanguage);
      exploreChatRef.current = createMarshmallowChat(profile.tone, profile.goals, chatLanguage);
      if (chatMessages.length === 0) {
        const name = profile.nickname || '親愛的朋友';
        setChatMessages([{ 
          role: 'model', 
          text: `嘿，${name}！今天感覺如何呢？🌸 我準備好聽你分享任何大小事了，讓我們一起開啟這段溫暖的對話吧！✨`, 
          timestamp: new Date() 
        }]);
      }
    }
  }, [view, profile.nickname, profile.tone, profile.goals, chatLanguage]);

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    
    if (chatRef.current) {
      setIsAiThinking(true);
      try {
        const replyText = await sendMessage(chatRef.current, text);
        const assistantMsg = { role: 'model', text: replyText, timestamp: new Date() };
        setChatMessages(prev => [...prev, assistantMsg]);
        
        // 保存聊天記錄到 Supabase
        if (currentUserId) {
          const messagesToSave = [...chatMessages, userMsg, assistantMsg].map(m => ({
            role: m.role,
            content: m.text,
            timestamp: m.timestamp?.toISOString()
          }));
          try {
            await saveChatHistory(currentUserId, messagesToSave);
          } catch (e) {
            console.error('保存聊天記錄失敗:', e);
          }
        }
      } finally {
        setIsAiThinking(false);
      }
    }
  };

  const handleExploreVoiceText = async (text: string): Promise<string> => {
    if (!exploreChatRef.current) {
      exploreChatRef.current = createMarshmallowChat(profile.tone, profile.goals, chatLanguage);
    }

    try {
      const raw = await sendExploreVoiceMessage(exploreChatRef.current, text);
      if (!raw || isSuspiciousVoiceReply(raw)) {
        const comfort = getLocalComfortText(chatLanguage);
        return normalizeVoiceReply(comfort);
      }
      return normalizeVoiceReply(raw);
    } catch {
      const comfort = getLocalComfortText(chatLanguage);
      return normalizeVoiceReply(comfort);
    }
  };

  const handleClearHistory = () => {
    chatRef.current = createMarshmallowChat(profile.tone, profile.goals, chatLanguage);
    setChatMessages([{ role: 'model', text: `紀錄已經清空囉！讓我們重新開始吧。✨`, timestamp: new Date() }]);
  };

  const handleToneChange = async (newTone: Tone) => {
    setProfile(p => ({ ...p, tone: newTone }));
    setChatMessages(prev => [...prev, { role: 'model', text: `我切換到新的對話模式囉！現在是以「${newTone === Tone.GENTLE ? '溫柔' : newTone === Tone.HUMOROUS ? '幽默' : '理性'}」的方式來陪你。✨`, timestamp: new Date() }]);
    
    // 保存到 Supabase
    if (currentUserId) {
      try {
        await updateUserProfile(currentUserId, { tone: newTone });
      } catch (e) {
        console.error('保存設定失敗:', e);
      }
    }
  };

  // 步驟 4/4：使用者輸入時直接儲存草稿
  const handleSaveDraft = (content: string) => {
    if (content && content.trim()) {
      const draftEntry: DiaryEntry = {
        id: 'draft_first_entry',
        date: new Date(),
        title: '踏出第一步的勇氣',
        content: content,
        emoji: '✨',
        tags: ['新開始', '自信萌芽']
      };
      setDiaryEntries([draftEntry]);
    }
  };

  const completeSignup = async () => {
    console.log('completeSignup called', { signupStatus, firstEntry });
    
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/6ec7e21f-7e22-4787-b298-f61a2081c79f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:completeSignup',message:'completeSignup started',data:{signupStatus:signupStatus,firstEntry:firstEntry},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    try {
      // 如果有用戶 ID（說明步驟 1 註冊成功）
      const userId = signupStatus?.userId;
      console.log('UserId from signupStatus:', userId);
      
      if (userId) {
        setCurrentUserId(userId);
        
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/6ec7e21f-7e22-4787-b298-f61a2081c79f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:completeSignup',message:'userId exists, updating profile',timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // 更新用戶資料（tone, goals, growthArea 等）
        try {
          await updateUserProfile(signupStatus.userId, {
            nickname: profile.nickname,
            tone: profile.tone,
            customTone: profile.customTone || null,
            goals: profile.goals,
            growthArea: profile.growthArea || null,
            language: profile.language
          });
        } catch (e) {
          console.error('更新用戶資料失敗:', e);
        }
        
        // 日記已在步驟 4 輸入時自動保存（草稿），這裡只需要確保保存到 Supabase
        if (firstEntry && firstEntry.trim()) {
          const draftEntry = diaryEntries.find(e => e.id === 'draft_first_entry');
          if (draftEntry) {
            const finalEntry: DiaryEntry = { 
              ...draftEntry,
              id: Date.now().toString(), 
            };
            
            try {
              await saveDiaryEntry(signupStatus.userId, finalEntry);
              setDiaryEntries([finalEntry]);
            } catch (e) {
              console.error('保存日記失敗:', e);
            }
          }
        }
        
        // 進入儀表板
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/6ec7e21f-7e22-4787-b298-f61a2081c79f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:completeSignup',message:'going to DASHBOARD',timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        setView(AppView.DASHBOARD);
        setShowTour(true);
      } else {
        // 沒有 userId，仍然允許進入應用程式
        setView(AppView.DASHBOARD);
        setShowTour(true);
      }
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/6ec7e21f-7e22-4787-b298-f61a2081c79f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:completeSignup',message:'error caught, going to DASHBOARD',data:{error:error?.message},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      console.error('completeSignup 錯誤:', error);
      // 即使發生錯誤，也允許進入應用程式
      setView(AppView.DASHBOARD);
      setShowTour(true);
    }
  };

  const handleAddDiaryEntry = async (entry: DiaryEntry) => { 
    setDiaryEntries(prev => [entry, ...prev]);
    // 如果用戶已登入，保存到 Supabase
    if (currentUserId) {
      try {
        await saveDiaryEntry(currentUserId, entry);
      } catch (error) {
        console.error('保存日記失敗:', error);
      }
    }
  };

  const handleSaveAffirmationToDiary = (text: string) => {
    const newEntry: DiaryEntry = { 
      id: Date.now().toString(), 
      date: new Date(), 
      title: '心靈肯定句', 
      content: text, 
      emoji: '✨', 
      tags: ['每日肯定', '能量滿滿'] 
    };
    handleAddDiaryEntry(newEntry);
    alert('肯定句已珍藏到你的日記囉！🌸');
  };

  const renderDashboardTab = () => {
    switch (activeTab) {
      case DashboardTab.CHAT: return <ChatTab messages={chatMessages} onSendMessage={handleSendMessage} currentTone={profile.tone} onToneChange={handleToneChange} onClearHistory={handleClearHistory} userGoals={profile.goals} onUpdateGoals={(g) => setProfile(p => ({...p, goals: g}))} onSuggestionClick={(sv) => { setActiveTab(DashboardTab.EXPLORE); setExploreView(sv); }} isAiThinking={isAiThinking} chatLanguage={chatLanguage} onChatLanguageChange={setChatLanguage} />;
      case DashboardTab.EXPLORE:
        switch (exploreView) {
          case ExploreSubView.HUB: return <ExploreHub onBack={() => { AudioService.playTick(); setActiveTab(DashboardTab.CHAT); }} onStartBreathing={() => setExploreView(ExploreSubView.BREATHING)} onStartMeditation={() => setExploreView(ExploreSubView.MEDITATION_LIST)} onStartAffirmations={() => setExploreView(ExploreSubView.AFFIRMATIONS)} onStartVisualization={() => setExploreView(ExploreSubView.VISUALIZATION)} onVoiceTextCaptured={handleExploreVoiceText} language={chatLanguage} profile={profile} />;
          case ExploreSubView.BREATHING: return <BreathingView onBack={() => setExploreView(ExploreSubView.HUB)} />;
          case ExploreSubView.AFFIRMATIONS: return <AffirmationView onBack={() => setExploreView(ExploreSubView.HUB)} profile={profile} onSaveToDiary={handleSaveAffirmationToDiary} />;
          case ExploreSubView.VISUALIZATION: return <VisualizationView onBack={() => setExploreView(ExploreSubView.HUB)} profile={profile} />;
          case ExploreSubView.MEDITATION_LIST: return <MeditationListView onBack={() => setExploreView(ExploreSubView.HUB)} onSelect={(id) => { setSelectedMeditationId(id); setExploreView(ExploreSubView.MEDITATION_PLAYER); }} />;
          case ExploreSubView.MEDITATION_PLAYER: return <MeditationPlayerView meditationId={selectedMeditationId || '1'} onBack={() => setExploreView(ExploreSubView.MEDITATION_LIST)} />;
          default: return null;
        }
      case DashboardTab.DIARY: return <DiaryTab entries={diaryEntries} onAddEntry={handleAddDiaryEntry} profile={profile} />;
      case DashboardTab.REPORT: return <ReportTab onBack={() => { AudioService.playTick(); setActiveTab(DashboardTab.CHAT); }} userId={currentUserId || ''} diaryEntries={diaryEntries} />;
      case DashboardTab.SETTINGS: return <SettingsTab onBack={() => { AudioService.playTick(); setActiveTab(DashboardTab.CHAT); }} onLogout={async () => { 
        try {
          await signOut();
        } catch (e) {
          console.error('登出錯誤:', e);
        }
        setView(AppView.WELCOME); 
        setActiveTab(DashboardTab.CHAT); 
        setChatMessages([]);
        setCurrentUserId(null);
        setProfile({ nickname: '', email: '', tone: Tone.GENTLE, goals: [] });
        setDiaryEntries([]);
      }} appTheme={appTheme} onThemeChange={setAppTheme} profile={profile} onUpdateProfile={setProfile} />;
      default: return null;
    }
  };

  const renderCurrentView = () => {
    switch (view) {
      case AppView.WELCOME: return <WelcomeScreen onNext={() => setView(AppView.SIGNUP_1)} onLogin={() => setView(AppView.LOGIN)} />;
      case AppView.LOGIN: return <LoginScreen 
        onBack={() => setView(AppView.WELCOME)} 
        onSignup={() => setView(AppView.SIGNUP_1)}
        onLogin={() => { 
          setProfile(prev => ({...prev, nickname: '老朋友'}));
          setView(AppView.SIGNUP_2); 
        }} 
        onLoginWithData={async (userId, userProfile) => {
          setCurrentUserId(userId);
          setProfile({
            nickname: userProfile?.nickname || '棉花糖夥伴',
            email: userProfile?.email || '',
            tone: (userProfile?.tone as Tone) || Tone.GENTLE,
            goals: userProfile?.goals || [],
            language: (userProfile?.language as Language) || Language.ZH_TW,
            avatarUrl: userProfile?.avatar_url
          });
          // 加載日記
          const diaries = await getDiaryEntries(userId).catch(() => []);
          if (diaries.length > 0) {
            setDiaryEntries(diaries);
          }
          // 已註冊過的用戶直接進入儀表板
          if (userProfile?.nickname && userProfile?.tone) {
            setView(AppView.DASHBOARD);
          } else {
            // 新用戶從步驟 2/4 開始
            setView(AppView.SIGNUP_2);
          }
        }} 
      />;
      case AppView.SIGNUP_1: return <SignupStep1 
        profile={profile} 
        setProfile={setProfile} 
        onNext={() => setView(AppView.SIGNUP_2)} 
        onBack={() => setView(AppView.WELCOME)} 
        onLogin={() => setView(AppView.LOGIN)} 
        onViewTerms={() => setView(AppView.TERMS)} 
        onViewPrivacy={() => setView(AppView.PRIVACY)}
        password={signupPassword}
        setPassword={setSignupPassword}
        onSignupComplete={(userId, needsConfirmation) => {
          setSignupStatus({ userId, needsConfirmation });
        }}
      />;
      case AppView.SIGNUP_2: return <SignupStep2 tone={profile.tone} setTone={(t) => setProfile(p => ({ ...p, tone: t }))} onNext={() => setView(AppView.SIGNUP_3)} onBack={() => setView(AppView.SIGNUP_1)} />;
      case AppView.SIGNUP_3: return <SignupStep3 goals={profile.goals} setGoals={(g) => setProfile(p => ({ ...p, goals: g }))} onNext={() => setView(AppView.SIGNUP_4)} onBack={() => setView(AppView.SIGNUP_2)} />;
      case AppView.SIGNUP_4: return <SignupStep4 firstEntry={firstEntry} setFirstEntry={setFirstEntry} onComplete={completeSignup} onBack={() => setView(AppView.SIGNUP_3)} onSaveDraft={handleSaveDraft} />;
      case AppView.TERMS: return <LegalScreen title="服務條款" onBack={() => setView(AppView.SIGNUP_1)} content={`歡迎使用棉花糖夥伴！我們很高興能陪你一起成長。

1. 服務目標
本應用程式旨在透過對話與練習，協助使用者建立自信、減輕壓力和探索自我。我們致力於提供一個安全且充滿支持的環境。

2. 使用者守則
當你進入這個空間，請保持誠實與友好的態度。本服務僅供個人使用，請勿將其用於非法目的或對他人造成傷害。

3. 關於 AI 夥伴
棉花糖 AI 是你的暖心陪伴者。雖然它能提供情緒支持與建議，但它並非專業的醫療、心理諮商或法律服務。若你正處於極度心理危機中，請尋求專業醫療協助。

4. 智慧財產權
應用程式內的設計、內容與棉花糖形象均受版權保護。請尊重我們的創作。

5. 終止服務
你隨時可以選擇登出或刪除帳號，結束這段旅程。我們尊重你的選擇。

讓我們一起慢慢變好，謝謝你選擇棉花糖夥伴。`} />;
      case AppView.PRIVACY: return <LegalScreen title="隱私權政策" onBack={() => setView(AppView.SIGNUP_1)} content={`你的隱私對我們至關重要。以下是我們如何守護你的心聲：

1. 我們蒐集的資訊
為了提供個人化的暖心體驗，我們會記錄你的暱稱、對話內容、自信目標以及日記紀錄。這些資訊能幫助棉花糖更精準地回應你的需求。

2. 資訊的使用方式
你的數據僅用於改善 AI 的對話品質、生成個人化報告以及提供更貼合你的心理支持。

3. 資訊安全保護
我們採用先進的加密技術保護你的所有紀錄。就像守護寶藏一樣，你的數據僅儲存在安全的伺服器中。

4. 你的權利
你擁有對自己數據的完整主權。你隨時可以查看、修改或徹底刪除你的所有對話紀錄與個人資訊。

5. 第三方揭露
我們絕不會將你的對話內容或個人資訊出售、租借或轉讓給任何第三方公司或廣告商。

如果你有任何隱私相關的疑慮，隨時歡迎與我們聯繫。棉花糖會一直守護你的祕密。`} />;
      case AppView.DASHBOARD: 
        const isMeditationPlayer = activeTab === DashboardTab.EXPLORE && exploreView === ExploreSubView.MEDITATION_PLAYER;
        return (
          <div className="flex flex-col h-full w-full relative bg-cream-bg text-rounded font-rounded">
            <div className={`flex-1 overflow-hidden relative ${isMeditationPlayer ? 'bg-meditation-bg' : ''}`}>{renderDashboardTab()}</div>
            {showTour && <GuidedTour steps={tourSteps} onComplete={() => setShowTour(false)} />}
            <nav className={`bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center pb-safe z-40 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] ${isMeditationPlayer ? 'bg-card-dark border-white/5' : 'bg-white/80 backdrop-blur-xl'}`}>
              <style>{`
                .pb-safe {
                    padding-bottom: calc(12px + env(safe-area-inset-bottom));
                }
              `}</style>
              <button onClick={() => { AudioService.playTick(); setActiveTab(DashboardTab.CHAT); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === DashboardTab.CHAT ? 'text-candy-orange font-bold' : (isMeditationPlayer ? 'text-gray-500' : 'text-soft-text/40')}`}><span className={`material-symbols-outlined text-[28px] ${activeTab === DashboardTab.CHAT ? 'fill-current' : ''}`}>chat_bubble</span><span className="text-[10px]">AI 夥伴</span></button>
              <button onClick={() => { AudioService.playTick(); setActiveTab(DashboardTab.EXPLORE); setExploreView(ExploreSubView.HUB); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === DashboardTab.EXPLORE ? 'text-candy-orange font-bold' : (isMeditationPlayer ? 'text-gray-500' : 'text-soft-text/40')}`}><span className={`material-symbols-outlined text-[28px] ${activeTab === DashboardTab.EXPLORE ? 'fill-current' : ''}`}>explore</span><span className="text-[10px]">心靈探索</span></button>
              <button onClick={() => { AudioService.playTick(); setActiveTab(DashboardTab.DIARY); }} className="flex flex-col items-center gap-1 relative group">
                <div className={`rounded-full flex items-center justify-center transition-all ${activeTab === DashboardTab.DIARY ? 'w-14 h-14 -mt-10 bg-candy-orange shadow-lg shadow-orange-200 border-4 border-cream-bg text-white' : (isMeditationPlayer ? 'diary-btn shadow-orange-500/20' : 'w-12 h-12 -mt-8 bg-soft-text/40 border-4 border-cream-bg text-white')}`}><span className="material-symbols-outlined text-[28px]">edit_note</span></div>
                <span className={`text-[10px] ${activeTab === DashboardTab.DIARY ? 'text-candy-orange font-bold' : (isMeditationPlayer ? 'text-gray-500' : 'text-soft-text/40')}`}>日記</span>
              </button>
              <button onClick={() => { AudioService.playTick(); setActiveTab(DashboardTab.REPORT); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === DashboardTab.REPORT ? 'text-candy-orange font-bold' : (isMeditationPlayer ? 'text-gray-500' : 'text-soft-text/40')}`}><span className={`material-symbols-outlined text-[28px] ${activeTab === DashboardTab.REPORT ? 'fill-current' : ''}`}>leaderboard</span><span className="text-[10px]">成長報告</span></button>
              <button onClick={() => { AudioService.playTick(); setActiveTab(DashboardTab.SETTINGS); }} className={`flex flex-col items-center gap-1 transition-all ${activeTab === DashboardTab.SETTINGS ? 'text-candy-orange font-bold' : (isMeditationPlayer ? 'text-gray-500' : 'text-soft-text/40')}`}><span className={`material-symbols-outlined text-[28px] ${activeTab === DashboardTab.SETTINGS ? 'fill-current' : ''}`}>settings</span><span className="text-[10px]">設置</span></button>
            </nav>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="h-screen w-screen overflow-visible bg-gray-100 flex items-center justify-center">
      <div className="mobile-frame h-full w-full">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center bg-cream-bg">
            <div className="marshmallow-ai w-24 h-24 flex items-center justify-center border-4 border-white overflow-hidden mb-6">
              <div className="flex gap-8 mt-[-10px] items-center justify-center w-full">
                <div className="relative w-4 h-5 bg-soft-text rounded-full shrink-0">
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                <div className="relative w-4 h-5 bg-soft-text rounded-full shrink-0">
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="absolute bottom-10 left-8 w-4 h-2 bg-pink-200 blur-sm rounded-full"></div>
              <div className="absolute bottom-10 right-8 w-4 h-2 bg-pink-200 blur-sm rounded-full"></div>
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-6 h-3 border-b-2 border-soft-text/60 rounded-full"></div>
            </div>
            <div className="w-8 h-8 border-4 border-candy-orange/30 border-t-candy-orange rounded-full animate-spin mb-4"></div>
            <p className="text-soft-text font-bold">載入中...</p>
          </div>
        ) : (
          renderCurrentView()
        )}
      </div>
    </div>
  );
}
