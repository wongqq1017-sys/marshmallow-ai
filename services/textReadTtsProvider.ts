import { Language } from '../types';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

// TextReadTTS API 設定
const TEXT_READ_CONFIG = {
  baseUrl: 'https://api.textreadtts.com/v1/tts',
  voiceMap: {
    'zh-HK': '10',  // 朗讀者10 - 女聲 - 中文（香港）
    'zh-TW': '12',   // 朗讀者12 - 女聲 - 中文（台灣）
  }
};

const MAX_TEXT_LENGTH = 35; // 留一些空間

export const createTextReadTtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const voiceId = TEXT_READ_CONFIG.voiceMap[language] || TEXT_READ_CONFIG.voiceMap['zh-HK'];

    // 文本太長時截斷
    let textToSpeak = text.trim();
    if (textToSpeak.length > MAX_TEXT_LENGTH) {
      textToSpeak = textToSpeak.substring(0, MAX_TEXT_LENGTH);
      console.warn(`TextReadTTS: Text truncated to ${MAX_TEXT_LENGTH} characters`);
    }

    try {
      // 構建 GET 請求 URL
      const params = new URLSearchParams({
        text: textToSpeak,
        voice: voiceId,
        volume: '5',
        speed: '5',
        pitch: '5',
        aue: '6', // MP3 format
      });

      const url = `${TEXT_READ_CONFIG.baseUrl}?${params.toString()}`;
      console.log('TextReadTTS URL:', url);

      // 發送請求
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`TextReadTTS API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('TextReadTTS response:', data);

      if (data.code !== 0 || !data.audio) {
        throw new Error(data.message || 'TextReadTTS failed');
      }

      // 從回應中獲取音頻 URL
      const audioUrl = data.audio;

      // 下載並播放音頻
      const audioContext = new AudioContext();
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      await new Promise<void>((resolve) => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => resolve();
        source.start();
      });

      await audioContext.close();
      hooks?.onEnd?.();
    } catch (error) {
      console.error('TextReadTTS Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};
