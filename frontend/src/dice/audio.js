// Fully synthesized dice soundscape (no samples needed).
const MUTE_KEY = 'dice:muted';

const rand = (a, b) => a + Math.random() * (b - a);

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export class DiceAudio {
  constructor() {
    this.ctx = null;
    this.muted = loadMuted();
    this.rolling = null;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(ctx.destination);

      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(1.8, 2.6);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.35;
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(this.master);

      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
      }
    }
    return buf;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // storage unavailable; mute still applies for this session
    }
    if (this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.9,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  out(pan = 0, wet = 0.2) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    p.connect(this.master);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      p.connect(send);
      send.connect(this.reverbSend);
    }
    return g;
  }

  noiseBurst(dest, t, dur, type, freq, q, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  tone(dest, t, freq, dur, gain, type = 'sine', endFreq) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Die striking the table (or a wall). strength is roughly 0..1. */
  impact(strength, { wall = false, pan = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const s = Math.min(1, Math.max(0.03, strength));
    const t = ctx.currentTime + 0.001;
    const out = this.out(pan, 0.18);
    const pitch = rand(0.88, 1.14);
    if (wall) {
      this.noiseBurst(out, t, 0.09, 'bandpass', 700 * pitch, 2.5, 0.9 * s);
      this.tone(out, t, 190 * pitch, 0.12, 0.5 * s, 'triangle', 120);
      this.noiseBurst(out, t, 0.02, 'highpass', 3000, 0.7, 0.35 * s);
      return;
    }
    // Sharp plastic clack.
    this.noiseBurst(out, t, 0.018, 'bandpass', 3800 * pitch, 1.4, 1.1 * s);
    this.tone(out, t, 1650 * pitch, 0.035, 0.22 * s, 'sine', 1300 * pitch);
    this.tone(out, t, 2900 * pitch, 0.02, 0.1 * s, 'sine');
    // Wooden table body.
    this.tone(out, t, 150 * pitch, 0.09, 0.55 * s * s, 'sine', 90);
    this.noiseBurst(out, t, 0.06, 'lowpass', 600, 0.8, 0.5 * s * s);
  }

  /** Dice cup rattle before the throw. */
  rattle(duration = 0.38) {
    const ctx = this.ensure();
    if (!ctx) return;
    const out = this.out(0, 0.25);
    const t0 = ctx.currentTime;
    this.noiseBurst(out, t0, duration, 'bandpass', 2400, 0.6, 0.06);
    let t = t0;
    while (t < t0 + duration) {
      const s = rand(0.25, 0.7);
      this.noiseBurst(out, t, 0.014, 'bandpass', rand(3500, 5500), 2, s);
      this.tone(out, t, rand(1800, 2600), 0.025, 0.08 * s, 'sine');
      t += rand(0.028, 0.065);
    }
  }

  /** Die knocking around in a cupped hand while being shaken. */
  shake(strength) {
    const ctx = this.ensure();
    if (!ctx) return;
    const out = this.out(0, 0.25);
    let t = ctx.currentTime + 0.001;
    const hits = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < hits; i++) {
      const s = strength * rand(0.35, 1);
      this.noiseBurst(out, t, 0.016, 'bandpass', rand(2600, 4800), 1.6, s);
      this.tone(out, t, rand(1500, 2400), 0.03, 0.1 * s, 'sine');
      this.tone(out, t, rand(220, 320), 0.05, 0.12 * s, 'sine', 160);
      t += rand(0.018, 0.05);
    }
  }

  whoosh() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const out = this.out(0, 0.3);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(350, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random());
    src.stop(t + 0.55);
  }

  /** Continuous felt rumble while the die tumbles across the table. */
  startRolling() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopRolling();
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.out(0, 0.05));
    src.start();
    this.rolling = { src, f, g };
  }

  updateRolling(speed, onFloor) {
    if (!this.rolling) return;
    const t = this.ctx.currentTime;
    const level = onFloor ? Math.min(1, speed / 12) : 0;
    this.rolling.g.gain.setTargetAtTime(level * 0.35, t, 0.04);
    this.rolling.f.frequency.setTargetAtTime(250 + level * 900, t, 0.05);
  }

  stopRolling() {
    if (!this.rolling) return;
    const { src, g } = this.rolling;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    src.stop(this.ctx.currentTime + 0.3);
    this.rolling = null;
  }

  /** Geiger counter clicks and a rising reactor hum before detonation. */
  nukeCharge(duration) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const out = this.out(0, 0.15);

    let t = t0;
    while (t < t0 + duration) {
      const progress = (t - t0) / duration;
      this.noiseBurst(out, t, 0.004, 'highpass', 2500, 0.7, rand(0.5, 0.9));
      t += rand(0.01, 0.16) * (1 - progress * 0.92);
    }

    const hum = this.out(0, 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(150, t0);
    lp.frequency.exponentialRampToValueAtTime(3000, t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0 + duration + 0.01);
    lp.connect(g);
    g.connect(hum);
    for (const detune of [0, 7, -5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(45, t0);
      o.frequency.exponentialRampToValueAtTime(320, t0 + duration);
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + duration + 0.05);
    }
  }

  /**
   * The flash arrives first: ears ring in near silence, then the blast
   * wave hits (the sample plus a synthesized sub-bass rumble).
   */
  nukeDetonate(blastDelay, sampleUrl) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const ring = this.out(0, 0.4);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    rg.connect(ring);
    const o = ctx.createOscillator();
    o.frequency.value = 3700;
    o.connect(rg);
    o.start(t);
    o.stop(t + 5.1);

    const tb = t + blastDelay;
    const out = this.out(0, 0.5);
    this.tone(out, tb, 55, 3.5, 0.9, 'sine', 22);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, tb);
    lp.frequency.exponentialRampToValueAtTime(90, tb + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tb);
    g.gain.exponentialRampToValueAtTime(0.9, tb + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, tb + 7);
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    src.start(tb);
    src.stop(tb + 7.1);

    if (!this.muted && sampleUrl) {
      const sample = new Audio(sampleUrl);
      sample.volume = 0.9;
      this.sampleTimer = setTimeout(() => {
        sample.play().catch(() => {});
      }, blastDelay * 1000);
      this.sample = sample;
    }
  }

  stopSample() {
    clearTimeout(this.sampleTimer);
    this.sample?.pause();
  }

  bell(dest, t, freq, gain, dur = 1.6) {
    const partials = [
      [1, 1],
      [2.76, 0.45],
      [5.4, 0.22],
      [8.93, 0.1],
    ];
    for (const [ratio, amp] of partials) {
      this.tone(dest, t, freq * ratio, dur / ratio ** 0.4, gain * amp);
    }
  }

  /** Result reveal: a chime, a fanfare for a max roll, a womp for a 1. */
  reveal(fraction, { max = false, min = false } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    const out = this.out(0, 0.55);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const step = scale[Math.round(fraction * (scale.length - 1))];
    const base = 392 * 2 ** (step / 12);

    if (max) {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, i) => {
        const at = t + i * 0.075;
        this.tone(out, at, n, 0.9, 0.16, 'triangle');
        this.tone(out, at, n * 2.005, 0.6, 0.05, 'sine');
      });
      this.bell(out, t + 0.4, 1046.5, 0.18, 2.4);
      this.tone(out, t, 70, 0.9, 0.6, 'sine', 40);
      for (let i = 0; i < 14; i++) {
        this.tone(out, t + 0.35 + i * 0.06, rand(2500, 5200), 0.25, 0.05);
      }
      return;
    }
    if (min) {
      this.tone(out, t, 233, 0.45, 0.22, 'sawtooth', 220);
      this.tone(out, t + 0.42, 208, 0.9, 0.22, 'sawtooth', 165);
      this.tone(out, t, 116, 1.3, 0.2, 'triangle', 80);
      return;
    }
    this.bell(out, t, base, 0.2);
    this.bell(out, t + 0.09, base * 1.5, 0.08, 1.2);
  }
}
