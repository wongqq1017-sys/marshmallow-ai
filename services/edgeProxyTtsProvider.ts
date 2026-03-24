import { EdgeTTS } from 'edge-tts-universal';
import { Language } from '../types';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

// Edge TTS 語音映射
const voiceMap: Record<string, string> = {
  'zh-HK': 'zh-HK-HiuGaaiNeural',  // 粵語女聲
  'zh-TW': 'zh-TW-HsiaoYuNeural',   // 台灣國語女聲
  'zh-CN': 'zh-CN-XiaoxiaoNeural',  // 大陸普通話女聲
};

// 獲取語言對應的 voice key
const getVoiceKey = (language: Language): string => {
  switch (language) {
    case Language.ZH_HK:
      return 'zh-HK';
    case Language.ZH_TW:
      return 'zh-TW';
    default:
      return 'zh-CN';
  }
};

// Edge TTS 每次請求限制約 1000 字
const MAX_TEXT_LENGTH = 800;

const splitText = (text: string): string[] => {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_TEXT_LENGTH) {
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

export const createEdgeProxyTtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const voiceKey = getVoiceKey(language);
    const voice = voiceMap[voiceKey] || voiceMap['zh-HK'];
    const chunks = splitText(text);

    console.log(`[Edge TTS] Using voice: ${voice}, language: ${language}, text length: ${text.length}`);

    try {
      const audioContext = new AudioContext();

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[Edge TTS] Synthesizing chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 30)}..."`);

        // 使用 Edge TTS 合成音頻
        const tts = new EdgeTTS(chunk, voice);
        const result = await tts.synthesize();

        console.log(`[Edge TTS] Received audio blob, size: ${result.audio.size}`);

        // 將 Blob 轉換為 AudioBuffer
        const arrayBuffer = await result.audio.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        console.log(`[Edge TTS] Decoded audio buffer, duration: ${audioBuffer.duration}s`);

        // 播放音頻
        await new Promise<void>((resolve) => {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);

          if (i === chunks.length - 1) {
            source.onended = () => resolve();
          } else {
            source.onended = () => {
              setTimeout(resolve, 100);
            };
          }
          source.start();
        });

        console.log(`[Edge TTS] Played chunk ${i + 1}/${chunks.length}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      await audioContext.close();
      console.log('[Edge TTS] Done');
      hooks?.onEnd?.();
    } catch (error) {
      console.error('[Edge TTS] Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};
