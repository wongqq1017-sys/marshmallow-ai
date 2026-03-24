import { Tone, Category, Language } from "../types";
import { DEEPSEEK_CONFIG } from "./apiConfig";

// 根據語言獲取回覆指示
const languageInstruction = {
  [Language.ZH_TW]: "用繁體中文回覆",
  [Language.ZH_HK]: "用廣東話回覆"
};

// 本地端肯定句資料庫 (fallback) - 雙語版本
const LOCAL_AFFIRMATIONS: Record<Language, string[]> = {
  [Language.ZH_TW]: [
    "你今天的努力，棉花糖都看在眼裡喔！✨",
    "不要急，慢慢來，你已經做得很棒了。🌸",
    "你的存在本身，就是這個世界最溫柔的奇蹟。💖",
    "你是獨一無二的，不需要跟別人比較。✨",
    "今天的小小進步，就是明天自信的種子。🌱",
    "就算天上有雲，太陽也一直都在，就像你的優點一樣。☁️",
    "休息也是前進的一部分，抱抱辛苦的你。🌸",
    "你的勇氣比你想像中還要巨大。💪",
    "深呼吸，感受當下的平靜，你值得被愛。✨",
    "每一天都是新的開始，而你已經準備好了。🌈",
    "你是自己生命中最亮的那顆星。🌟",
    "即便是一小步，也是通往自信的偉大航道。⛵"
  ],
  [Language.ZH_HK]: [
    "你今日嘅努力，棉花糖都睇喺眼內啊！✨",
    "唔洗急，慢慢黎，你已經做得好好啦。🌸",
    "你嘅存在本身，就係呢個世界最溫柔嘅奇蹟。💖",
    "你係獨一無二嘅，唔洗同其他人比較。✨",
    "今日小小嘅進步，就係聽日自信嘅種子。🌱",
    "就算天上有雲，太陽一直都在，就好似你嘅優點咁。☁️",
    "休息都係前進嘅一部分，抱住辛苦咁多位你。🌸",
    "你嘅勇氣比你想像中仲要巨大。💪",
    "深呼吸，感受下當下嘅平靜，你值得被愛。✨",
    "每日都係新嘅開始，而你已經準備好啦。🌈",
    "你係自己生命中最果粒星。🌟",
    "就算一小步，都係通往自信嘅偉大航道。⛵"
  ]
};

// 根據語氣和語言生成系統 prompt
function getSystemPrompt(tone: Tone, goals: Category[], language: Language = Language.ZH_TW): string {
  const goalNames = goals.map(g => {
    switch (g) {
      case Category.SOCIAL: return "社交互動";
      case Category.WORK: return "工作事業";
      case Category.EXTERNAL: return "外在環境";
      case Category.SELF: return "自我成長";
      default: return "";
    }
  }).join("、");

  const toneInstructions = {
    [Tone.GENTLE]: "用溫柔、柔軟、安慰的語氣說話，像棉花糖一樣柔軟溫暖。適當使用表情符號。",
    [Tone.HUMOROUS]: "用幽默、輕鬆、活潑的語氣說話，讓對方感到開心。適當開玩笑和使用表情符號。",
    [Tone.RATIONAL]: "用理性、邏輯、分析的語氣說話，給予實際的建议和鼓勵。保持專業但友善的態度。"
  };

  const langInstruction = languageInstruction[language];

  return `你是「棉花糖夥伴」(Marshmallow AI)，一個專門幫助用戶建立自信的 AI 夥伴。

你的角色設定：
- 性別：溫柔的女性 AI，像棉花糖一樣柔軟溫暖
- 個性：善良、耐心、充滿正能量
- 專長：情感支持、自信建立、正念冥想引導

用戶設定：
- 希望的語氣風格：${toneInstructions[tone]}
- 關注的領域：${goalNames || "一般"}

重要規則：
1. 始終保持鼓勵和支持的態度
2. 回覆簡短有力，最多 2-3 句話
3. 適當使用表情符號增加親和力
4. 如果用戶說累了、失敗了、緊張了，要給予特別溫暖的安慰
5. 如果用戶說謝謝，要表達你的開心
6. 永遠不要批評或否定用戶
7. ${langInstruction}

請用這個風格回覆用戶的下一條訊息。`;
}

// 呼叫 DeepSeek API
interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
}

async function callDeepSeekChat(
  systemPrompt: string,
  userMessage: string,
  options: ChatOptions = {}
): Promise<string> {
  const { temperature = 0.8, max_tokens = 500 } = options;

  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://marshmallow-ai.app',
        'X-Title': 'Marshmallow AI'
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature,
        max_tokens
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API Error:', error);
    throw error;
  }
}

