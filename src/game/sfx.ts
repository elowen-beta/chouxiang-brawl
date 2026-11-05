let ctx: AudioContext | null = null;
let muted = false;

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function unlockAudio(): void {
  const audio = context();
  if (audio?.state === 'suspended') void audio.resume();
}

function context(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gainValue: number,
  slideTo?: number,
): void {
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(48, slideTo), now + duration);
  }
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export const sfx = {
  jump: () => tone(540, 0.07, 'square', 0.035, 760),
  hit: (knockback: number) => tone(160 + Math.min(knockback, 180), 0.09, 'sawtooth', 0.045, 70),
  ko: () => {
    tone(420, 0.18, 'square', 0.05, 120);
    tone(180, 0.32, 'sawtooth', 0.04, 48);
  },
  select: () => tone(680, 0.045, 'square', 0.03, 920),
  start: () => tone(320, 0.12, 'triangle', 0.05, 680),
  land: () => tone(140, 0.04, 'square', 0.02, 80),
  pause: () => tone(220, 0.05, 'square', 0.03),
};
