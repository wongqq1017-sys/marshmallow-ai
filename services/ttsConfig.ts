export type TtsProviderType = 'qwen' | 'gtts' | 'browser' | 'edge' | 'cantonese' | 'qwen3' | 'textread' | 'edgeproxy';

export interface TtsConfig {
  useExternal: boolean;
  ttsProvider: TtsProviderType;
  // 自定義 API URL
  apiEndpoint?: string;
}

export const TTS_CONFIG: TtsConfig = {
  useExternal: true,
  ttsProvider: 'edgeproxy',
  apiEndpoint: 'https://wongqq1017-2103.vercel.app',  // 你的 Vercel 部署
};

