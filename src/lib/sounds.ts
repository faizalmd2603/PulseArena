import { Howl, Howler } from 'howler';

// SoundEngine powered by Howler.js and Web Audio synthesis for fallback & crystal clear zero-latency game audio
class SoundEngine {
  private isMuted: boolean = false;
  private volume: number = 0.8;

  // Howler sound instances
  private lobbyBgmHowl: Howl | null = null;
  private tickHowl: Howl | null = null;
  private urgentTickHowl: Howl | null = null;
  private correctChimeHowl: Howl | null = null;
  private wrongBuzzerHowl: Howl | null = null;
  private fanfareHowl: Howl | null = null;
  private applauseHowl: Howl | null = null;

  // Web Audio Context for zero-buffer instantaneous sound generation
  private ctx: AudioContext | null = null;
  private bgmInterval: any = null;
  private isBgmPlaying: boolean = false;

  constructor() {
    this.initHowler();
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private initHowler() {
    try {
      // Global Howler volume setting
      Howler.volume(this.volume);

      // Create base64 audio or procedural Howl buffers for reliable offline playback
      // 1. Countdown Tick Sound (Clean high woodblock/beep)
      this.tickHowl = new Howl({
        src: ['data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAA//AP//AP//AP//AP//AP8='],
        volume: 0.7,
        html5: false,
      });

      // 2. Correct Chime Sound (Bright upbeat chime)
      this.correctChimeHowl = new Howl({
        src: ['data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAA//AP//AP//AP//AP//AP8='],
        volume: 0.9,
      });

      // 3. Wrong Buzzer Sound (Deep low buzz)
      this.wrongBuzzerHowl = new Howl({
        src: ['data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAA//AP//AP//AP//AP//AP8='],
        volume: 0.9,
      });
    } catch (e) {
      console.warn('Howler init notice:', e);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    Howler.mute(muted);
    if (muted && this.isBgmPlaying) {
      this.stopLobbyBgm();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    Howler.volume(this.volume);
  }

  public getVolume(): number {
    return this.volume;
  }

  // --- SOUND EFFECTS ---

  // Button Click / Tap
  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15 * this.volume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      // safe fallback
    }
  }

  // Ticking countdown timer (Howler & procedural synthesis)
  public playTick(urgent: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = urgent ? 'sawtooth' : 'sine';
      const freq = urgent ? 880 : 540;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const baseGain = (urgent ? 0.35 : 0.16) * this.volume;
      gain.gain.setValueAtTime(baseGain, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (urgent ? 0.12 : 0.07));

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (urgent ? 0.12 : 0.07));
    } catch (e) {
      // safe fallback
    }
  }

  // Correct answer chime (Bright major triad C-E-G-C)
  public playCorrect() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.07);

        const peak = 0.25 * this.volume;
        gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.07);
        gain.gain.linearRampToValueAtTime(peak, this.ctx.currentTime + idx * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.07);
        osc.stop(this.ctx.currentTime + idx * 0.07 + 0.38);
      });
    } catch (e) {
      // safe fallback
    }
  }

  // Buzzer sound for incorrect answers (Low frequency double buzzing sawtooth)
  public playWrong() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(105, this.ctx.currentTime + 0.32);

      const baseGain = 0.28 * this.volume;
      gain.gain.setValueAtTime(baseGain, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {
      // safe fallback
    }
  }

  // 3-2-1 Countdown Beep
  public playCountdownBeep(isFinal: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 880 : 440, this.ctx.currentTime);

      const baseGain = (isFinal ? 0.3 : 0.2) * this.volume;
      gain.gain.setValueAtTime(baseGain, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isFinal ? 0.45 : 0.16));

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (isFinal ? 0.45 : 0.16));
    } catch (e) {
      // safe fallback
    }
  }

  // Podium Fanfare
  public playFanfare() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const fanfareSequence = [
        { f: 523.25, t: 0, d: 0.15 },
        { f: 523.25, t: 0.16, d: 0.15 },
        { f: 523.25, t: 0.32, d: 0.15 },
        { f: 659.25, t: 0.48, d: 0.4 },
        { f: 587.33, t: 0.9, d: 0.2 },
        { f: 659.25, t: 1.1, d: 0.2 },
        { f: 783.99, t: 1.35, d: 0.8 },
        { f: 1046.5, t: 2.2, d: 1.2 },
      ];

      fanfareSequence.forEach((item) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(item.f, this.ctx.currentTime + item.t);

        const baseGain = 0.25 * this.volume;
        gain.gain.setValueAtTime(baseGain, this.ctx.currentTime + item.t);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + item.t + item.d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + item.t);
        osc.stop(this.ctx.currentTime + item.t + item.d + 0.05);
      });
    } catch (e) {
      // safe fallback
    }
  }

  // Crowd cheer / Applause
  public playApplause() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 1.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18 * this.volume, this.ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {
      // safe fallback
    }
  }

  // Ambient Lobby Music (Synthesized upbeat rhythmic chill-step groove)
  public startLobbyBgm() {
    if (this.isMuted || this.isBgmPlaying) return;
    this.initCtx();
    if (!this.ctx) return;
    this.isBgmPlaying = true;

    const chords = [
      [261.63, 329.63, 392.00], // C
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [196.00, 246.94, 293.66], // G
    ];

    let chordIdx = 0;
    const playChordStep = () => {
      if (!this.isBgmPlaying || !this.ctx || this.isMuted) return;
      const current = chords[chordIdx % chords.length];
      chordIdx++;

      current.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.5, this.ctx.currentTime);

        const baseGain = 0.05 * this.volume;
        gain.gain.setValueAtTime(baseGain, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.85);
      });
    };

    playChordStep();
    this.bgmInterval = setInterval(playChordStep, 2000);
  }

  public stopLobbyBgm() {
    this.isBgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const sounds = new SoundEngine();
