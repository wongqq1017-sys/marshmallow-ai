import { Language } from '../types';
import { TTS_CONFIG } from './ttsConfig';

type TtsProvider = (
  text: string,
  language: Language,
  hooks?: { onStart?: () => void; onEnd?: () => void }
) => Promise<void>;

const voiceMap: Record<string, string> = {
  'zh-HK': 'Cherry',
  'zh-TW': 'Cherry',
  'zh': 'Cherry'
};

const getApiKey = (): string | undefined => {
  const envKey = TTS_CONFIG.apiKeyEnv;
  if (envKey && typeof process !== 'undefined') {
    return (process.env as Record<string, string | undefined>)[envKey];
  }
  return undefined;
};

export const createQwenTtsProvider = (): TtsProvider => {
  return async (text, language, hooks) => {
    const apiKey = getApiKey();
    const apiEndpoint = TTS_CONFIG.apiEndpoint;

    if (!apiKey) {
      console.warn('Qwen TTS: No API key configured');
      throw new Error('No API key configured');
    }

    if (!apiEndpoint) {
      console.warn('Qwen TTS: No API endpoint configured');
      throw new Error('No API endpoint configured');
    }

    const voice = voiceMap[language] || 'Cherry';
    const model = TTS_CONFIG.model || 'qwen3-tts-flash-realtime';

    return new Promise<void>((resolve, reject) => {
      hooks?.onStart?.();

      let audioContext: AudioContext | null = null;
      let sourceNode: AudioBufferSourceNode | null = null;
      let isPlaying = false;
      let audioChunks: Float32Array[] = [];
      let ws: WebSocket | null = null;

      const cleanup = () => {
        if (ws) {
          ws.close();
          ws = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close();
          audioContext = null;
        }
      };

      const playAudio = () => {
        if (audioChunks.length === 0 || isPlaying) return;

        audioContext = new AudioContext();
        const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const audioBuffer = audioContext.createBuffer(1, totalLength, 24000);
        const channelData = audioBuffer.getChannelData(0);

        let offset = 0;
        for (const chunk of audioChunks) {
          channelData.set(chunk, offset);
          offset += chunk.length;
        }

        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioContext.destination);

        sourceNode.onended = () => {
          isPlaying = false;
          hooks?.onEnd?.();
          cleanup();
          resolve();
        };

        isPlaying = true;
        sourceNode.start();
      };

      const convertPcmToFloat32 = (pcmData: ArrayBuffer): Float32Array => {
        const int16Array = new Int16Array(pcmData);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }
        return float32Array;
      };

      try {
        ws = new WebSocket(apiEndpoint);

        ws.onopen = () => {
          console.log('Qwen TTS WebSocket connected');

          ws?.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'session.update',
            params: {
              model: model,
              audio: {
                voice: voice,
                response_format: 'pcm',
                sample_rate: 24000
              },
              language: 'Chinese'
            }
          }));

          ws?.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'text_session.append',
            params: {
              text: text
            }
          }));

          ws?.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'text_session.commit',
            params: {}
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const type = data.type;

            if (type === 'session.created') {
              console.log('TTS session created:', data.session?.id);
            }

            if (type === 'response.audio.delta') {
              const audioB64 = data.delta;
              if (audioB64) {
                const binaryString = atob(audioB64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const float32 = convertPcmToFloat32(bytes.buffer);
                audioChunks.push(float32);
              }
            }

            if (type === 'response.done' || type === 'session.finished') {
              console.log('TTS audio completed');
              playAudio();
            }
          } catch (err) {
            console.error('Error parsing TTS message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('Qwen TTS WebSocket error:', error);
          cleanup();
          hooks?.onEnd?.();
          reject(new Error('WebSocket error'));
        };

        ws.onclose = (event) => {
          console.log('Qwen TTS WebSocket closed:', event.code, event.reason);
          if (isPlaying) {
            // Continue - audio is still playing
          } else if (audioChunks.length > 0) {
            playAudio();
          } else {
            cleanup();
            hooks?.onEnd?.();
            resolve();
          }
        };

      } catch (err) {
        console.error('TTS error:', err);
        cleanup();
        hooks?.onEnd?.();
        reject(err);
      }
    });
  };
};
