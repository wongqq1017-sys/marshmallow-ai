import { Language } from '../types';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

interface CantoneseConfig {
  apiKey?: string;
  voiceId?: string;
  baseUrl?: string;
}

const getConfig = (): CantoneseConfig => {
  return {
    apiKey: import.meta.env?.VITE_CANTONESE_API_KEY,
    voiceId: import.meta.env?.VITE_CANTONESE_VOICE_ID || '2725cf0f-efe2-4132-9e06-62ad84b2973d',
    baseUrl: 'https://cantonese.ai/api/tts'
  };
};

export const createCantoneseTtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    if (!text.trim()) return;

    hooks?.onStart?.();

    const config = getConfig();
    
    if (!config.apiKey) {
      console.warn('Cantonese.ai: No API key configured. Set VITE_CANTONESE_API_KEY');
      throw new Error('No Cantonese API key');
    }

    try {
      const response = await fetch(config.baseUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: config.apiKey,
          text: text,
          language: 'cantonese',
          voice_id: config.voiceId,
          output_extension: 'mp3',
          frame_rate: '24000',
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cantonese API error: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      
      const audioContext = new AudioContext();
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
      console.error('Cantonese.ai TTS Error:', error);
      hooks?.onEnd?.();
      throw error;
    }
  };
};
