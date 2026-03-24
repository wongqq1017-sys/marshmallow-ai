import { Language } from '../types';
import { TTS_CONFIG } from './ttsConfig';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface SpeechRecognitionController {
  stop: () => void;
  isListening: () => boolean;
  getLastTranscript: () => string;
}

interface StartSpeechRecognitionOptions {
  language: Language;
  onResult: (text: string) => void;
  onPartialResult?: (text: string) => void;
  onSilenceDetected?: () => void;
  onError?: (error: any) => void;
  silenceTimeoutMs?: number;
}

interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
}

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

// 获取 Capacitor 插件的可用性
let pluginAvailable: boolean | null = null;

const checkPluginAvailable = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (pluginAvailable !== null) return pluginAvailable;
  
  try {
    const result = await SpeechRecognition.available();
    pluginAvailable = result.available;
    return pluginAvailable;
  } catch {
    pluginAvailable = false;
    return false;
  }
};

// Web Speech API 的备用检测
const getWebSpeechRecognition = (): any | null => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const isSpeechSupported = async (): Promise<boolean> => {
  const capacitorSupported = await checkPluginAvailable();
  if (capacitorSupported) return true;
  return getWebSpeechRecognition() !== null;
};

export const isTtsSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof window.speechSynthesis !== 'undefined';
};

export const cancelSpeech = (): void => {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (synth.speaking) {
    synth.cancel();
  }
};

const browserTtsProvider: TtsProvider = async (text, language, hooks) => {
  if (!isTtsSupported() || !text.trim()) return;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);

  const preferredLang =
    language === Language.ZH_HK ? 'zh-HK' : language === Language.ZH_TW ? 'zh-TW' : 'zh';

  const voices = synth.getVoices();
  if (voices && voices.length > 0) {
    const exact = voices.find(v => v.lang === preferredLang);
    const sameRegion = voices.find(v => v.lang.startsWith(preferredLang.split('-')[0]));
    const fallback = voices[0];
    const femaleVoice = voices.find(v => 
      (v.name.includes('Female') || v.name.includes('女') || v.name.includes('Ting') || v.name.includes('Mei')) &&
      (v.lang.startsWith(preferredLang.split('-')[0]) || v.lang.startsWith('zh'))
    );
    utterance.voice = femaleVoice || exact || sameRegion || fallback;
  }

  utterance.lang = preferredLang;
  utterance.rate = 0.9;
  utterance.pitch = 1.1;

  if (hooks?.onStart) {
    utterance.onstart = () => {
      hooks.onStart?.();
    };
  }

  await new Promise<void>(resolve => {
    utterance.onend = () => {
      hooks?.onEnd?.();
      resolve();
    };
    utterance.onerror = () => {
      hooks?.onEnd?.();
      resolve();
    };
    synth.speak(utterance);
  });
};

let externalTtsProvider: TtsProvider | null = null;

export const setExternalTtsProvider = (provider: TtsProvider | null) => {
  externalTtsProvider = provider;
};

const getCapacitorLanguageCode = (language: Language): string => {
  switch (language) {
    case Language.ZH_HK:
      return 'zh-HK';
    case Language.ZH_TW:
    default:
      return 'zh-TW';
  }
};

