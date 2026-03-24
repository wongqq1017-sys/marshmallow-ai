import { Language } from '../types';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

const getGTTLanguageCode = (language: Language): string => {
  switch (language) {
    case Language.ZH_HK:
      return 'zh-TW'; // gTTS 不支援 zh-HK，用繁體代替
    case Language.ZH_TW:
      return 'zh-TW';
    case Language.ZH:
      return 'zh-CN';
    default:
      return 'zh-TW';
  }
};

const MAX_TEXT_LENGTH = 190; // gTTS 每次請求限制

const splitText = (text: string): string[] => {
  const chunks: string[] = [];
  let remaining = text;

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
      splitIndex = MAX_TEXT_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex + 1).trim());
    remaining = remaining.slice(splitIndex + 1).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
};

export const createGTTsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const langCode = getGTTLanguageCode(language);
    const chunks = splitText(text);

    try {
      // 創建音頻上下文
      const audioContext = new AudioContext();
      let currentSource: AudioBufferSourceNode | null = null;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // 調用 gTTS API
        const encodedText = encodeURIComponent(chunk);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=tw-ob`;

        const response = await fetch(ttsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`gTTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const arrayBuffer = await audioBlob.arrayBuffer();

        // 解碼音頻
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // 播放音頻
        await new Promise<void>((resolve) => {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);

          source.onended = () => resolve();
          currentSource = source;
          source.start(i === 0 ? 0 : undefined);
        });
      }

      // 等待最後一個音頻播放完成
      await new Promise(resolve => setTimeout(resolve, 500));

      await audioContext.close();
      hooks?.onEnd?.();
    } catch (error) {
      console.error('gTTS Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};
