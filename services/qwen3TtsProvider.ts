import { Language } from '../types';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

// Qwen3-TTS 設定
const QWEN_CONFIG = {
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/services/aigc/multimodal-conversation',
  model: 'qwen3-tts-flash',
  voiceMap: {
    'zh-HK': '粤语男声',      // 粵語男聲
    'zh-TW': '中文女声',       // 國語女聲
  }
};

const getApiKey = (): string | undefined => {
  return import.meta.env?.VITE_QWEN_API_KEY || import.meta.env?.QWEN_API_KEY;
};

const MAX_TEXT_LENGTH = 400; // Qwen 建議每段 <500 字符

const splitText = (text: string): string[] => {
  if (!text || text.length === 0) return [];
  
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_TEXT_LENGTH) {
    let splitIndex = remaining.lastIndexOf('。', MAX_TEXT_LENGTH);
    if (splitIndex <= 0) splitIndex = remaining.lastIndexOf('，', MAX_TEXT_LENGTH);
    if (splitIndex <= 0) splitIndex = remaining.lastIndexOf('？', MAX_TEXT_LENGTH);
    if (splitIndex <= 0) splitIndex = remaining.lastIndexOf('！', MAX_TEXT_LENGTH);
    if (splitIndex <= 0) splitIndex = remaining.lastIndexOf('；', MAX_TEXT_LENGTH);
    if (splitIndex <= 0) splitIndex = MAX_TEXT_LENGTH;

    const chunk = remaining.slice(0, splitIndex + 1).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIndex + 1).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
};

export const createQwen3TtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('Qwen3-TTS: No API key configured. Set VITE_QWEN_API_KEY or QWEN_API_KEY');
      throw new Error('No API key');
    }

    const voice = QWEN_CONFIG.voiceMap[language] || QWEN_CONFIG.voiceMap['zh-HK'];
    const chunks = splitText(text);

    try {
      const audioContext = new AudioContext();
      let audioChunks: ArrayBuffer[] = [];

      for (const chunk of chunks) {
        const response = await fetch(QWEN_CONFIG.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: QWEN_CONFIG.model,
            input: {
              text: chunk,
            },
            parameters: {
              voice: voice,
              format: 'wav',
              sample_rate: 22050,
              language: language === Language.ZH_HK ? 'yue' : 'zh',
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
        }

        const audioData = await response.arrayBuffer();
        audioChunks.push(audioData);
      }

      // 播放所有音頻片段
      for (let i = 0; i < audioChunks.length; i++) {
        const audioBuffer = await audioContext.decodeAudioData(audioChunks[i]);
        
        await new Promise<void>((resolve) => {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.onended = () => resolve();
          source.start();
        });
      }

      await audioContext.close();
      hooks?.onEnd?.();
    } catch (error) {
      console.error('Qwen3-TTS Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};