export const startSpeechRecognition = async (
  options: StartSpeechRecognitionOptions
): Promise<SpeechRecognitionController> => {
  const silenceTimeoutMs = options.silenceTimeoutMs || 2000;
  let lastTranscript = '';
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let isCurrentlyListening = false;
  let partialResultsHandle: any = null;
  let listeningStateHandle: any = null;

  const resetSilenceTimer = (text: string) => {
    lastTranscript = text;
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (isCurrentlyListening && lastTranscript.trim()) {
        console.log('Silence detected, triggering response');
        options.onSilenceDetected?.();
      }
    }, silenceTimeoutMs);
  };

  const capacitorSupported = await checkPluginAvailable();
  
  if (capacitorSupported) {
    const languageCode = getCapacitorLanguageCode(options.language);
    
    partialResultsHandle = await SpeechRecognition.addListener('partialResults', (data) => {
      if (data.matches && data.matches.length > 0) {
        const text = data.matches[0];
        isCurrentlyListening = true;
        resetSilenceTimer(text);
        options.onPartialResult?.(text);
      }
    });

    listeningStateHandle = await SpeechRecognition.addListener('listeningState', (data) => {
      console.log('Listening state:', data.status);
      if (data.status === 'started') {
        isCurrentlyListening = true;
      } else if (data.status === 'stopped') {
        isCurrentlyListening = false;
      }
    });

    try {
      const permissionResult = await SpeechRecognition.requestPermissions();
      if (permissionResult.speechRecognition !== 'granted') {
        if (options.onError) options.onError('not-allowed');
        partialResultsHandle?.remove();
        listeningStateHandle?.remove();
        return { 
          stop: () => {}, 
          isListening: () => false,
          getLastTranscript: () => lastTranscript
        };
      }
    } catch (err) {
      if (options.onError) options.onError(err);
      partialResultsHandle?.remove();
      listeningStateHandle?.remove();
      return { 
        stop: () => {}, 
        isListening: () => false,
        getLastTranscript: () => lastTranscript
      };
    }

    try {
      await SpeechRecognition.start({
        language: languageCode,
        maxResults: 1,
        partialResults: true,
      });
      isCurrentlyListening = true;
      resetSilenceTimer('');
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      if (options.onError) options.onError(err);
      partialResultsHandle?.remove();
      listeningStateHandle?.remove();
      return { 
        stop: () => {}, 
        isListening: () => false,
        getLastTranscript: () => lastTranscript
      };
    }

    return {
      stop: async () => {
        isCurrentlyListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        try {
          await partialResultsHandle?.remove();
          await listeningStateHandle?.remove();
          await SpeechRecognition.stop();
        } catch {}
      },
      isListening: () => isCurrentlyListening,
      getLastTranscript: () => lastTranscript
    };
  }

  const Recognition = getWebSpeechRecognition();
  if (!Recognition) {
    throw new Error('Speech recognition is not supported.');
  }

  const recognition = new Recognition();
  recognition.lang = options.language;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const results = Array.from(event.results || []);
    const transcripts = results.map((r: any) => r[0]?.transcript || '').join(' ').trim();
    
    if (transcripts) {
      isCurrentlyListening = true;
      resetSilenceTimer(transcripts);
      
      const isFinal = event.results[0]?.isFinal;
      if (isFinal) {
        options.onResult(transcripts);
      } else {
        options.onPartialResult?.(transcripts);
      }
    }
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
    if (options.onError) options.onError(event?.error || event);
  };

  recognition.onend = () => {
    if (isCurrentlyListening) {
      try { recognition.start(); } catch {}
    }
  };

  recognition.start();
  isCurrentlyListening = true;
  resetSilenceTimer('');

  return {
    stop: () => {
      isCurrentlyListening = false;
      if (silenceTimer) clearTimeout(silenceTimer);
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {}
    },
    isListening: () => isCurrentlyListening,
    getLastTranscript: () => lastTranscript
  };
};

export const speakText = (
  text: string,
  language: Language,
  options: SpeakOptions = {}
): Promise<void> => {
  const hooks = { onStart: options.onStart, onEnd: options.onEnd };

  const providerChain: TtsProvider[] = [];
  if (TTS_CONFIG.useExternal && externalTtsProvider) {
    providerChain.push(externalTtsProvider);
  }
  providerChain.push(browserTtsProvider);

  const runProvider = async (index: number): Promise<void> => {
    if (index >= providerChain.length) return;
    try {
      await providerChain[index](text, language, hooks);
    } catch {
      await runProvider(index + 1);
    }
  };

  return runProvider(0);
};