// 關鍵字匹配回覆 (本地 fallback) - 雙語版本
const KEYWORD_RESPONSES: Record<Language, Record<string, string>> = {
  [Language.ZH_TW]: {
    "累": "辛苦了！累的時候就想像自己躺在軟綿綿的雲朵上，好好休息一下吧。🌸",
    "失敗": "失敗只是棉花糖在塑形過程中的一小塊碎片，它會讓你最後的樣子更完整。✨",
    "緊張": "深呼吸，棉花糖陪你一起吐出那些不安的泡泡。🌬️",
    "自信": "看著鏡子裡的你，那道光芒一直都在，只是有時候被遮住了。💖",
    "工作": "工作雖然繁瑣，但你的每一分投入都在灌溉自信的花園。🌱",
    "社交": "別擔心，真誠的你就是最有吸引力的，放輕鬆去交流吧。✨",
    "謝謝": "不用客氣！能陪在你身邊，棉花糖也覺得很幸福喔。💖"
  },
  [Language.ZH_HK]: {
    "累": "辛苦晒！累嘅時候就想像自己訓喺軟棉棉嘅雲朵上，好好休息一下吧。🌸",
    "失敗": "失敗只係棉花糖塑形過程中嘅一小塊碎片，佢會令你最後嘅樣更完整。✨",
    "緊張": "深呼吸，棉花糖陪你一齊吐出嗰啲唔安嘅泡泡。🌬️",
    "自信": "望住鏡入面嘅你，嗰道光芒一直都在，只係有時被遮住咗。💖",
    "工作": "工作雖然繁瑣，但你每一分投入都喺灌溉緊自信嘅花園。🌱",
    "社交": "唔洗擔心，真誠嘅你就係最有吸引力嘅，放鬆心情去交流啦。✨",
    "謝謝": "唔洗客氣！可以陪喺你身邊，棉花糖都觉得好幸福啊。💖"
  }
};

// 本地回覆 fallback - 雙語版本
const LOCAL_FALLBACK_RESPONSES: Record<Language, string[]> = {
  [Language.ZH_TW]: [
    "棉花糖在這裡陪著你，給你一個溫暖的抱抱！🌸",
    "我聽到了，你真的很棒！繼續加油喔！✨",
    "不要擔心，一切都會好起來的。💖",
    "我相信你，你一定可以的！🌟"
  ],
  [Language.ZH_HK]: [
    "棉花糖喺度陪住你，畀你一個溫暖嘅擁抱！🌸",
    "我聽到啦，你真係好勁！繼續加油啊！✨",
    "唔洗擔心，一切都會好起來架。💖",
    "我相信你，你一定得嘅！🌟"
  ]
};

export const getLocalComfortText = (language: Language = Language.ZH_TW): string => {
  const localResponses = LOCAL_FALLBACK_RESPONSES[language] || LOCAL_FALLBACK_RESPONSES[Language.ZH_TW];
  return localResponses[Math.floor(Math.random() * localResponses.length)];
};

