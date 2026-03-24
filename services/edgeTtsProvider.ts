import { EdgeTTS, Communicate, listVoices, VoicesManager } from 'edge-tts-universal';
import { Language } from '../types';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

const voiceMap: Record<string, string> = {
  'zh-HK': 'zh-HK-HiuGaaiNeural',  // 粵語女聲（活潑）
  'zh-TW': 'zh-TW-HsiaoChenNeural'  // 國語女聲
};

// Edge TTS 每次請求限制約 1000 字
const MAX_TEXT_LENGTH = 800;

const splitText = (text: string): string[] => {
  if (!text || text.length === 0) return [];
  
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_TEXT_LENGTH) {
    // 嘗試在句號、逗號或空白處分割
    let splitIndex = remaining.lastIndexOf('。', MAX_TEXT_LENGTH);
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('，', MAX_TEXT_LENGTH);
    }
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(' ', MAX_TEXT_LENGTH);
    }
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('？', MAX_TEXT_LENGTH);
    }
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('！', MAX_TEXT_LENGTH);
    }
    if (splitIndex <= 0) {
      splitIndex = MAX_TEXT_LENGTH;
    }

    const chunk = remaining.slice(0, splitIndex + 1).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitIndex + 1).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
};

export const createEdgeTtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const voice = voiceMap[language] || voiceMap['zh-HK'];
    const chunks = splitText(text);

    try {
      const audioContext = new AudioContext();

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 使用 Edge TTS 合成音頻
        const tts = new EdgeTTS(chunk, voice);
        const result = await tts.synthesize();

        // 將 Blob 轉換為 AudioBuffer
        const arrayBuffer = await result.audio.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // 播放音頻
        await new Promise<void>((resolve) => {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);

          if (i === chunks.length - 1) {
            source.onended = () => resolve();
          } else {
            // 非最後一段，稍微等待一下再開始下一段
            source.onended = () => {
              setTimeout(resolve, 100);
            };
          }
          source.start();
        });
      }

      // 等待最後一個音頻播放完成
      await new Promise(resolve => setTimeout(resolve, 300));

      await audioContext.close();
      hooks?.onEnd?.();
    } catch (error) {
      console.error('Edge TTS Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};

// 導出可用聲音列表（用於調試）
export const getAvailableVoices = async () => {
  try {
    const voices = await listVoices();
    return voices.filter(v => 
      v.Locale.includes('HK') || 
      v.Locale.includes('zh') ||
      v.Name.toLowerCase().includes('cantonese')
    );
  } catch (error) {
    console.error('Failed to fetch voices:', error);
    return [];
  }
};
