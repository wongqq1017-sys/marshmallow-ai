import { Language } from '../types';
import { TTS_CONFIG } from '../services/ttsConfig';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

const MAX_TEXT_LENGTH = 500;

export const createEdgeProxyTtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const apiUrl = TTS_CONFIG.apiEndpoint || 'https://wongqq1017-2103.vercel.app';

    // 文本太長時分段
    let textToSpeak = text.trim();
    if (textToSpeak.length > MAX_TEXT_LENGTH) {
      textToSpeak = textToSpeak.substring(0, MAX_TEXT_LENGTH);
    }

    try {
      const response = await fetch(`${apiUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSpeak,
          voice: language === Language.ZH_HK ? 'zh-HK' : language === Language.ZH_TW ? 'zh-TW' : 'zh-CN',
          speed: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      // 直接播放音頻流
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = (e) => {
          URL.revokeObjectURL(audioUrl);
          reject(e);
        };
        audio.play();
      });

      hooks?.onEnd?.();
    } catch (error) {
      console.error('Edge TTS Proxy Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};
