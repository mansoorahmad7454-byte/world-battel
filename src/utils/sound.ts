import {
  buildArenaCommentary,
  CommentaryLanguage,
  CustomCommentaryConfig,
  DEFAULT_CUSTOM_COMMENTARY,
  getCountrySpokenName,
  resolveSpokenLanguage,
  SpokenLanguageCode,
} from '../data/raceCommentary';
import type { CountryDef } from '../data/countries';

export type { CommentaryLanguage, CustomCommentaryConfig, SpokenLanguageCode };

const CUSTOM_COMM_STORAGE_KEY = 'vortexia_custom_commentary_v1';

function loadCustomCommentary(): CustomCommentaryConfig {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CUSTOM_COMM_STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_CUSTOM_COMMENTARY };
    return { ...DEFAULT_CUSTOM_COMMENTARY, ...(JSON.parse(raw) as Partial<CustomCommentaryConfig>) };
  } catch {
    return { ...DEFAULT_CUSTOM_COMMENTARY };
  }
}

class ArenaSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = false;
  public voiceEnabled = true;
  public musicEnabled = true;
  public carAudioEnabled = true;
  public commentaryLang: CommentaryLanguage = 'en';
  public customCommentary: CustomCommentaryConfig = loadCustomCommentary();
  private lastBounceTime = 0;
  private cachedEnglishFemale: SpeechSynthesisVoice | null = null;
  private cachedOtherVoices: Record<string, SpeechSynthesisVoice> = {};
  private voiceLoaded = false;

  // Soft background music state
  private musicMasterGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicActive = false;
  private musicPaused = false;
  private musicStep = 0;
  private isSpeakingNow = false;
  private speechWatchdog: number | null = null;
  private speakingListeners = new Set<(speaking: boolean) => void>();

  // Continuous Formula Car Engine + Tire Rolling Road Audio
  private carMasterGain: GainNode | null = null;
  private carEngineGain: GainNode | null = null;
  private carTireGain: GainNode | null = null;
  private carHissGain: GainNode | null = null;
  private carEngineOsc1: OscillatorNode | null = null;
  private carEngineOsc2: OscillatorNode | null = null;
  private carEngineFilter: BiquadFilterNode | null = null;
  private carTireFilter: BiquadFilterNode | null = null;
  private carAudioInitialized = false;
  private carAudioActive = false;
  private lastZoomAt = 0;

  // Server TTS playback & uninterrupted speech queue
  private speechGen = 0;
  private fetchAbort: AbortController | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeAudioEl: HTMLAudioElement | null = null;
  private clientTtsCache = new Map<string, { audio: string; mimeType: string }>();
  private inFlightWarm = new Set<string>();
  private pendingSpeech: {
    text: string;
    langCode: SpokenLanguageCode;
    emotion: 'excited' | 'victory' | 'countdown';
  } | null = null;
  private lastSpokenText = '';
  private lastSpokenAt = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.pickVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.pickVoices();
      });
    }
  }

  private pickVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    this.voiceLoaded = true;

    const preferredFemaleKeys = [
      'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'zira', 'hazel',
      'susan', 'jenny', 'aria', 'ava', 'allison', 'emma', 'olivia', 'sonia', 'libby',
      'swara', 'kalpana', 'heera', 'lekha', 'uzma', 'milena', 'irina', 'elena',
      'monica', 'paulina', 'amelie', 'hedda', 'kyoko', 'ting-ting', 'female', 'woman',
    ];

    const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    for (const key of preferredFemaleKeys) {
      const match = englishVoices.find((v) => v.name.toLowerCase().includes(key));
      if (match) {
        this.cachedEnglishFemale = match;
        break;
      }
    }
    if (!this.cachedEnglishFemale) {
      this.cachedEnglishFemale = englishVoices[0] || voices[0] || null;
    }

    const langs = ['ur', 'hi', 'ru', 'ar', 'tr', 'es', 'fr', 'de', 'pt', 'ja', 'zh'];
    for (const prefix of langs) {
      const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
      if (candidates.length > 0) {
        let picked = candidates[0];
        for (const key of preferredFemaleKeys) {
          const m = candidates.find((v) => v.name.toLowerCase().includes(key));
          if (m) {
            picked = m;
            break;
          }
        }
        this.cachedOtherVoices[prefix] = picked;
      }
    }
  }

  private getOrCreateAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    return this.getOrCreateAudioContext();
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (val) {
      this.ensureContext();
    }
  }

  public setVoiceEnabled(val: boolean) {
    this.voiceEnabled = val;
    if (!val) {
      this.stopAllSpeech();
    }
  }

  public setMusicEnabled(val: boolean) {
    this.musicEnabled = val;
    if (val) {
      this.startRaceMusic();
    }
    this.updateMusicVolume();
  }

  public setCarAudioEnabled(val: boolean) {
    this.carAudioEnabled = val;
    this.updateCarMasterVolume();
  }

  public setCommentaryLang(lang: CommentaryLanguage) {
    this.commentaryLang = lang;
  }

  public setCustomCommentary(patch: Partial<CustomCommentaryConfig>) {
    this.customCommentary = { ...this.customCommentary, ...patch };
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CUSTOM_COMM_STORAGE_KEY, JSON.stringify(this.customCommentary));
      }
    } catch {
      // ignore storage quota
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private musicNoiseBuf: AudioBuffer | null = null;

  public startRaceMusic() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx) return;
    if (!this.musicNoiseBuf) {
      this.musicNoiseBuf = this.createNoiseBuffer(ctx);
    }

    if (!this.musicMasterGain) {
      this.musicMasterGain = ctx.createGain();
      this.musicMasterGain.gain.setValueAtTime(0, ctx.currentTime);
      this.musicMasterGain.connect(ctx.destination);
    }

    if (this.musicActive) {
      this.updateMusicVolume();
      return;
    }

    this.musicActive = true;
    this.updateMusicVolume();

    // Original copyright-free 126 BPM Stadium Action Beat (Am - F - C - G)
    const bassProg = [110, 110, 110, 110, 87.31, 87.31, 87.31, 87.31, 130.81, 130.81, 130.81, 130.81, 98, 98, 98, 98];
    const leadArp = [440, 523.25, 659.25, 523.25, 349.23, 440, 523.25, 440, 523.25, 659.25, 783.99, 659.25, 392, 493.88, 587.33, 493.88];

    this.musicTimer = window.setInterval(() => {
      if (!this.musicActive || !this.ctx || !this.musicMasterGain) return;
      if (!this.musicEnabled || this.musicPaused) return;
      if (this.ctx.state === 'suspended') return;

      const now = this.ctx.currentTime;
      const step = this.musicStep % 16;
      const bar = Math.floor(this.musicStep / 16) % 4;
      this.musicStep++;

      // 1. Punchy Four-on-the-Floor Kick on beats 0, 4, 8, 12
      if (step % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, now);
        kick.frequency.exponentialRampToValueAtTime(44, now + 0.14);
        kGain.gain.setValueAtTime(0.42, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        kick.connect(kGain);
        kGain.connect(this.musicMasterGain);
        kick.start(now);
        kick.stop(now + 0.18);
      }

      // 2. Soft Crisp Snare / Clap on beats 4 and 12 + Hi-Hat off-beats
      if (this.musicNoiseBuf && (step % 4 === 2 || step === 4 || step === 12)) {
        const isSnare = step === 4 || step === 12;
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = this.musicNoiseBuf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = isSnare ? 'bandpass' : 'highpass';
        filter.frequency.setValueAtTime(isSnare ? 1400 : 5200, now);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(isSnare ? 0.16 : 0.08, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + (isSnare ? 0.12 : 0.045));
        nSrc.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.musicMasterGain);
        nSrc.start(now);
        nSrc.stop(now + (isSnare ? 0.13 : 0.05));
      }

      // 3. Driving Synth Bassline on rhythmic 8ths
      if (step % 2 === 0 || step === 7 || step === 15) {
        const bassOsc = this.ctx.createOscillator();
        const bassFilter = this.ctx.createBiquadFilter();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassProg[(bar * 4 + Math.floor(step / 4)) % 16], now);
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(480, now);
        bassGain.gain.setValueAtTime(0.28, now);
        bassGain.gain.exponentialRampToValueAtTime(0.008, now + 0.16);
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.musicMasterGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.17);
      }

      // 4. Light Uplifting Melodic Synth Pluck
      if (step % 2 === 0) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        arpOsc.type = 'sine';
        const noteIdx = (bar * 4 + (step / 2) % 4) % leadArp.length;
        arpOsc.frequency.setValueAtTime(leadArp[noteIdx], now);
        arpGain.gain.setValueAtTime(0.11, now);
        arpGain.gain.exponentialRampToValueAtTime(0.003, now + 0.21);
        arpOsc.connect(arpGain);
        arpGain.connect(this.musicMasterGain);
        arpOsc.start(now);
        arpOsc.stop(now + 0.22);
      }
    }, 119);
  }

  public setMusicPaused(paused: boolean) {
    this.musicPaused = paused;
    this.updateMusicVolume();
  }

  public stopRaceMusic() {
    this.musicActive = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.updateMusicVolume();
  }

  private updateMusicVolume() {
    if (!this.ctx || !this.musicMasterGain) return;
    let target = 0.0;
    if (this.musicActive && this.musicEnabled && !this.musicPaused) {
      // Soft audible groove normally (0.24), ducks way down (0.02) while commentator speaks!
      target = this.isSpeakingNow ? 0.02 : 0.24;
    }
    const now = this.ctx.currentTime;
    this.musicMasterGain.gain.cancelScheduledValues(now);
    this.musicMasterGain.gain.setTargetAtTime(target, now, this.isSpeakingNow ? 0.04 : 0.18);
    this.updateCarMasterVolume();
  }

  private ensureCarAudioNodes(): boolean {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx) return false;
    if (this.carAudioInitialized) return true;
    this.carAudioInitialized = true;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.connect(ctx.destination);
    this.carMasterGain = master;

    // 1. Continuous 3s pink/brown tire-on-asphalt rolling road noise buffer
    const bufLen = Math.floor(ctx.sampleRate * 3);
    const roadBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = roadBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.06 * white) / 1.06;
      data[i] = Math.max(-1, Math.min(1, lastOut * 3.4));
    }

    const tireSrc = ctx.createBufferSource();
    tireSrc.buffer = roadBuf;
    tireSrc.loop = true;

    const tireFilter = ctx.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.setValueAtTime(220, ctx.currentTime);
    tireFilter.Q.setValueAtTime(0.95, ctx.currentTime);

    const tireGain = ctx.createGain();
    tireGain.gain.setValueAtTime(0.0, ctx.currentTime);

    tireSrc.connect(tireFilter);
    tireFilter.connect(tireGain);
    tireGain.connect(master);
    tireSrc.start();
    this.carTireFilter = tireFilter;
    this.carTireGain = tireGain;

    // 2. Crisp slick-rubber tarmac hiss layer
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = roadBuf;
    hissSrc.loop = true;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.setValueAtTime(1150, ctx.currentTime);

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.0, ctx.currentTime);

    hissSrc.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(master);
    hissSrc.start();
    this.carHissGain = hissGain;

    // 3. Dual-oscillator Formula car engine harmonics
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.setValueAtTime(320, ctx.currentTime);
    engFilter.Q.setValueAtTime(2.4, ctx.currentTime);

    const engGain = ctx.createGain();
    engGain.gain.setValueAtTime(0.0, ctx.currentTime);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(68, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(103, ctx.currentTime);

    osc1.connect(engFilter);
    osc2.connect(engFilter);
    engFilter.connect(engGain);
    engGain.connect(master);

    osc1.start();
    osc2.start();
    this.carEngineOsc1 = osc1;
    this.carEngineOsc2 = osc2;
    this.carEngineFilter = engFilter;
    this.carEngineGain = engGain;
    return true;
  }

  private updateCarMasterVolume() {
    if (!this.ctx || !this.carMasterGain) return;
    const now = this.ctx.currentTime;
    const target =
      this.carAudioActive && this.carAudioEnabled && !this.musicPaused
        ? this.isSpeakingNow
          ? 0.28
          : 0.92
        : 0;
    this.carMasterGain.gain.cancelScheduledValues(now);
    this.carMasterGain.gain.setTargetAtTime(target, now, 0.08);
  }

  public updateCarAudio(active: boolean, leadSpeedRatio = 0, avgSpeedRatio = 0) {
    this.carAudioActive = active;
    if (!active || !this.carAudioEnabled) {
      this.updateCarMasterVolume();
      return;
    }
    if (!this.ensureCarAudioNodes() || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const avgClamped = Math.max(0.06, Math.min(1.4, avgSpeedRatio));
    const leadClamped = Math.max(0.08, Math.min(1.45, leadSpeedRatio));

    // Tire rolling sound scales naturally from slow coasting hum to high-speed tread roar
    if (this.carTireFilter && this.carTireGain) {
      const tireFreq = 165 + avgClamped * 520;
      const tireLvl = 0.07 + avgClamped * 0.24;
      this.carTireFilter.frequency.setTargetAtTime(tireFreq, now, 0.08);
      this.carTireGain.gain.setTargetAtTime(tireLvl, now, 0.08);
    }

    if (this.carHissGain) {
      const hissLvl = Math.max(0.008, (avgClamped - 0.12) * 0.14);
      this.carHissGain.gain.setTargetAtTime(hissLvl, now, 0.08);
    }

    // Engine RPM rises smoothly from deep idle rumble (slow cars) to racing pitch (fast cars)
    if (this.carEngineOsc1 && this.carEngineOsc2 && this.carEngineFilter && this.carEngineGain) {
      const baseHz = 54 + leadClamped * 128;
      this.carEngineOsc1.frequency.setTargetAtTime(baseHz, now, 0.07);
      this.carEngineOsc2.frequency.setTargetAtTime(baseHz * 1.505, now, 0.07);
      this.carEngineFilter.frequency.setTargetAtTime(210 + leadClamped * 760, now, 0.08);
      this.carEngineGain.gain.setTargetAtTime(0.025 + leadClamped * 0.075, now, 0.08);
    }

    this.updateCarMasterVolume();
  }

  public stopCarAudio() {
    this.carAudioActive = false;
    this.updateCarMasterVolume();
  }

  public playCarZoomWhoosh(speedRatio = 1.0, isSlow = false) {
    if (!this.carAudioEnabled) return;
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const nowMs = performance.now();
    if (nowMs - this.lastZoomAt < 850) return;
    this.lastZoomAt = nowMs;

    const now = ctx.currentTime;
    const dur = isSlow ? 0.42 : 0.54;
    const peakGain = (this.isSpeakingNow ? 0.35 : 1.0) * (isSlow ? 0.07 : Math.min(0.22, 0.11 + speedRatio * 0.09));

    // Doppler engine pass-by ("ZOOOOM!")
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = isSlow ? 'triangle' : 'sawtooth';
    if (isSlow) {
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.linearRampToValueAtTime(175, now + dur * 0.35);
      osc.frequency.exponentialRampToValueAtTime(92, now + dur);
    } else {
      const peakHz = 380 + Math.min(480, speedRatio * 340);
      osc.frequency.setValueAtTime(peakHz * 0.68, now);
      osc.frequency.exponentialRampToValueAtTime(peakHz, now + dur * 0.36);
      osc.frequency.exponentialRampToValueAtTime(peakHz * 0.28, now + dur);
    }

    const oFilter = ctx.createBiquadFilter();
    oFilter.type = 'lowpass';
    oFilter.frequency.setValueAtTime(isSlow ? 360 : 1850, now);

    oGain.gain.setValueAtTime(0.001, now);
    oGain.gain.linearRampToValueAtTime(peakGain * 0.55, now + dur * 0.34);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(oFilter);
    oFilter.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    // Sweeping Tire + Air Doppler Whoosh
    if (!this.musicNoiseBuf) {
      this.musicNoiseBuf = this.createNoiseBuffer(ctx);
    }
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = this.musicNoiseBuf;
    nSrc.loop = true;

    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.Q.setValueAtTime(1.6, now);
    nFilter.frequency.setValueAtTime(isSlow ? 240 : 480, now);
    nFilter.frequency.exponentialRampToValueAtTime(isSlow ? 420 : 2100, now + dur * 0.36);
    nFilter.frequency.exponentialRampToValueAtTime(isSlow ? 160 : 320, now + dur);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(peakGain * 0.95, now + dur * 0.34);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    nSrc.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    nSrc.start(now);
    nSrc.stop(now + dur + 0.02);
  }

  public getIsSpeaking(): boolean {
    return this.isSpeakingNow;
  }

  public subscribeSpeaking(cb: (speaking: boolean) => void): () => void {
    this.speakingListeners.add(cb);
    return () => {
      this.speakingListeners.delete(cb);
    };
  }

  private notifySpeaking() {
    this.speakingListeners.forEach((cb) => cb(this.isSpeakingNow));
  }

  private onSpeechStart(maxMs = 9500) {
    if (!this.isSpeakingNow) {
      this.isSpeakingNow = true;
      this.notifySpeaking();
    }
    this.updateMusicVolume();
    if (this.speechWatchdog !== null) {
      window.clearTimeout(this.speechWatchdog);
    }
    this.speechWatchdog = window.setTimeout(() => {
      this.onSpeechEnd();
    }, maxMs);
  }

  private onSpeechEnd() {
    if (this.speechWatchdog !== null) {
      window.clearTimeout(this.speechWatchdog);
      this.speechWatchdog = null;
    }
    if (this.isSpeakingNow) {
      this.isSpeakingNow = false;
      this.notifySpeaking();
    }
    this.updateMusicVolume();

    if (this.pendingSpeech && this.voiceEnabled && this.fetchAbort === null) {
      const next = this.pendingSpeech;
      this.pendingSpeech = null;
      this.speakText(next.text, false, next.langCode, next.emotion);
    }
  }

  public stopAllSpeech() {
    this.speechGen++;
    this.pendingSpeech = null;
    if (this.fetchAbort) {
      this.fetchAbort.abort();
      this.fetchAbort = null;
    }
    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
      } catch {
        // ignore stopped buffer
      }
      this.activeSource = null;
    }
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
        this.activeAudioEl.currentTime = 0;
      } catch {
        // ignore
      }
      this.activeAudioEl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.onSpeechEnd();
  }

  public unlockSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (!this.voiceLoaded) {
        this.pickVoices();
      }
    }
    this.getOrCreateAudioContext();
  }

  private base64ToArrayBuffer(b64: string): ArrayBuffer {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async playBase64Audio(
    base64Audio: string,
    mimeType: string,
    gen: number,
    speedRate = 1.0
  ): Promise<boolean> {
    if (gen !== this.speechGen) return false;
    const ctx = this.getOrCreateAudioContext();
    if (ctx && ctx.state === 'running') {
      try {
        const bufferCopy = this.base64ToArrayBuffer(base64Audio);
        const decoded = await ctx.decodeAudioData(bufferCopy);
        if (gen !== this.speechGen) return false;

        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        source.buffer = decoded;
        source.playbackRate.value = speedRate;
        source.connect(gain);
        gain.connect(ctx.destination);

        this.activeSource = source;
        this.onSpeechStart(Math.max(2500, Math.round((decoded.duration / speedRate) * 1000) + 700));
        source.onended = () => {
          if (this.activeSource === source) {
            this.activeSource = null;
            this.onSpeechEnd();
          }
        };
        source.start(0);
        return true;
      } catch {
        // Fall through to HTMLAudioElement
      }
    }

    try {
      const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
      audio.volume = 1.0;
      audio.playbackRate = speedRate;
      this.activeAudioEl = audio;
      this.onSpeechStart(9500);
      audio.onended = () => {
        if (this.activeAudioEl === audio) {
          this.activeAudioEl = null;
          this.onSpeechEnd();
        }
      };
      audio.onerror = () => {
        if (this.activeAudioEl === audio) {
          this.activeAudioEl = null;
          this.onSpeechEnd();
        }
      };
      await audio.play();
      return true;
    } catch {
      this.onSpeechEnd();
      return false;
    }
  }

  private fallbackBrowserSpeak(text: string, langCode: SpokenLanguageCode) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.onSpeechEnd();
      return;
    }
    try {
      const synth = window.speechSynthesis;
      if (!this.voiceLoaded) this.pickVoices();

      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);

      if (langCode === 'en') {
        utter.lang = 'en-US';
        if (this.cachedEnglishFemale) utter.voice = this.cachedEnglishFemale;
        utter.pitch = 1.15;
        utter.rate = 1.12;
      } else {
        const matchedVoice =
          this.cachedOtherVoices[langCode] ||
          (langCode === 'ur' ? this.cachedOtherVoices['hi'] : undefined);
        if (!matchedVoice) {
          // No matching OS voice available; avoid mangling non-English text with an English voice
          this.onSpeechEnd();
          return;
        }
        utter.voice = matchedVoice;
        utter.lang = matchedVoice.lang;
        utter.pitch = 1.14;
        utter.rate = 1.06;
      }

      utter.volume = 1.0;
      utter.onstart = () => this.onSpeechStart(8000);
      utter.onend = () => this.onSpeechEnd();
      utter.onerror = () => this.onSpeechEnd();
      this.onSpeechStart(8000);
      synth.speak(utter);
    } catch {
      this.onSpeechEnd();
    }
  }

  public prewarmPhrase(
    text: string,
    langCode: SpokenLanguageCode = 'en',
    emotion: 'excited' | 'victory' | 'countdown' = 'countdown'
  ) {
    if (!this.voiceEnabled || !text.trim()) return;
    const cacheKey = `${langCode}:${emotion}:${text}`;
    if (this.clientTtsCache.has(cacheKey) || this.inFlightWarm.has(cacheKey)) return;
    this.inFlightWarm.add(cacheKey);

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: langCode, emotion }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { audio?: string | null; mimeType?: string };
      })
      .then((data) => {
        if (data?.audio) {
          if (this.clientTtsCache.size >= 80) {
            const firstKey = this.clientTtsCache.keys().next().value;
            if (firstKey) this.clientTtsCache.delete(firstKey);
          }
          this.clientTtsCache.set(cacheKey, {
            audio: data.audio,
            mimeType: data.mimeType || 'audio/mpeg',
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.inFlightWarm.delete(cacheKey);
      });
  }

  public speakText(
    text: string,
    forceInterrupt = false,
    langCode: SpokenLanguageCode = 'en',
    emotion: 'excited' | 'victory' | 'countdown' = 'excited'
  ) {
    if (!this.voiceEnabled || !text.trim()) return;
    if (emotion === 'countdown' && !this.customCommentary.enableCountdown) return;
    if (emotion === 'excited' && !this.customCommentary.enableEvents) return;
    if (emotion === 'victory' && !this.customCommentary.enableVictory) return;

    const now = performance.now();
    if (!forceInterrupt && text === this.lastSpokenText && now - this.lastSpokenAt < 3500) {
      return;
    }

    // Never cut off the commentator mid-sentence unless explicitly interrupted (e.g. GO! or language change).
    // Queue the latest highlight and pre-warm it so it plays seamlessly right after the active sentence!
    if (!forceInterrupt && (this.isSpeakingNow || this.fetchAbort !== null)) {
      if (!this.pendingSpeech || this.pendingSpeech.emotion !== 'victory' || emotion === 'victory') {
        this.pendingSpeech = { text, langCode, emotion };
        this.prewarmPhrase(text, langCode, emotion);
      }
      return;
    }

    this.lastSpokenText = text;
    this.lastSpokenAt = now;

    if (forceInterrupt) {
      this.stopAllSpeech();
    }

    const gen = ++this.speechGen;
    // Play at true 1.0x natural vocal pitch (Edge Neural prosody handles energetic pacing cleanly)
    const speedRate = 1.0;
    const cacheKey = `${langCode}:${emotion}:${text}`;
    const cachedAudio = this.clientTtsCache.get(cacheKey);
    if (cachedAudio) {
      void this.playBase64Audio(cachedAudio.audio, cachedAudio.mimeType, gen, speedRate);
      return;
    }

    const controller = new AbortController();
    this.fetchAbort = controller;

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: langCode, emotion }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        return (await res.json()) as { audio?: string | null; mimeType?: string };
      })
      .then((data) => {
        if (this.fetchAbort === controller) {
          this.fetchAbort = null;
        }
        if (gen !== this.speechGen) return;
        if (data.audio) {
          const mime = data.mimeType || 'audio/mpeg';
          if (this.clientTtsCache.size >= 80) {
            const firstKey = this.clientTtsCache.keys().next().value;
            if (firstKey) this.clientTtsCache.delete(firstKey);
          }
          this.clientTtsCache.set(cacheKey, { audio: data.audio, mimeType: mime });
          void this.playBase64Audio(data.audio, mime, gen, speedRate);
        } else {
          this.fallbackBrowserSpeak(text, langCode);
        }
      })
      .catch((err) => {
        if (this.fetchAbort === controller) {
          this.fetchAbort = null;
        }
        if ((err as Error)?.name === 'AbortError') return;
        if (gen !== this.speechGen) return;
        this.fallbackBrowserSpeak(text, langCode);
      });
  }

  public speakCountryOut(countryOrName: CountryDef | string, rosterCodes: string[] = []) {
    const lang = resolveSpokenLanguage(this.commentaryLang, rosterCodes);
    const spokenName =
      typeof countryOrName === 'string'
        ? countryOrName
        : getCountrySpokenName(countryOrName, lang);
    const custom = this.customCommentary.customEventLine.trim();
    const line = custom
      ? custom.replace(/\{country\}|\{leader\}|\{winner\}/gi, spokenName)
      : buildArenaCommentary('out', lang, spokenName);
    this.speakText(line, false, lang, 'excited');
  }

  public speakWinner(countryOrName: CountryDef | string, rosterCodes: string[] = []) {
    const lang = resolveSpokenLanguage(this.commentaryLang, rosterCodes);
    const spokenName =
      typeof countryOrName === 'string'
        ? countryOrName
        : getCountrySpokenName(countryOrName, lang);
    const custom = this.customCommentary.customVictoryLine.trim();
    const line = custom
      ? custom.replace(/\{winner\}|\{country\}|\{leader\}/gi, spokenName)
      : buildArenaCommentary('victory', lang, spokenName);
    this.speakText(line, true, lang, 'victory');
  }

  public playBounce(intensity = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastBounceTime < 0.045) return;
    this.lastBounceTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = 220 + Math.min(1, intensity) * 260;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.045);

    gain.gain.setValueAtTime(0.035 * Math.min(1, intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playPitGun() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    // Two quick Formula 1 pneumatic wheel-gun bursts!
    [0, 0.14].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(920, now + offset);
      osc.frequency.exponentialRampToValueAtTime(480, now + offset + 0.09);
      gain.gain.setValueAtTime(0.075, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  }

  public playHurdleHit() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playCrowdCheer() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.9);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      out[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.9);
  }

  public playShieldPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.06, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.15);
    });
  }

  public playShieldBreak() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.15);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playEliminate() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.18);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playVictory() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playCountdownBeep(isGo: boolean) {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(isGo ? 0.12 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.38 : 0.16));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isGo ? 0.4 : 0.18));
  }

  public playMartialHit(heavy = false) {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(heavy ? 185 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + (heavy ? 0.14 : 0.08));
    gain.gain.setValueAtTime(heavy ? 0.18 : 0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.15 : 0.09));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (heavy ? 0.16 : 0.1));
  }

  public playMartialBlock() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.06);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playWhoosh() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playKO() {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    [160, 120, 82].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      osc.frequency.exponentialRampToValueAtTime(38, now + idx * 0.09 + 0.25);
      gain.gain.setValueAtTime(0.16, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.27);
    });
  }
}

export const soundEngine = new ArenaSoundEngine();
