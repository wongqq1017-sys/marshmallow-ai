/**
 * Edge TTS Proxy API
 * 使用微軟 Edge TTS API，完全免費、支援粵語
 * 
 * 部署到 Vercel: https://vercel.com
 * 免費額度: 100,000 請求/天
 */

import { NextRequest, NextResponse } from 'next/server';

// Edge TTS 語音映射
const VOICE_MAP: Record<string, string> = {
  'zh-HK': 'zh-HK-HiuGaaiNeural',       // 粵語女聲
  'zh-HK-Male': 'zh-HK-WanLungNeural',   // 粵語男聲
  'zh-TW': 'zh-TW-HsiaoYuNeural',        // 台灣國語
  'zh-TW-Male': 'zh-TW-YunJheNeural',    // 台灣國語男聲
  'zh-CN': 'zh-CN-XiaoxiaoNeural',       // 大陸普通話
};

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'zh-HK', speed = 0 } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const voiceId = VOICE_MAP[voice] || VOICE_MAP['zh-HK'];
    const rate = 100 + speed;

    // Edge TTS API endpoint (使用 Systran proxy)
    const baseUrl = 'https://edge.tts.systran.net/immutable/tts';
    const params = new URLSearchParams({
      encoding: 'audio-24khz-48kbitrate-mono-mp3',
      language: voiceId.startsWith('zh') ? voiceId.substring(0, 5) : voiceId.substring(0, 2),
      voice: voiceId,
      rate: rate.toString(),
    });

    const response = await fetch(`${baseUrl}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: text,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge TTS error:', errorText);
      return NextResponse.json(
        { error: 'TTS generation failed' },
        { status: 500 }
      );
    }

    // 返回音頻
    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Content-Disposition': 'inline',
      },
    });

  } catch (error) {
    console.error('TTS proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Edge TTS Proxy',
    description: '免費粵語 TTS API - 部署到 Vercel',
    voices: VOICE_MAP,
    usage: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        text: 'string (必填) - 要轉換的文字',
        voice: 'string (選填) - 語音 ID，預設 zh-HK',
        speed: 'number (選填) - 速度 -50 到 +50，預設 0'
      },
      example: {
        text: '你今日食咗飯未？',
        voice: 'zh-HK',
        speed: 0
      }
    },
    deploy: {
      platform: 'Vercel',
      freeTier: '100,000 請求/天',
      steps: [
        '1. 建立 Vercel 帳號',
        '2. 建立新專案，上傳此程式碼',
        '3. 部署完成後取得 API URL',
        '4. 在 App 中設定 VITE_TTS_API_URL'
      ]
    }
  });
}
