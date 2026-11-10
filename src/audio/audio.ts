/**
 * All sound is synthesised with WebAudio (no audio files to download):
 *  - short SFX are built in real time,
 *  - music loops are pre-rendered once with an OfflineAudioContext, their reverb tail is
 *    wrapped around to the start so the loop is seamless, and peak-normalised so every
 *    track plays at the same loudness.
 */
import { rng } from '../core/crossword';

export type Sfx =
  | 'letter' | 'correct' | 'land' | 'wrong' | 'already' | 'bonus' | 'coin'
  | 'complete' | 'click' | 'shuffle' | 'grow' | 'hint' | 'sail';
export type Track = 'day' | 'night';

const PENTA = [0, 2, 4, 7, 9];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private reverb!: ConvolverNode;
  private tracks = new Map<Track, AudioBuffer>();
  private current: { track: Track; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted: Track | null = null;
  ambience: AudioBufferSourceNode | null = null;
  musicOn = true;
  soundOn = true;
  private paused = false;

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.soundOn ? 0.55 : 0;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.42 : 0;
    this.music.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 1.6, 2.8);
    const rv = ctx.createGain();
    rv.gain.value = 0.25;
    this.reverb.connect(rv).connect(this.sfx);
    this.startAmbience();
    if (this.wanted) this.playMusic(this.wanted);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.1);
  }

  setSound(on: boolean) {
    this.soundOn = on;
    if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  /** Pause everything (pause menu, ads, tab hidden). */
  setPaused(p: boolean) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  playMusic(track: Track) {
    this.wanted = track;
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.current?.track === track) return;
    const start = (buf: AudioBuffer) => {
      if (this.wanted !== track) return;
      const old = this.current;
      if (old) {
        old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        old.src.stop(ctx.currentTime + 3);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
      src.connect(g).connect(this.music);
      src.start();
      this.current = { track, src, gain: g };
    };
    const cached = this.tracks.get(track);
    if (cached) start(cached);
    else void renderTrack(track, ctx.sampleRate).then((b) => { this.tracks.set(track, b); start(b); });
  }

  private startAmbience() {
    const ctx = this.ctx!;
    // gentle surf: brown noise, low-passed, slow swell baked into the loop
    const len = ctx.sampleRate * 8;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        const swell = 0.55 + 0.45 * Math.sin((i / len) * Math.PI * 2 * 2 + ch);
        d[i] = last * 3.2 * swell;
      }
      // crossfade ends for a click-free loop
      const fade = ctx.sampleRate * 0.5;
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] = d[i] * k + d[len - fade + i] * (1 - k);
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopEnd = buf.duration - 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(lp).connect(g).connect(this.music);
    src.start();
    this.ambience = src;
  }

  play(name: Sfx, index = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.soundOn || this.paused) return;
    const t = ctx.currentTime + 0.005;
    const out = this.sfx;
    const wet = this.reverb;
    switch (name) {
      case 'letter': {
        const n = 72 + PENTA[index % 5] + 12 * Math.floor(index / 5);
        mallet(ctx, out, wet, t, midi(n), 0.5, 0.5);
        break;
      }
      case 'correct':
        [72, 76, 79, 84].forEach((n, i) => mallet(ctx, out, wet, t + i * 0.07, midi(n), 0.9, 0.42));
        shimmer(ctx, out, t + 0.18, 0.6);
        break;
      case 'land':
        mallet(ctx, out, wet, t, midi(84 + PENTA[index % 5]), 0.25, 0.25);
        break;
      case 'wrong':
        soft(ctx, out, t, midi(55), 0.16, 0.35);
        soft(ctx, out, t + 0.12, midi(51), 0.22, 0.32);
        break;
      case 'already':
        soft(ctx, out, t, midi(67), 0.12, 0.3);
        soft(ctx, out, t + 0.09, midi(67), 0.12, 0.25);
        break;
      case 'bonus':
      case 'coin':
        bell(ctx, out, wet, t, midi(95), 0.25, 0.25);
        bell(ctx, out, wet, t + 0.08, midi(100), 0.5, 0.3);
        break;
      case 'complete':
        [60, 64, 67, 72].forEach((n) => pad(ctx, out, wet, t, midi(n), 1.6, 0.12));
        [72, 76, 79, 84, 88].forEach((n, i) => mallet(ctx, out, wet, t + 0.1 + i * 0.09, midi(n), 1.0, 0.4));
        shimmer(ctx, out, t + 0.4, 1.2);
        break;
      case 'click':
        soft(ctx, out, t, midi(84), 0.05, 0.18);
        break;
      case 'shuffle':
        whoosh(ctx, out, t, 0.35, 0.35, 600, 3000);
        break;
      case 'grow':
        pop(ctx, out, t, 0.32);
        mallet(ctx, out, wet, t + 0.05, midi(79 + PENTA[index % 5]), 0.6, 0.3);
        break;
      case 'hint':
        bell(ctx, out, wet, t, midi(88), 0.6, 0.3);
        shimmer(ctx, out, t, 0.5);
        break;
      case 'sail':
        whoosh(ctx, out, t, 2.2, 0.3, 300, 1200);
        break;
    }
  }
}

