/* ------------------------------------------------------------------ */
/*  Procedural audio — synthesized SFX + engine hum + music drone.     */
/*  No audio assets; everything is generated with the Web Audio API.   */
/* ------------------------------------------------------------------ */

export class SoundFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private subGain: GainNode | null = null;
  private whineOsc: OscillatorNode | null = null;
  private whineGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  /** current craft voice */
  private voice = { wave: "sawtooth" as OscillatorType, base: 48, range: 95, filter: 340, growl: 0.35, whine: 0.18, wind: 1 };

  private noiseBuf: AudioBuffer | null = null;

  sfxOn = true;
  musicOn = true;

  /** Must be called from a user gesture at least once. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 1 : 0;
    this.musicBus.connect(this.master);

    // shared white-noise buffer
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.buildEngineLoop();
    this.buildMusicDrone();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  /* ---------------- engine + wind (continuous) ---------------- */

  private buildEngineLoop() {
    const ctx = this.ctx!;
    // main turbine
    const osc = ctx.createOscillator();
    osc.type = this.voice.wave;
    osc.frequency.value = this.voice.base;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = this.voice.filter;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    osc.connect(lp).connect(g).connect(this.sfxBus!);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = g;
    this.engineFilter = lp;

    // sub-octave growl (heavy craft)
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = this.voice.base * 0.5;
    const subG = ctx.createGain();
    subG.gain.value = 0;
    sub.connect(subG).connect(this.sfxBus!);
    sub.start();
    this.subOsc = sub;
    this.subGain = subG;

    // high turbine whine (fast craft)
    const wh = ctx.createOscillator();
    wh.type = "triangle";
    wh.frequency.value = this.voice.base * 6;
    const whG = ctx.createGain();
    whG.gain.value = 0;
    wh.connect(whG).connect(this.sfxBus!);
    wh.start();
    this.whineOsc = wh;
    this.whineGain = whG;

    // wind rush
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.0;
    src.connect(bp).connect(wg).connect(this.sfxBus!);
    src.start();
    this.windFilter = bp;
    this.windGain = wg;
  }

  /** Switch the engine voice when the player changes craft. */
  setVoice(v: {
    wave: OscillatorType; base: number; range: number;
    filter: number; growl: number; whine: number; wind: number;
  }) {
    this.voice = { ...v };
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.type = v.wave;
    this.engineFilter?.frequency.setTargetAtTime(v.filter, t, 0.1);
  }

  /** u: 0..1 speed, boost: boosting flag */
  updateEngine(u: number, boost: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.windFilter || !this.windGain) return;
    const t = this.ctx.currentTime;
    const v = this.voice;
    const freq = v.base + u * v.range + (boost ? v.range * 0.32 : 0);
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.07);
    this.engineGain.gain.setTargetAtTime(0.05 + u * 0.06 + (boost ? 0.035 : 0), t, 0.1);
    this.engineFilter?.frequency.setTargetAtTime(v.filter + u * v.filter * 2.2 + (boost ? 500 : 0), t, 0.1);

    // growl follows the fundamental an octave down
    this.subOsc?.frequency.setTargetAtTime(freq * 0.5, t, 0.07);
    this.subGain?.gain.setTargetAtTime(v.growl * (0.035 + u * 0.05) + (boost ? v.growl * 0.03 : 0), t, 0.12);

    // whine rises much faster with speed
    this.whineOsc?.frequency.setTargetAtTime(freq * 5.5 + u * 900, t, 0.09);
    this.whineGain?.gain.setTargetAtTime(v.whine * (0.006 + u * 0.026) + (boost ? v.whine * 0.016 : 0), t, 0.14);

    this.windFilter.frequency.setTargetAtTime(320 + u * 2400 + (boost ? 800 : 0), t, 0.12);
    this.windGain.gain.setTargetAtTime((u * 0.16 + (boost ? 0.1 : 0)) * v.wind, t, 0.15);
  }

  engineSilent() {
    if (!this.ctx || !this.engineGain || !this.windGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.2);
    this.windGain.gain.setTargetAtTime(0, t, 0.2);
    this.subGain?.gain.setTargetAtTime(0, t, 0.2);
    this.whineGain?.gain.setTargetAtTime(0, t, 0.2);
  }

  /* ---------------- music drone ---------------- */

  private buildMusicDrone() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    lp.Q.value = 2.5;
    g.connect(lp).connect(this.musicBus!);

    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = 110; // A2
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 165.1; // E3 fifth
    const o3 = ctx.createOscillator();
    o3.type = "sine";
    o3.frequency.value = 55;
    o1.connect(g);
    o2.connect(g);
    o3.connect(g);
    o1.start();
    o2.start();
    o3.start();

    // slow filter LFO for movement
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
  }

  /* ---------------- one-shots ---------------- */

  private tone(
    freqFrom: number,
    freqTo: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    when = 0,
  ) {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFrom: number, filterTo: number, type: BiquadFilterType = "bandpass") {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFrom, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  uiClick() {
    this.tone(880, 1240, 0.07, "square", 0.08);
  }
  hover() {
    this.tone(1320, 1480, 0.05, "sine", 0.04);
  }
  beep(final: boolean) {
    if (final) this.tone(660, 1320, 0.3, "square", 0.14);
    else this.tone(440, 440, 0.12, "square", 0.1);
  }
  pickup() {
    this.tone(760, 1380, 0.12, "sine", 0.13);
    this.tone(1520, 2280, 0.1, "sine", 0.05, 0.02);
  }
  ring() {
    this.tone(520, 1040, 0.2, "triangle", 0.16);
    this.tone(1040, 1560, 0.22, "sine", 0.1, 0.05);
  }
  repair() {
    this.tone(392, 784, 0.3, "triangle", 0.15);
    this.tone(588, 1176, 0.28, "sine", 0.08, 0.08);
  }
  nearMiss() {
    this.noise(0.25, 0.16, 700, 3000);
    this.tone(320, 620, 0.16, "sine", 0.07);
  }
  gateClear() {
    this.tone(980, 980, 0.05, "sine", 0.05);
  }
  hit() {
    this.noise(0.3, 0.4, 1400, 140, "lowpass");
    this.tone(140, 45, 0.28, "square", 0.24);
  }
  death() {
    this.noise(0.9, 0.45, 2000, 60, "lowpass");
    this.tone(220, 30, 0.9, "sawtooth", 0.25);
    this.tone(110, 24, 0.9, "square", 0.2, 0.1);
  }
  win() {
    const seq = [523, 659, 784, 1046, 1318];
    seq.forEach((f, i) => this.tone(f, f, 0.24, "triangle", 0.13, i * 0.1));
  }
  lose() {
    const seq = [330, 262, 196, 131];
    seq.forEach((f, i) => this.tone(f, f * 0.92, 0.3, "triangle", 0.12, i * 0.12));
  }
  /** Short signature rev used when previewing a craft in the hangar. */
  rev(v: { wave: OscillatorType; base: number; range: number; filter: number; whine: number }) {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.base, t);
    osc.frequency.exponentialRampToValueAtTime(v.base + v.range, t + 0.22);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, v.base * 1.2), t + 0.62);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(v.filter, t);
    lp.frequency.exponentialRampToValueAtTime(v.filter * 3.5, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.66);
    osc.connect(lp).connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.7);
    if (v.whine > 0.3) this.tone(v.base * 6, v.base * 9, 0.3, "triangle", 0.03 * v.whine, 0.05);
    this.noise(0.35, 0.05, 400, 2600, "bandpass");
  }

  phaseShift() {
    this.tone(220, 1760, 0.5, "sawtooth", 0.08);
    this.noise(0.5, 0.1, 300, 4000, "highpass");
  }
}
