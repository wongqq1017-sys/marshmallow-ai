
export class AudioService {
  private static ctx: AudioContext | null = null;
  private static audioCache: Map<string, AudioBuffer> = new Map();

  private static getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  static playSoftPop() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  static playSparkle() {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    
    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.05, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    };

    playNote(880, now);
    playNote(1320, now + 0.05);
    playNote(1760, now + 0.1);
  }

  static playSuccess() {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.05, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }

  static playTick() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // 映射音頻檔案名稱
  private static readonly audioMap: Record<string, string> = {
    'inhale': 'breathing_inhale_prompt.wav',
    'hold': 'breathing_hold_prompt.wav',
    'exhale': 'breathing_exhale_prompt.wav',
    'again': 'breathing_again_prompt.wav',
    'last-round': 'breathing_final_round_prompt.wav',
    'complete': 'breathing_encouragement.wav',
  };

  static async playBreathingAudio(audioName: string): Promise<void> {
    const fileName = this.audioMap[audioName];
    if (!fileName) {
      console.warn(`Audio not found: ${audioName}`);
      return;
    }

    try {
      // 在 Capacitor iOS WebView 中，使用 <audio> 標籤比 fetch + AudioContext 更穩定
      const audio = new Audio(`audio/${fileName}`);
      audio.load();
      await audio.play();
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  }

  private static playBuffer(buffer: AudioBuffer): void {
    const ctx = this.getContext();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    source.start();
  }
}