// ---------- instruments ----------

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function mallet(ctx: BaseAudioContext, out: AudioNode, wet: AudioNode | null, t: number, f: number, dur: number, vol: number) {
  const g = ctx.createGain();
  env(g, t, 0.004, vol, dur);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 4.0;
  const g2 = ctx.createGain();
  env(g2, t, 0.002, vol * 0.25, dur * 0.18);
  o1.connect(g);
  o2.connect(g2).connect(out);
  g.connect(out);
  if (wet) g.connect(wet);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}

function bell(ctx: BaseAudioContext, out: AudioNode, wet: AudioNode | null, t: number, f: number, dur: number, vol: number) {
  for (const [ratio, amp] of [[1, 1], [2.76, 0.4], [5.4, 0.18]] as const) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    env(g, t, 0.003, vol * amp, dur / ratio);
    o.connect(g).connect(out);
    if (wet) g.connect(wet);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

function soft(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, dur: number, vol: number) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const g = ctx.createGain();
  env(g, t, 0.01, vol, dur);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.1);
}

function pad(ctx: BaseAudioContext, out: AudioNode, wet: AudioNode | null, t: number, f: number, dur: number, vol: number) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  for (const det of [-7, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lp.connect(g).connect(out);
  if (wet) g.connect(wet);
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  const r = rng(7);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return b;
}

function shimmer(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 9000;
  hp.Q.value = 2;
  const g = ctx.createGain();
  env(g, t, 0.05, 0.12, dur);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
}

function whoosh(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, vol: number, f0: number, f1: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
  bp.frequency.exponentialRampToValueAtTime(f0, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
}

function pop(ctx: BaseAudioContext, out: AudioNode, t: number, vol: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(660, t + 0.12);
  const g = ctx.createGain();
  env(g, t, 0.005, vol, 0.16);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  const r = rng(11);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

// ---------- music ----------

interface Song {
  bpm: number;
  /** chords as MIDI note lists, one per bar */
  bars: number[][];
  bass: number[];
  scaleRoot: number;
  seed: number;
  shaker: boolean;
  melodyDensity: number;
}

const SONGS: Record<Track, Song> = {
  // F major, bright and bouncy: Fmaj7 Dm7 Bbmaj7 C6 | Fmaj7 Am7 Gm7 C
  day: {
    bpm: 92,
    bars: [[53, 57, 60, 64], [50, 57, 60, 65], [46, 57, 62, 65], [48, 55, 60, 64], [53, 57, 60, 64], [45, 55, 60, 64], [43, 58, 62, 65], [48, 55, 58, 64]],
    bass: [41, 38, 34, 36, 41, 33, 31, 36],
    scaleRoot: 65,
    seed: 4,
    shaker: true,
    melodyDensity: 0.62,
  },
  // A minor, slow music-box lullaby for night islands: Am7 Fmaj7 Cmaj7 G
  night: {
    bpm: 72,
    bars: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 67], [57, 60, 64, 67], [53, 57, 60, 64], [50, 57, 60, 65], [52, 56, 59, 64]],
    bass: [45, 41, 36, 43, 45, 41, 38, 40],
    scaleRoot: 69,
    seed: 9,
    shaker: false,
    melodyDensity: 0.45,
  },
};

export async function renderTrack(track: Track, sampleRate: number): Promise<AudioBuffer> {
  const song = SONGS[track];
  const sr = Math.min(sampleRate, 44100);
  const beat = 60 / song.bpm;
  const loops = 2; // the 8 bars play twice with a varied melody: 16 bars per loop
  const barCount = song.bars.length * loops;
  const loopLen = barCount * 4 * beat;
  const tail = 3;
  const ctx = new OfflineAudioContext(2, Math.ceil((loopLen + tail) * sr), sr);
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 2.4, 3);
  const vg = ctx.createGain();
  vg.gain.value = 0.35;
  verb.connect(vg).connect(bus);
  const r = rng(song.seed);
  const scale = PENTA.map((p) => song.scaleRoot + p - (track === 'night' ? 3 : 0));
  let lastIdx = 2;
  for (let b = 0; b < barCount; b++) {
    const t0 = b * 4 * beat;
    const chord = song.bars[b % song.bars.length];
    for (const n of chord) pad(ctx, bus, verb, t0, midi(n), 4 * beat + 0.2, 0.025);
    const bn = song.bass[b % song.bass.length];
    softBass(ctx, bus, t0, midi(bn), beat * 1.8, 0.16);
    softBass(ctx, bus, t0 + 2 * beat, midi(bn + (b % 2 ? 7 : 0)), beat * 1.6, 0.12);
    // melody: 8th notes on a pentatonic scale, random walk, resolves on chord tones each bar
    for (let s = 0; s < 8; s++) {
      if (s > 0 && r() > song.melodyDensity) continue;
      lastIdx = Math.max(0, Math.min(9, lastIdx + Math.round((r() - 0.5) * 3)));
      let note = scale[lastIdx % 5] + 12 * Math.floor(lastIdx / 5);
      if (s === 0) note = chord[2] + 12;
      const len = s % 2 === 0 ? beat * 0.9 : beat * 0.5;
      if (track === 'night') bell(ctx, bus, verb, t0 + (s * beat) / 2, midi(note), len * 2.5, 0.07);
      else mallet(ctx, bus, verb, t0 + (s * beat) / 2, midi(note), len * 1.8, 0.11);
    }
    if (song.shaker) for (let s = 0; s < 8; s++) shaker(ctx, bus, t0 + (s * beat) / 2, s % 2 ? 0.035 : 0.018);
  }
  const rendered = await ctx.startRendering();
  // wrap the tail to the start for a seamless loop and normalise loudness
  const len = Math.floor(loopLen * sr);
  const out = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: sr });
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const src = rendered.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < len; i++) dst[i] = src[i] + (i + len < src.length ? src[i + len] : 0);
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(dst[i]));
  }
  const gain = 0.8 / (peak || 1);
  for (let ch = 0; ch < 2; ch++) {
    const d = out.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] *= gain;
  }
  return out;
}

function softBass(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, dur: number, vol: number) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let shakerBuf: AudioBuffer | null = null;
function shaker(ctx: BaseAudioContext, out: AudioNode, t: number, vol: number) {
  if (!shakerBuf || shakerBuf.sampleRate !== ctx.sampleRate) shakerBuf = noiseBuffer(ctx, 0.1);
  const src = ctx.createBufferSource();
  src.buffer = shakerBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = ctx.createGain();
  env(g, t, 0.01, vol, 0.06);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
}

export const audio = new AudioSys();