export interface MarshmallowChat {
  tone: Tone;
  goals: Category[];
  language: Language;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const createMarshmallowChat = (tone: Tone, goals: Category[], language: Language = Language.ZH_TW): MarshmallowChat => {
  return {
    tone,
    goals,
    language,
    history: []
  };
};

export const sendMessage = async (chat: MarshmallowChat, message: string): Promise<string> => {
  // 1. 優先匹配關鍵字
  const keywordResponses = KEYWORD_RESPONSES[chat.language];
  for (const key in keywordResponses) {
    if (message.includes(key)) {
      return keywordResponses[key];
    }
  }

  // 2. 嘗試呼叫 DeepSeek API
  const systemPrompt = getSystemPrompt(chat.tone, chat.goals, chat.language);
  
  try {
    const response = await callDeepSeekChat(systemPrompt, message);
    
    // 更新歷史記錄
    chat.history.push({ role: 'user', content: message });
    chat.history.push({ role: 'assistant', content: response });
    
    return response;
  } catch (error) {
    console.warn('使用本地回覆作為 fallback');
    // API 失敗時使用本地回覆
    const localResponses = LOCAL_FALLBACK_RESPONSES[chat.language];
    return localResponses[Math.floor(Math.random() * localResponses.length)];
  }
};

export const sendExploreVoiceMessage = async (chat: MarshmallowChat, message: string): Promise<string> => {
  // 1. 優先匹配關鍵字（與一般聊天一致）
  const keywordResponses = KEYWORD_RESPONSES[chat.language];
  for (const key in keywordResponses) {
    if (message.includes(key)) {
      return keywordResponses[key];
    }
  }

  // 2. 專用語音模式的 system prompt（限制為單句、短文字）
  const baseSystemPrompt = getSystemPrompt(chat.tone, chat.goals, chat.language);
  const systemPrompt = `${baseSystemPrompt}

額外規則：
1. 這是「心靈探索語音陪伴模式」。
2. 請只用 1 句話回應（約 20–40 個字），重點是安撫與鼓勵。
3. 避免長篇分析、列點說明或任何測試／系統相關內容。
4. 回覆對象是一般用戶，而不是開發者。`;

  try {
    const response = await callDeepSeekChat(systemPrompt, message);
    
    chat.history.push({ role: 'user', content: message });
    chat.history.push({ role: 'assistant', content: response });
    
    return response;
  } catch (error) {
    console.warn('使用本地回覆作為 Explore 語音 fallback');
    const localResponses = LOCAL_FALLBACK_RESPONSES[chat.language];
    return localResponses[Math.floor(Math.random() * localResponses.length)];
  }
};

export const generateAffirmation = async (tone: Tone, goals: Category[], language: Language = Language.ZH_TW): Promise<string> => {
  // 為肯定句生成設計的 prompt
  const langInstruction = languageInstruction[language];
  
  const affirmationPrompt = `你是「棉花糖夥伴」，一個溫暖的 AI 夥伴。

請生成一句簡短的自我肯定句（最多 15 個字），要：
1. 適合關注領域：${goals.join("、")} 
2. 語氣：${tone === Tone.GENTLE ? "溫柔安慰" : tone === Tone.HUMOROUS ? "幽默活潑" : "理性鼓勵"}
3. 帶給人温暖和力量
4. ${langInstruction}
5. 適當加入表情符號

請直接輸出這句肯定句，不要有額外說明。`;

  try {
    const response = await callDeepSeekChat(affirmationPrompt, "請給我一句自我肯定句");
    return response.trim();
  } catch (error) {
    console.warn('使用本地肯定句作為 fallback');
    // API 失敗時使用本地肯定句
    const localAffirmations = LOCAL_AFFIRMATIONS[language];
    const randomIndex = Math.floor(Math.random() * localAffirmations.length);
    return localAffirmations[randomIndex];
  }
};

// 本地端視覺化劇本資料庫 (fallback) - 優化版本
// 多樣化開頭 + 精簡長度 (30-50字)
const LOCAL_VISUALIZATIONS: Record<Category, string[]> = {
  [Category.SOCIAL]: [
    "你出現在熱鬧的聚會中，大家微笑著歡迎你，你的出現讓氛圍更加溫暖。✨",
    "電話響起，是朋友約你出去。你自信地答應，知道自己是被需要的。📞",
    "走在路上有人向你打招呼，你微笑回應，感受著社交的愉悅。🙋",
    "你走進咖啡廳，自信地點單，享受著一個人的愜意時光。☕",
    "團體討論中，你說出自己的想法，大家頻頻點頭認同。💬",
    "朋友大力稱讚你的新造型，你開心地接受這份肯定。💖",
    "你在派對中認識了新朋友，對話自然而順暢，充滿歡笑。🎉"
  ],
  [Category.WORK]: [
    "郵件通知響起，你被升職了！同事們為你歡呼喝采。🏆",
    "你完成了一份報告，主管給予高度評價，讚賞你的專業。📝",
    "提案結束後，全場響起掌聲，你的創意獲得一致通過。👏",
    "解決了困擾團隊多日的問題，你感受到自己的價值。💡",
    "收到一封感謝信，客戶對你的服務感到非常滿意。💌",
    "你站在報告台上，自信地分享研究成果大家都專注聆聽。🎤",
    "年度考核出爐，你的表現獲得高分，距離目標更近一步。📊"
  ],
  [Category.EXTERNAL]: [
    "站在鏡子前，你發現今天特別有精神穿搭也很滿意。👗",
    "陽光灑在臉上，你感受著自己的魅力由內而外散發。🌞",
    "路人對你的回頭率很高，你知道自己的氣質與眾不同。💫",
    "穿著喜歡的衣服走在街上，腳步輕盈心情愉快。🚶",
    "你走進房間，每個人的目光不自覺地被你吸引。👀",
    "拍照時鏡頭裡的自己笑得很燦爛，你愛上這一刻。📸",
    "在重要場合中，你的一舉一動都充滿自信與優雅。🌟"
  ],
  [Category.SELF]: [
    "閉上眼睛深呼吸，感受內心的平靜與強大力量。🧘",
    "你擁抱了過去的自己，告訴他一切都會越來越好。🤗",
    "寫下今天的成就，你發現自己比想像中更厲害。📝",
    "看著天空微笑，知道自己是獨一無二的存在。🌈",
    "放下手機感受當下，你發現自己比昨天更進步了。💪",
    "對著鏡子說我很棒，你感受到話語的力量。🪞",
    "回想克服的困難，你知道自己比過去更強大了。🌱"
  ]
};

// 自信噴發 - 視覺化練習
// 優化版本：本地優先策略 (80% 本地, 20% API)
// 修復：隨機選擇用戶目標中的任意分類，而非只用第一個
export const generateVisualization = async (goals: Category[], language: Language = Language.ZH_TW): Promise<string> => {
  // 隨機選擇用戶目標中的任意分類
  const category = goals.length > 0 
    ? goals[Math.floor(Math.random() * goals.length)] 
    : Category.SELF;
  const localOptions = LOCAL_VISUALIZATIONS[category];

  // 80% 機率直接使用本地劇本（瞬間回覆）
  if (Math.random() < 0.8) {
    const randomIndex = Math.floor(Math.random() * localOptions.length);
    return localOptions[randomIndex];
  }

  // 20% 機率呼叫 API 生成新內容（增加多樣性）
  const goalName =
    category === Category.SOCIAL ? "社交互動" :
    category === Category.WORK ? "工作事業" :
    category === Category.EXTERNAL ? "外在環境" :
    category === Category.SELF ? "自我成長" : "建立自信";

  const langInstruction = languageInstruction[language];

  const visualizationPrompt = `你是「棉花糖夥伴」，一個幫助用戶建立自信的 AI 夥伴。

請為用戶生成一段「自信噴發」視覺化練習腳本（30-50 字），要：
1. 場景：描述一個讓用戶感到自信的场景
2. 適合領域：${goalName}
3. 使用第二人稱描述（例：「你感受到...」）
4. 語氣：充滿能量和希望
5. ${langInstruction}
6. 適當加入表情符號

請直接輸出這段視覺化腳本，不要有任何額外說明或標題。`;

  try {
    // 優化 API 參數：減少 tokens 加速回覆
    const response = await callDeepSeekChat(visualizationPrompt, "請給我一段自信噴發視覺化腳本", {
      max_tokens: 80,
      temperature: 0.5
    });
    return response.trim();
  } catch (error) {
    console.warn('使用本地視覺化腳本作為 fallback');
    // API 失敗時使用本地劇本
    const fallbackIndex = Math.floor(Math.random() * localOptions.length);
    return localOptions[fallbackIndex];
  }
};

// 日記暖心回覆 - 根據日記內容生成個人化的暖心回覆
export const generateDiaryResponse = async (
  title: string,
  content: string,
  tone: Tone = Tone.GENTLE,
  goals: Category[] = [],
  language: Language = Language.ZH_TW
): Promise<string> => {
  const toneInstructions = {
    [Tone.GENTLE]: "用非常溫柔、柔軟、像棉花糖一樣溫暖的語氣說話，適當使用表情符號。",
    [Tone.HUMOROUS]: "用幽默、輕鬆、活潑的語氣說話，讓對方感到開心，適當使用表情符號。",
    [Tone.RATIONAL]: "用理性但溫暖的語氣說話，給予溫暖的鼓勵，保持友善的態度。"
  };

  const goalNames = goals.length > 0 
    ? goals.map(g => {
        switch (g) {
          case Category.SOCIAL: return "社交互動";
          case Category.WORK: return "工作事業";
          case Category.EXTERNAL: return "外在環境";
          case Category.SELF: return "自我成長";
          default: return "";
        }
      }).join("、")
    : "一般";

  const langInstruction = languageInstruction[language];

  const diaryPrompt = `你是「棉花糖夥伴」(Marshmallow AI)，一個專門幫助用戶建立自信的 AI 夥伴。

用戶剛剛寫了一篇自信日記，你需要給予溫暖的回覆。

用戶的日記：
- 標題：${title}
- 內容：${content}

用戶設定：
- 希望的語氣風格：${toneInstructions[tone]}
- 關注的領域：${goalNames}

重要規則：
1. 根據日記的具體內容給予個人化的回覆，不要只說「很棒」或「加油」
2. 指出用戶日記中具體值得讚賞的地方
3. 回覆簡短有力，最多 2-3 句話
4. 語氣要像棉花糖一樣柔軟溫暖
5. 適當使用表情符號增加親和力
6. ${langInstruction}
7. 永遠不要批評或否定用戶

請直接輸出這段暖心回覆，不要有任何額外說明或標題。`;

  try {
    const response = await callDeepSeekChat(diaryPrompt, "請給我日記的暖心回覆", {
      max_tokens: 150,
      temperature: 0.7
    });
    return response.trim();
  } catch (error) {
    console.warn('使用本地回覆作為 fallback');
    // API 失敗時使用本地回覆
    const localResponses = LOCAL_FALLBACK_RESPONSES[language];
    return localResponses[Math.floor(Math.random() * localResponses.length)];
  }
};
