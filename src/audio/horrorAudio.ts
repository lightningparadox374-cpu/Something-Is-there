// Hybrid Web Audio API + curated horror SFX soundscape for SOMETHING IS THERE
import type { StalkerBehaviorState } from '../types/game';
import type { FloorMaterial } from '../game/mapData';
import { SpatialAudioManager } from './spatialAudioManager';
import { FootstepAudioManager } from './footstepAudioManager';

const HORROR_SFX_PACK_URL =
  '/assets/aistudio/10_FREE_Horror_Sounds_for_Your_Game____shorts_09be4694.mp3';

interface HorrorClipSlice {
  start: number;
  duration: number;
  gain: number;
}

const NEAR_GHOST_CLIPS: HorrorClipSlice[] = [
  { start: 0.04, duration: 3.25, gain: 0.55 }, // 1. Abyssal howling rumble
  { start: 3.58, duration: 3.25, gain: 0.52 }, // 2. Unnerving corridor drone
  { start: 7.1, duration: 2.7, gain: 0.58 }, // 3. Rhythmic phantom whoosh/breath
  { start: 15.6, duration: 3.15, gain: 0.62 }, // 6. Deep sub-bass dread horn
  { start: 24.88, duration: 2.65, gain: 0.54 }, // 9. Distorted pulsing transmission
  { start: 27.8, duration: 1.12, gain: 0.66 }, // 10. Hollow eerie knocks
];

const INTENSE_GHOST_CLIPS: HorrorClipSlice[] = [
  { start: 9.98, duration: 2.85, gain: 0.68 }, // 4. Screeching banshee wail
  { start: 12.98, duration: 2.38, gain: 0.72 }, // 5. Sharp metallic horror sting
  { start: 19.38, duration: 2.52, gain: 0.64 }, // 7. Rising siren terror sting
  { start: 22.06, duration: 2.62, gain: 0.74 }, // 8. Violent metallic slam + screech
];

export class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private worldBus: GainNode | null = null;
  private sanityMuffleFilter: BiquadFilterNode | null = null;
  private hallucinationBedGain: GainNode | null = null;
  private hallucinationBedFilter: BiquadFilterNode | null = null;
  private humGain: GainNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private humPanner: StereoPannerNode | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humOsc3: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private swellTimer: number | null = null;
  private delayNode: DelayNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private horrorPackBuffer: AudioBuffer | null = null;
  private readonly spatialAudio = new SpatialAudioManager();
  private readonly footstepManager = new FootstepAudioManager();
  private volume = 0.7;
  private chaseTension = 0;
  private isStarted = false;
  private lastHeartbeatTime = 0;
  private lastBreathingTime = 0;
  private lastFlickerZapTime = 0;
  private lastBallastBuzzTime = 0;
  private lastNearGhostClipTime = 0;
  private activeHorrorClipUntil = 0;
  private lastNearClipIdx = -1;
  private lastIntenseClipIdx = -1;
  private lastSanityHallucinationTime = 0;
  private nextHallucinationCooldown = 6500;
  private lastWhisperSide = 1;
  private lastPlayerBreathTime = 0;
  private nextPlayerBreathCooldown = 900;
  private smoothedExertion = 0;
  private stalkerWhisperBedGain: GainNode | null = null;
  private stalkerWhisperBedFilter: BiquadFilterNode | null = null;
  private stalkerWhisperBedPanner: StereoPannerNode | null = null;
  private lastChaoticWhisperTime = 0;
  private nextChaoticWhisperCooldown = 1400;
  private lobbyMode = false;
  private lobbyCueTimer: number | null = null;

  public init(): void {
    if (this.isStarted) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Dynamic world-audio muffle bus: stays transparent at healthy sanity, sweeps down when dissociating in dark
    this.sanityMuffleFilter = this.ctx.createBiquadFilter();
    this.sanityMuffleFilter.type = 'lowpass';
    this.sanityMuffleFilter.frequency.value = 20000;
    this.sanityMuffleFilter.Q.value = 0.7;
    this.sanityMuffleFilter.connect(this.masterGain);

    this.worldBus = this.ctx.createGain();
    this.worldBus.gain.value = 1.0;
    this.worldBus.connect(this.sanityMuffleFilter);

    // Pre-generate 2 seconds of white noise for bursts, hiss, footsteps, whispers, and static
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    this.spatialAudio.attach(this.ctx, this.worldBus, this.noiseBuffer);
    this.footstepManager.attach(this.ctx, this.worldBus, this.noiseBuffer);

    this.startFluorescentHum();
    this.startSubDrone();
    this.startHorrorMusic();
    this.startHallucinationBed();
    this.startStalkerWhisperBed();
    void this.loadHorrorPack();
    this.isStarted = true;
    if (this.lobbyMode) {
      this.applyLobbyMix();
      this.scheduleLobbyCue();
    }
  }

  public isAudioRunning(): boolean {
    return Boolean(this.isStarted && this.ctx && this.ctx.state === 'running');
  }

  public async resumeContext(): Promise<boolean> {
    if (!this.isStarted) {
      this.init();
    }
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    if (this.lobbyMode) {
      this.applyLobbyMix();
      this.scheduleLobbyCue();
    }
    return this.ctx.state === 'running';
  }

  public setLobbyMode(enabled: boolean): void {
    this.lobbyMode = enabled;
    if (!enabled && this.lobbyCueTimer !== null) {
      clearTimeout(this.lobbyCueTimer);
      this.lobbyCueTimer = null;
    }
    if (!this.ctx || !this.isStarted) return;
    this.applyLobbyMix();
    if (enabled) {
      this.scheduleLobbyCue();
    }
  }

  private applyLobbyMix(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.lobbyMode) {
      this.chaseTension = 0;
      if (this.humGain) this.humGain.gain.setTargetAtTime(0.022, now, 0.25);
      if (this.droneGain) this.droneGain.gain.setTargetAtTime(0.058, now, 0.25);
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.18, now, 0.25);
      if (this.musicFilter) this.musicFilter.frequency.setTargetAtTime(380, now, 0.25);
    } else {
      if (this.humGain) this.humGain.gain.setTargetAtTime(0.04, now, 0.2);
      if (this.droneGain) this.droneGain.gain.setTargetAtTime(0.035, now, 0.2);
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.145, now, 0.2);
      if (this.musicFilter) this.musicFilter.frequency.setTargetAtTime(340, now, 0.2);
    }
  }

  private scheduleLobbyCue(): void {
    if (!this.lobbyMode || !this.isStarted) return;
    if (this.lobbyCueTimer !== null) return;

    const queueNext = (initialDelayMs?: number) => {
      const waitMs = initialDelayMs ?? 7200 + Math.random() * 6800;
      this.lobbyCueTimer = window.setTimeout(() => {
        this.lobbyCueTimer = null;
        if (!this.lobbyMode || !this.ctx || this.ctx.state !== 'running') {
          if (this.lobbyMode) queueNext(2500);
          return;
        }
        const roll = Math.random();
        const pan = (Math.random() - 0.5) * 1.4;
        if (roll < 0.45 && this.horrorPackBuffer) {
          // Distant eerie corridor clip from pack
          const clip = NEAR_GHOST_CLIPS[Math.floor(Math.random() * NEAR_GHOST_CLIPS.length)];
          this.playClipSlice(clip, 0.34, pan, false);
        } else if (roll < 0.78) {
          this.playSanityHallucination('whisper', 0.34);
        } else {
          this.playSanityHallucination('phantom_knocks', 0.32);
        }
        queueNext();
      }, waitMs);
    };

    queueNext(1800);
  }

  public playMenuSfx(kind: 'hover' | 'click'): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (kind === 'hover') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.032);
      g.gain.setValueAtTime(0.025, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.035);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    // Dark analog switch click + subtle low thud
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(980, now);
    clickOsc.frequency.exponentialRampToValueAtTime(190, now + 0.04);
    clickGain.gain.setValueAtTime(0.075, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);
    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    subGain.gain.setValueAtTime(0.09, now);
    subGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.19);
  }

  private getWorldOutput(): AudioNode | null {
    return this.worldBus ?? this.masterGain;
  }

  private async loadHorrorPack(): Promise<void> {
    if (!this.ctx || this.horrorPackBuffer) return;
    try {
      const res = await fetch(HORROR_SFX_PACK_URL);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      if (!this.ctx) return;
      this.horrorPackBuffer = await this.ctx.decodeAudioData(arr);
    } catch {
      // Ignore if audio decoding fails; procedural audio remains active
    }
  }

  private playClipSlice(
    slice: HorrorClipSlice,
    volumeScale: number,
    pan = 0,
    allowOverlap = false,
  ): void {
    if (!this.ctx || !this.masterGain || !this.horrorPackBuffer) return;
    const now = this.ctx.currentTime;
    if (!allowOverlap && now < this.activeHorrorClipUntil) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.horrorPackBuffer;

    const gain = this.ctx.createGain();
    const peak = Math.max(0.04, Math.min(1.0, slice.gain * volumeScale));
    const fadeIn = 0.03;
    const fadeOutStart = Math.max(fadeIn + 0.05, slice.duration - 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + fadeIn);
    gain.gain.setValueAtTime(peak, now + fadeOutStart);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + slice.duration);

    const worldOut = this.getWorldOutput();
    if (!worldOut) return;

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.92, Math.min(0.92, pan));
      src.connect(gain);
      gain.connect(panner);
      panner.connect(worldOut);
    } else {
      src.connect(gain);
      gain.connect(worldOut);
    }

    src.start(now, slice.start, slice.duration);
    this.activeHorrorClipUntil = Math.max(this.activeHorrorClipUntil, now + slice.duration * 0.85);
  }

  public playGhostProximitySfx(
    mode: 'near' | 'intense',
    distance: number,
    pan = 0,
    force = false,
  ): void {
    if (!this.ctx || !this.horrorPackBuffer) return;
    const nowMs = performance.now();
    const minCooldown = mode === 'intense' ? 4200 : 5400;
    if (!force && nowMs - this.lastNearGhostClipTime < minCooldown) return;

    const pool = mode === 'intense' ? INTENSE_GHOST_CLIPS : NEAR_GHOST_CLIPS;
    const prevIdx = mode === 'intense' ? this.lastIntenseClipIdx : this.lastNearClipIdx;
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === prevIdx) {
      idx = (idx + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    }
    if (mode === 'intense') {
      this.lastIntenseClipIdx = idx;
    } else {
      this.lastNearClipIdx = idx;
    }

    const atten = Math.pow(Math.max(0.18, Math.min(1, 1 - distance / 20)), 0.7);
    this.lastNearGhostClipTime = nowMs;
    this.playClipSlice(pool[idx], atten, pan, force);
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setHumIntensity(intensity: number): void {
    if (!this.humGain || !this.ctx || this.lobbyMode) return;
    const target = Math.max(0.004, Math.min(0.08, intensity * 0.05));
    this.humGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  /**
   * Synchronizes the low-frequency 60Hz/120Hz/180Hz electrical fluorescent buzz
   * directly with the real-time flickering intensity and proximity of nearby overhead fixtures.
   */
  public updateProximityLightBuzz(
    proximityWeight: number,
    normalizedIntensity: number,
    flickerDelta: number,
    pan: number,
    activeGameplay: boolean,
  ): void {
    if (!this.humGain || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.lobbyMode || !activeGameplay) {
      this.humGain.gain.setTargetAtTime(this.lobbyMode ? 0.022 : 0.004, now, 0.15);
      if (this.humFilter) {
        this.humFilter.frequency.setTargetAtTime(175, now, 0.15);
        this.humFilter.Q.setTargetAtTime(1.6, now, 0.15);
      }
      if (this.humPanner) {
        this.humPanner.pan.setTargetAtTime(0, now, 0.15);
      }
      return;
    }

    const prox = Math.max(0, Math.min(1, proximityWeight));
    const norm = Math.max(0, Math.min(1.5, normalizedIntensity));
    const delta = Math.max(0, Math.min(1, flickerDelta));
    const clampedPan = Math.max(-0.85, Math.min(0.85, pan));

    // Rapid 16ms tracking so buzz swells and cuts out in tight sync with visual flickers
    const activePower = Math.min(1.3, norm);
    const targetGain =
      prox > 0.01
        ? 0.0015 + prox * (0.006 + activePower * 0.072 + delta * 0.028)
        : 0.0015;
    this.humGain.gain.setTargetAtTime(targetGain, now, 0.016);

    if (this.humFilter) {
      const targetCutoff = 140 + activePower * 125 + delta * 260;
      this.humFilter.frequency.setTargetAtTime(targetCutoff, now, 0.022);
      this.humFilter.Q.setTargetAtTime(1.5 + delta * 2.4, now, 0.025);
    }

    if (this.humOsc2) {
      const mainsSagCents = (activePower - 1) * 18 + delta * 15;
      this.humOsc2.detune.setTargetAtTime(mainsSagCents, now, 0.025);
    }

    if (this.humPanner) {
      this.humPanner.pan.setTargetAtTime(clampedPan, now, 0.04);
    }

    // Trigger a short low-frequency ballast arc pulse on sharp flicker transitions near the player
    if (delta >= 0.36 && prox >= 0.18) {
      const nowMs = performance.now();
      if (nowMs - this.lastBallastBuzzTime >= 85) {
        this.lastBallastBuzzTime = nowMs;
        this.triggerBallastArcBuzz(prox, norm > 0.15, clampedPan);
      }
    }
  }

  private triggerBallastArcBuzz(proximity: number, sparkingOn: boolean, pan: number): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    const now = this.ctx.currentTime;
    const dur = sparkingOn ? 0.11 : 0.075;

    const bus = this.ctx.createGain();
    bus.gain.value = 1;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      bus.connect(panner);
      panner.connect(worldOut);
    } else {
      bus.connect(worldOut);
    }

    // Low-frequency ballast thrum (60Hz/120Hz surge)
    const osc = this.ctx.createOscillator();
    const lpf = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(sparkingOn ? 118 + Math.random() * 16 : 64, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + dur);

    lpf.type = 'lowpass';
    lpf.frequency.value = sparkingOn ? 380 : 210;
    lpf.Q.value = 2.6;

    const peak = 0.018 + proximity * (sparkingOn ? 0.058 : 0.032);
    g.gain.setValueAtTime(0.0005, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0006, now + dur);

    osc.connect(lpf);
    lpf.connect(g);
    g.connect(bus);
    osc.start(now);
    osc.stop(now + dur + 0.015);
  }

  public setChaseTension(level: number): void {
    if (!this.droneGain || !this.ctx || this.lobbyMode) return;
    const clamped = Math.max(0, Math.min(1, level));
    this.chaseTension = clamped;
    this.droneGain.gain.setTargetAtTime(0.035 + clamped * 0.16, this.ctx.currentTime, 0.15);
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.145 + clamped * 0.135, this.ctx.currentTime, 0.18);
    }
    if (this.musicFilter) {
      this.musicFilter.frequency.setTargetAtTime(340 + clamped * 920, this.ctx.currentTime, 0.25);
    }
  }

  private startFluorescentHum(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.025;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 210;
    filter.Q.value = 2.2;
    this.humFilter = filter;

    this.humOsc1 = this.ctx.createOscillator();
    this.humOsc1.type = 'sawtooth';
    this.humOsc1.frequency.value = 60;

    this.humOsc2 = this.ctx.createOscillator();
    this.humOsc2.type = 'triangle';
    this.humOsc2.frequency.value = 120.4;

    this.humOsc3 = this.ctx.createOscillator();
    this.humOsc3.type = 'sawtooth';
    this.humOsc3.frequency.value = 180.2;

    const g1 = this.ctx.createGain();
    g1.gain.value = 0.65;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.45;
    const g3 = this.ctx.createGain();
    g3.gain.value = 0.22;

    this.humOsc1.connect(g1);
    this.humOsc2.connect(g2);
    this.humOsc3.connect(g3);
    g1.connect(filter);
    g2.connect(filter);
    g3.connect(filter);
    filter.connect(this.humGain);

    if (this.ctx.createStereoPanner) {
      this.humPanner = this.ctx.createStereoPanner();
      this.humPanner.pan.value = 0;
      this.humGain.connect(this.humPanner);
      this.humPanner.connect(worldOut);
    } else {
      this.humGain.connect(worldOut);
    }

    this.humOsc1.start();
    this.humOsc2.start();
    this.humOsc3.start();
  }

  private startSubDrone(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.02;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 95;

    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = 38;

    this.droneOsc.connect(lowpass);
    lowpass.connect(this.droneGain);
    this.droneGain.connect(worldOut);
    this.droneOsc.start();
  }

  private startHorrorMusic(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;

    // Dynamics compressor prevents harsh clipping while allowing huge cinematic dread swells
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;
    compressor.connect(worldOut);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.145;
    this.musicGain.connect(compressor);

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 340;
    padFilter.Q.value = 3.2;
    padFilter.connect(this.musicGain);
    this.musicFilter = padFilter;

    // Slow uncanny LFO breathing the horror pad cutoff
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 175;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    // Warped tape pitch-flutter LFO shared across dissonant voices
    const warpLfo = this.ctx.createOscillator();
    const warpGain = this.ctx.createGain();
    warpLfo.type = 'sine';
    warpLfo.frequency.value = 0.23;
    warpGain.gain.value = 14; // cents wobble
    warpLfo.connect(warpGain);
    warpLfo.start();

    // Long cavernous echoing delay bus
    const delay = this.ctx.createDelay(2.0);
    delay.delayTime.value = 0.54;
    const delayFb = this.ctx.createGain();
    delayFb.gain.value = 0.58;
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'bandpass';
    delayFilter.frequency.value = 680;
    delayFilter.Q.value = 0.7;
    delay.connect(delayFilter);
    delayFilter.connect(delayFb);
    delayFb.connect(delay);
    delayFilter.connect(this.musicGain);
    this.delayNode = delay;

    // 1. Dissonant Abyssal Drone Cluster (minor-second & tritone saw/triangle grind)
    const padVoices = [
      { freq: 36.71, type: 'sawtooth' as OscillatorType, gain: 0.28, detune: -6 }, // D1 abyssal sub
      { freq: 55.0, type: 'triangle' as OscillatorType, gain: 0.3, detune: 5 },    // A1
      { freq: 58.27, type: 'sawtooth' as OscillatorType, gain: 0.18, detune: -11 }, // Bb1 clashing minor 2nd
      { freq: 77.78, type: 'sawtooth' as OscillatorType, gain: 0.16, detune: 9 },   // Eb2 tritone grind
      { freq: 103.83, type: 'triangle' as OscillatorType, gain: 0.15, detune: -8 }, // G#2 dissonance
      { freq: 116.54, type: 'sine' as OscillatorType, gain: 0.18, detune: 12 },    // Bb2 beating harmonic
    ];

    for (const v of padVoices) {
      const osc = this.ctx.createOscillator();
      const vGain = this.ctx.createGain();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;
      warpGain.connect(osc.detune);
      vGain.gain.value = v.gain;
      osc.connect(vGain);
      vGain.connect(padFilter);
      osc.start();
    }

    // 2. Haunting Cold Corridor Wind / Void Whisper Loop
    if (this.noiseBuffer) {
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 310;
      windFilter.Q.value = 3.8;

      const windLfo = this.ctx.createOscillator();
      const windLfoGain = this.ctx.createGain();
      windLfo.type = 'sine';
      windLfo.frequency.value = 0.07;
      windLfoGain.gain.value = 180;
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);
      windLfo.start();

      const windGain = this.ctx.createGain();
      windGain.gain.value = 0.16;

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(this.musicGain);
      windSrc.start();
    }

    // 3. Out-of-tune Ghostly Piano / Broken Music-Box & Chromatic Dread Notes
    const eerieScale = [146.83, 155.56, 207.65, 220.0, 293.66, 311.13, 415.3, 466.16, 587.33, 622.25];
    const scheduleNextNote = () => {
      if (!this.ctx || !this.musicGain || !this.delayNode) return;
      const now = this.ctx.currentTime;
      const baseFreq = eerieScale[Math.floor(Math.random() * eerieScale.length)];

      // Dual detuned voices for haunted tape-warped piano/music-box chill
      for (const detuneCents of [-9, 11]) {
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        osc.type = detuneCents < 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.detune.setValueAtTime(detuneCents, now);
        osc.detune.linearRampToValueAtTime(detuneCents - 32, now + 3.4); // eerie downward tape sag

        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(detuneCents < 0 ? 0.13 : 0.1, now + 0.06);
        noteGain.gain.exponentialRampToValueAtTime(0.0008, now + 3.6);

        osc.connect(noteGain);
        noteGain.connect(this.musicGain);
        noteGain.connect(this.delayNode);
        osc.start(now);
        osc.stop(now + 3.7);
      }

      // Faster, sharper chromatic panic notes when monster tension is high; sparser in lobby
      const baseWait = this.lobbyMode ? 3200 + Math.random() * 2800 : 2400 + Math.random() * 2600;
      const intervalMs = Math.max(950, baseWait * (1 - this.chaseTension * 0.58));
      this.musicTimer = window.setTimeout(scheduleNextNote, intervalMs);
    };
    this.musicTimer = window.setTimeout(scheduleNextNote, 700);

    // 4. Nightmare Bowed-Metal String Swells & Sudden Abyssal Dread Impacts
    const scheduleTerrorSwell = () => {
      if (!this.ctx || !this.musicGain || !this.delayNode) return;
      const now = this.ctx.currentTime;
      const roll = this.lobbyMode ? 0.9 : Math.random();

      if (roll < 0.58) {
        // Bowed-metal screech swell (rising dissonant minor-2nd cluster cutting abruptly into silence)
        const swellFilter = this.ctx.createBiquadFilter();
        swellFilter.type = 'bandpass';
        swellFilter.Q.value = 4.5;
        swellFilter.frequency.setValueAtTime(260, now);
        swellFilter.frequency.exponentialRampToValueAtTime(1450 + this.chaseTension * 650, now + 2.6);

        const swellGain = this.ctx.createGain();
        swellGain.gain.setValueAtTime(0.0001, now);
        swellGain.gain.exponentialRampToValueAtTime(0.22 + this.chaseTension * 0.14, now + 2.35);
        swellGain.gain.exponentialRampToValueAtTime(0.0005, now + 2.75); // sudden choked cutoff!

        swellFilter.connect(swellGain);
        swellGain.connect(this.musicGain);
        swellGain.connect(this.delayNode);

        const cluster = [220, 233.08, 311.13];
        for (const f of cluster) {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now);
          osc.frequency.linearRampToValueAtTime(f * 1.03, now + 2.6);
          osc.connect(swellFilter);
          osc.start(now);
          osc.stop(now + 2.8);
        }
      } else if (roll < 0.85) {
        // FM Metallic Pipe Scrape / Shriek echoing down the hallway
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const car = this.ctx.createOscillator();
        const scrapeFilter = this.ctx.createBiquadFilter();
        const scrapeGain = this.ctx.createGain();

        mod.frequency.value = 317;
        modGain.gain.value = 420;
        car.type = 'sawtooth';
        car.frequency.setValueAtTime(510 + Math.random() * 240, now);
        car.frequency.exponentialRampToValueAtTime(280, now + 1.4);

        scrapeFilter.type = 'bandpass';
        scrapeFilter.frequency.value = 1100;
        scrapeFilter.Q.value = 6;

        scrapeGain.gain.setValueAtTime(0.0001, now);
        scrapeGain.gain.linearRampToValueAtTime(0.14, now + 0.14);
        scrapeGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.5);

        mod.connect(modGain);
        modGain.connect(car.frequency);
        car.connect(scrapeFilter);
        scrapeFilter.connect(scrapeGain);
        scrapeGain.connect(this.delayNode);
        scrapeGain.connect(this.musicGain);

        mod.start(now);
        car.start(now);
        mod.stop(now + 1.55);
        car.stop(now + 1.55);
      } else {
        // Deep Abyssal Sub-Boom Impact (like something massive shifting in the dark)
        const boom = this.ctx.createOscillator();
        const boomGain = this.ctx.createGain();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(92, now);
        boom.frequency.exponentialRampToValueAtTime(24, now + 1.4);
        boomGain.gain.setValueAtTime(0.001, now);
        boomGain.gain.linearRampToValueAtTime(this.lobbyMode ? 0.28 : 0.45, now + 0.04);
        boomGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.8);
        boom.connect(boomGain);
        boomGain.connect(this.musicGain);
        boomGain.connect(this.delayNode);
        boom.start(now);
        boom.stop(now + 1.9);
      }

      const nextSwellMs = this.lobbyMode
        ? 8500 + Math.random() * 6500
        : Math.max(2600, (5800 + Math.random() * 5200) * (1 - this.chaseTension * 0.55));
      this.swellTimer = window.setTimeout(scheduleTerrorSwell, nextSwellMs);
    };

    this.swellTimer = window.setTimeout(scheduleTerrorSwell, 2400);
  }

  private startHallucinationBed(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 3.2;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.27;
    lfoGain.gain.value = 155;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this.hallucinationBedFilter = filter;
    this.hallucinationBedGain = gain;
  }

  private startStalkerWhisperBed(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1350;
    filter.Q.value = 3.8;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'triangle';
    lfo.frequency.value = 1.9;
    lfoGain.gain.value = 540;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = 0;
      gain.connect(panner);
      panner.connect(this.masterGain);
      this.stalkerWhisperBedPanner = panner;
    } else {
      gain.connect(this.masterGain);
    }

    src.start();
    this.stalkerWhisperBedFilter = filter;
    this.stalkerWhisperBedGain = gain;
  }

  public playFlashlightClick(on: boolean): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(on ? 1550 : 1100, now);
    osc.frequency.exponentialRampToValueAtTime(on ? 420 : 280, now + 0.045);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(worldOut);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public updateSpatialListener(
    px: number,
    py: number,
    pz: number,
    yaw: number,
    pitch: number,
  ): void {
    this.spatialAudio.updateListener(px, py, pz, yaw, pitch);
  }

  public playFootstepAt(
    wx: number,
    wz: number,
    sprinting: boolean,
    crouching: boolean,
  ): FloorMaterial | null {
    return this.footstepManager.playStepAtCoordinate(wx, wz, sprinting, crouching);
  }

  public getFootstepSurfaceAt(wx: number, wz: number): FloorMaterial {
    return this.footstepManager.resolveSurfaceAtCoordinate(wx, wz).material;
  }

  public getFootstepManager(): FootstepAudioManager {
    return this.footstepManager;
  }

  public playFootstep(
    sprinting: boolean,
    crouching: boolean,
    material: FloorMaterial = 'wet_carpet',
  ): void {
    this.footstepManager.playStepForMaterial(material, sprinting, crouching);
  }

  public playBodySlide(material: FloorMaterial = 'wet_carpet'): void {
    this.footstepManager.playBodySlide(material);
  }

  public playStalkerFootstep(
    wx: number,
    wz: number,
    distance: number,
    material: FloorMaterial,
    chasing: boolean,
    fallbackPan = 0,
  ): void {
    this.spatialAudio.playStalkerFootstep(wx, wz, distance, material, chasing, fallbackPan);
  }

  public playPickup(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(worldOut);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playDoorCreak(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(215, now + 0.25);
    osc.frequency.linearRampToValueAtTime(118, now + 0.58);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 4;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(worldOut);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  public playLockerDoor(action: 'open' | 'close'): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;

    const triggerLatchClick = (at: number, freq: number, vol: number) => {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = freq * jitter;
      bpf.Q.value = 4.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, at + 0.042);
      src.connect(bpf);
      bpf.connect(g);
      g.connect(worldOut);
      src.start(at, Math.random() * 0.6, 0.05);
    };

    const triggerSheetThud = (at: number, baseFreq: number, peakVol: number, dur: number) => {
      if (!this.ctx) return;
      const body = this.ctx.createOscillator();
      const lpf = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(baseFreq * jitter, at);
      body.frequency.exponentialRampToValueAtTime(30, at + dur * 0.85);
      lpf.type = 'lowpass';
      lpf.frequency.value = 340;
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(peakVol, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
      body.connect(lpf);
      lpf.connect(g);
      g.connect(worldOut);
      body.start(at);
      body.stop(at + dur + 0.02);

      // Hollow locker cabinet door resonance
      [182, 304].forEach((rf, idx) => {
        if (!this.ctx) return;
        const res = this.ctx.createOscillator();
        const rGain = this.ctx.createGain();
        res.type = 'sine';
        res.frequency.setValueAtTime(rf * jitter, at);
        res.frequency.exponentialRampToValueAtTime(rf * 0.86 * jitter, at + 0.16);
        rGain.gain.setValueAtTime(0.0008, at);
        rGain.gain.linearRampToValueAtTime(peakVol * (idx === 0 ? 0.28 : 0.15), at + 0.005);
        rGain.gain.exponentialRampToValueAtTime(0.0006, at + 0.17);
        res.connect(rGain);
        rGain.connect(worldOut);
        res.start(at);
        res.stop(at + 0.19);
      });
    };

    if (action === 'open') {
      // 1. Locker handle unlatch snap
      triggerLatchClick(now, 2450, 0.19);
      triggerLatchClick(now + 0.028, 1320, 0.14);

      // 2. Rusty steel hinge creak & door swing open (0.05s -> 0.45s)
      const creakStart = now + 0.05;
      const creakDur = 0.39;
      const hingeOsc = this.ctx.createOscillator();
      hingeOsc.type = 'sawtooth';
      hingeOsc.frequency.setValueAtTime(148 * jitter, creakStart);
      hingeOsc.frequency.linearRampToValueAtTime(218 * jitter, creakStart + 0.17);
      hingeOsc.frequency.linearRampToValueAtTime(162 * jitter, creakStart + creakDur);

      const hingeMod = this.ctx.createOscillator();
      const hingeModDepth = this.ctx.createGain();
      hingeMod.type = 'triangle';
      hingeMod.frequency.value = 27;
      hingeModDepth.gain.value = 16;
      hingeMod.connect(hingeModDepth);
      hingeModDepth.connect(hingeOsc.frequency);

      const hingeFilter = this.ctx.createBiquadFilter();
      hingeFilter.type = 'bandpass';
      hingeFilter.frequency.value = 620 * jitter;
      hingeFilter.Q.value = 3.8;

      const hingeGain = this.ctx.createGain();
      hingeGain.gain.setValueAtTime(0.0006, creakStart);
      hingeGain.gain.linearRampToValueAtTime(0.095, creakStart + 0.08);
      hingeGain.gain.linearRampToValueAtTime(0.075, creakStart + 0.26);
      hingeGain.gain.exponentialRampToValueAtTime(0.0006, creakStart + creakDur);

      hingeOsc.connect(hingeFilter);
      hingeFilter.connect(hingeGain);
      hingeGain.connect(worldOut);
      hingeMod.start(creakStart);
      hingeOsc.start(creakStart);
      hingeMod.stop(creakStart + creakDur + 0.02);
      hingeOsc.stop(creakStart + creakDur + 0.02);

      // Air whoosh as the hollow locker door swings outward
      const airSrc = this.ctx.createBufferSource();
      airSrc.buffer = this.noiseBuffer;
      const airLpf = this.ctx.createBiquadFilter();
      airLpf.type = 'lowpass';
      airLpf.frequency.value = 410;
      const airGain = this.ctx.createGain();
      airGain.gain.setValueAtTime(0.0008, creakStart);
      airGain.gain.linearRampToValueAtTime(0.075, creakStart + 0.14);
      airGain.gain.exponentialRampToValueAtTime(0.0008, creakStart + 0.36);
      airSrc.connect(airLpf);
      airLpf.connect(airGain);
      airGain.connect(worldOut);
      airSrc.start(creakStart, Math.random() * 0.5, 0.38);

      // 3. Soft locker frame settle thud as you step inside
      triggerSheetThud(now + 0.4, 96, 0.12, 0.16);
    } else {
      // 'close': quick swing + heavy hollow door slam shut + latch catch
      const swingSrc = this.ctx.createBufferSource();
      swingSrc.buffer = this.noiseBuffer;
      const swingLpf = this.ctx.createBiquadFilter();
      swingLpf.type = 'lowpass';
      swingLpf.frequency.value = 480;
      const swingGain = this.ctx.createGain();
      swingGain.gain.setValueAtTime(0.001, now);
      swingGain.gain.linearRampToValueAtTime(0.09, now + 0.06);
      swingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      swingSrc.connect(swingLpf);
      swingLpf.connect(swingGain);
      swingGain.connect(worldOut);
      swingSrc.start(now, Math.random() * 0.5, 0.16);

      // Brief hinge swing squeak before slam
      const squeak = this.ctx.createOscillator();
      const sFilt = this.ctx.createBiquadFilter();
      const sGain = this.ctx.createGain();
      squeak.type = 'sawtooth';
      squeak.frequency.setValueAtTime(220 * jitter, now + 0.015);
      squeak.frequency.linearRampToValueAtTime(165 * jitter, now + 0.12);
      sFilt.type = 'bandpass';
      sFilt.frequency.value = 640;
      sFilt.Q.value = 3.5;
      sGain.gain.setValueAtTime(0.0005, now + 0.015);
      sGain.gain.linearRampToValueAtTime(0.055, now + 0.05);
      sGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.13);
      squeak.connect(sFilt);
      sFilt.connect(sGain);
      sGain.connect(worldOut);
      squeak.start(now + 0.015);
      squeak.stop(now + 0.14);

      // Heavy door frame shut impact
      triggerSheetThud(now + 0.13, 118, 0.26, 0.21);

      // Latch catch clack
      triggerLatchClick(now + 0.155, 2100, 0.18);
      triggerLatchClick(now + 0.19, 1280, 0.14);
    }
  }

  public playLockedRattle(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    const now = this.ctx.currentTime;
    [0, 0.08].forEach((offset) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now + offset);
      osc.frequency.exponentialRampToValueAtTime(75, now + offset + 0.06);
      gain.gain.setValueAtTime(0.16, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.065);
      osc.connect(gain);
      gain.connect(worldOut);
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    });
  }

  public playMetalClank(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Heavy iron crowbar impact + damped steel ring
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(145, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    thudGain.gain.setValueAtTime(0.24, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    thud.connect(thudGain);
    thudGain.connect(worldOut);
    thud.start(now);
    thud.stop(now + 0.26);

    [312, 548].forEach((freq, idx) => {
      if (!this.ctx) return;
      const ring = this.ctx.createOscillator();
      const rGain = this.ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(freq, now);
      rGain.gain.setValueAtTime(idx === 0 ? 0.14 : 0.09, now);
      rGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
      ring.connect(rGain);
      rGain.connect(worldOut);
      ring.start(now);
      ring.stop(now + 0.3);
    });

    const scrape = this.ctx.createBufferSource();
    scrape.buffer = this.noiseBuffer;
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1850;
    bpf.Q.value = 2.6;
    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.18, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    scrape.connect(bpf);
    bpf.connect(sGain);
    sGain.connect(worldOut);
    scrape.start(now, 0.1, 0.16);
  }

  public playElectricalSurge(): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.85);
    filter.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(worldOut);
    src.start(now, 0, 0.95);
  }

  public playHorrorEvent(kind: 'slam' | 'footsteps_behind' | 'static' | 'flicker'): void {
    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    if (kind === 'slam') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.45);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(worldOut);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (kind === 'footsteps_behind') {
      [0, 0.36, 0.72].forEach((offset) => {
        if (!this.ctx || !this.noiseBuffer) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 260;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.16, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(worldOut);
        src.start(now + offset, 0.2, 0.15);
      });
    } else if (kind === 'static') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2100;
      filter.Q.value = 1.8;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(worldOut);
      src.start(now, 0.4, 0.58);
    } else if (kind === 'flicker') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 120;
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(worldOut);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  }

  public playLightFlickerZap(proximity: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const nowMs = performance.now();
    const minInterval = Math.max(190, 520 - proximity * 320);
    if (nowMs - this.lastFlickerZapTime < minInterval) return;
    this.lastFlickerZapTime = nowMs;

    const worldOut = this.getWorldOutput();
    if (!this.ctx || !worldOut) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120 + Math.random() * 40, now);
    gain.gain.setValueAtTime(0.025 + proximity * 0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.09);
    osc.connect(gain);
    gain.connect(worldOut);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public updateSanityAudio(sanity: number, inDarkness: boolean, activeGameplay: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (!activeGameplay) {
      if (this.sanityMuffleFilter) {
        this.sanityMuffleFilter.frequency.setTargetAtTime(20000, now, 0.25);
        this.sanityMuffleFilter.Q.setTargetAtTime(0.7, now, 0.25);
      }
      if (this.hallucinationBedGain) {
        this.hallucinationBedGain.gain.setTargetAtTime(0.0001, now, 0.25);
      }
      return;
    }

    const loss = Math.max(0, Math.min(1, (82 - sanity) / 82));
    // Progressively muffle world audio (music, footsteps, fluorescent hum) as sanity drops
    if (this.sanityMuffleFilter) {
      const muffleCurve = Math.pow(loss, 1.15);
      const targetCutoff = 20000 * Math.pow(420 / 20000, muffleCurve);
      this.sanityMuffleFilter.frequency.setTargetAtTime(targetCutoff, now, 0.3);
      this.sanityMuffleFilter.Q.setTargetAtTime(0.7 + loss * 0.95, now, 0.3);
    }

    // Subtle inner-ear pressure / muffled static bed rises in darkness as sanity slips
    if (this.hallucinationBedGain && this.hallucinationBedFilter) {
      const bedLevel =
        loss > 0.15 ? (loss - 0.15) * (inDarkness ? 0.095 : 0.055) : 0.0001;
      this.hallucinationBedGain.gain.setTargetAtTime(bedLevel, now, 0.45);
      this.hallucinationBedFilter.frequency.setTargetAtTime(280 + loss * 340, now, 0.45);
    }

    // Periodic auditory hallucinations: whispers & muffled phantom noises when in darkness / low sanity
    if (sanity < 82 || (inDarkness && sanity < 90)) {
      const nowMs = performance.now();
      if (nowMs - this.lastSanityHallucinationTime > this.nextHallucinationCooldown) {
        this.lastSanityHallucinationTime = nowMs;
        const baseWait = Math.max(3600, 13200 - loss * 9200 - (inDarkness ? 1400 : 0));
        this.nextHallucinationCooldown = baseWait * (0.78 + Math.random() * 0.44);

        const roll = Math.random();
        const kind: 'whisper' | 'muffled_voices' | 'phantom_steps' | 'phantom_knocks' =
          roll < 0.46
            ? 'whisper'
            : roll < 0.68
              ? 'muffled_voices'
              : roll < 0.86
                ? 'phantom_steps'
                : 'phantom_knocks';
        this.playSanityHallucination(kind, 0.45 + loss * 0.55);
      }
    }
  }

  public playSanityHallucination(
    kind: 'whisper' | 'muffled_voices' | 'phantom_steps' | 'phantom_knocks',
    intensity = 0.7,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.25, Math.min(1, intensity));

    // Alternate left/right ear panning so whispers feel right behind the player's shoulder
    this.lastWhisperSide = -this.lastWhisperSide;
    const pan = this.lastWhisperSide * (0.52 + Math.random() * 0.36);

    const outBus = this.ctx.createGain();
    outBus.gain.value = clamped;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      outBus.connect(panner);
      panner.connect(this.masterGain);
    } else {
      outBus.connect(this.masterGain);
    }

    if (kind === 'whisper') {
      // Multi-syllable sibilant breathy whisper ("sshh... khh... behind...")
      const syllableCount = 2 + Math.floor(Math.random() * 3);
      let cursor = 0;
      for (let i = 0; i < syllableCount; i++) {
        const dur = 0.16 + Math.random() * 0.22;
        const gap = 0.08 + Math.random() * 0.14;
        const startAt = now + cursor;

        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        // Dual vocal formant bandpass filters for uncanny human whisper timbre
        const f1 = this.ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.setValueAtTime(640 + Math.random() * 240, startAt);
        f1.frequency.linearRampToValueAtTime(420 + Math.random() * 140, startAt + dur);
        f1.Q.value = 6.2;

        const f2 = this.ctx.createBiquadFilter();
        f2.type = 'bandpass';
        f2.frequency.setValueAtTime(1900 + Math.random() * 750, startAt);
        f2.frequency.linearRampToValueAtTime(1450 + Math.random() * 480, startAt + dur);
        f2.Q.value = 5.4;

        const sGain = this.ctx.createGain();
        sGain.gain.setValueAtTime(0.0005, startAt);
        sGain.gain.linearRampToValueAtTime(0.18 + clamped * 0.14, startAt + dur * 0.35);
        sGain.gain.exponentialRampToValueAtTime(0.0006, startAt + dur);

        src.connect(f1);
        src.connect(f2);
        f1.connect(sGain);
        f2.connect(sGain);
        sGain.connect(outBus);
        src.start(startAt, Math.random() * 0.9, dur + 0.04);

        // Very faint breathy vocal pitch contour underneath the sibilance
        const vocal = this.ctx.createOscillator();
        const vGain = this.ctx.createGain();
        vocal.type = 'triangle';
        vocal.frequency.setValueAtTime(155 + Math.random() * 35, startAt);
        vocal.frequency.linearRampToValueAtTime(118 + Math.random() * 20, startAt + dur);
        vGain.gain.setValueAtTime(0.0004, startAt);
        vGain.gain.linearRampToValueAtTime(0.032 * clamped, startAt + dur * 0.3);
        vGain.gain.exponentialRampToValueAtTime(0.0004, startAt + dur);
        vocal.connect(vGain);
        vGain.connect(outBus);
        vocal.start(startAt);
        vocal.stop(startAt + dur + 0.02);

        cursor += dur + gap;
      }
    } else if (kind === 'muffled_voices') {
      // Heavily muffled distant murmurs as if heard through thick Backrooms drywall
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 390;
      lpf.Q.value = 2.1;
      lpf.connect(outBus);

      const dur = 1.45;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(240, now);
      formant.frequency.linearRampToValueAtTime(410, now + 0.45);
      formant.frequency.linearRampToValueAtTime(210, now + 1.0);
      formant.frequency.linearRampToValueAtTime(340, now + dur);
      formant.Q.value = 4.5;

      const mGain = this.ctx.createGain();
      mGain.gain.setValueAtTime(0.0005, now);
      mGain.gain.linearRampToValueAtTime(0.24, now + 0.35);
      mGain.gain.linearRampToValueAtTime(0.14, now + 0.85);
      mGain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

      noise.connect(formant);
      formant.connect(mGain);
      mGain.connect(lpf);
      noise.start(now, Math.random() * 0.4, dur + 0.05);

      const hum = this.ctx.createOscillator();
      const hGain = this.ctx.createGain();
      hum.type = 'sawtooth';
      hum.frequency.setValueAtTime(118, now);
      hum.frequency.linearRampToValueAtTime(142, now + 0.6);
      hum.frequency.linearRampToValueAtTime(98, now + dur);
      hGain.gain.setValueAtTime(0.0004, now);
      hGain.gain.linearRampToValueAtTime(0.06, now + 0.4);
      hGain.gain.exponentialRampToValueAtTime(0.0005, now + dur);
      hum.connect(hGain);
      hGain.connect(lpf);
      hum.start(now);
      hum.stop(now + dur + 0.04);
    } else if (kind === 'phantom_steps') {
      // Muffled creeping footsteps right behind the player
      const count = 3 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const at = now + i * (0.34 + Math.random() * 0.08);
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 285;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.16 * (0.7 + i * 0.12), at);
        g.gain.exponentialRampToValueAtTime(0.0008, at + 0.14);
        src.connect(lpf);
        lpf.connect(g);
        g.connect(outBus);
        src.start(at, Math.random() * 0.5, 0.16);
      }
    } else {
      // Hollow muffled wall knocks in the dark
      [0, 0.24, 0.48].forEach((offset, idx) => {
        if (!this.ctx) return;
        const at = now + offset;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145 - idx * 14, at);
        osc.frequency.exponentialRampToValueAtTime(48, at + 0.11);
        g.gain.setValueAtTime(0.22 * (1 - idx * 0.14), at);
        g.gain.exponentialRampToValueAtTime(0.0008, at + 0.12);
        osc.connect(g);
        g.connect(outBus);
        osc.start(at);
        osc.stop(at + 0.13);
      });
    }
  }

  public tickMonsterProximity(
    distance: number,
    chasing: boolean,
    pan = 0,
    state: StalkerBehaviorState = 'patrol',
    panic = 0,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const nowMs = performance.now();
    const effectivePanic = Math.max(panic, chasing ? 0.82 : 0);

    // Horrifying curated horror SFX cues when the ghost is near (<= 16.5m)
    if (distance <= 16.5) {
      const intense = chasing || state === 'stalk' || distance < 8.5;
      this.playGhostProximitySfx(intense ? 'intense' : 'near', distance, pan, false);
    }

    // Chaotic indecipherable stalker whispers within 15 units (louder & denser as stalker approaches)
    this.updateStalkerProximityWhispers(distance, chasing, pan, state, true);

    // Spatialized eerie / panicked breathing when monster is within 18m or panic is elevated
    const breathInterval = Math.max(760, 1850 - effectivePanic * 1050);
    if ((distance < 18 || effectivePanic > 0.18) && nowMs - this.lastBreathingTime > breathInterval) {
      this.lastBreathingTime = nowMs;
      const proximity = Math.max(0.05, Math.max(1 - distance / 18, effectivePanic * 0.75));
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(420 + effectivePanic * 160, now);
      filter.frequency.linearRampToValueAtTime(240 + effectivePanic * 80, now + 0.6);
      filter.Q.value = 3.5;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(proximity * 0.22, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.getWorldOutput() ?? this.masterGain);
      src.start(now, 0.1, 0.72);
    }

    // Panic Heartbeat: accelerates continuously from slow dread (~62 BPM) to frantic (~174 BPM)
    if (distance < 13.5 || effectivePanic > 0.08 || chasing) {
      const interval = Math.max(345, Math.round(960 - effectivePanic * 600));
      if (nowMs - this.lastHeartbeatTime > interval) {
        this.lastHeartbeatTime = nowMs;
        const now = this.ctx.currentTime;
        const intensity = Math.max(0.05, Math.min(0.42, 0.06 + effectivePanic * 0.34));
        const lubDubGap = 0.16 - effectivePanic * 0.045;
        const baseFreq = 58 + effectivePanic * 18;

        [0, lubDubGap].forEach((offset, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? baseFreq : baseFreq * 0.82, now + offset);
          osc.frequency.exponentialRampToValueAtTime(26, now + offset + 0.12);
          gain.gain.setValueAtTime(intensity * (idx === 0 ? 1 : 0.72), now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now + offset);
          osc.stop(now + offset + 0.14);
        });
      }
    }
  }

  public updateStalkerProximityWhispers(
    distance: number,
    chasing: boolean,
    pan = 0,
    state: StalkerBehaviorState = 'patrol',
    activeGameplay = true,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    if (!activeGameplay || distance > 15) {
      if (this.stalkerWhisperBedGain) {
        this.stalkerWhisperBedGain.gain.setTargetAtTime(0.0001, now, 0.25);
      }
      return;
    }

    const closeness = Math.max(0, Math.min(1, (15 - distance) / 15));
    const chaos = Math.max(
      0,
      Math.min(1, closeness * 0.85 + (chasing ? 0.32 : state === 'stalk' ? 0.16 : 0)),
    );

    if (this.stalkerWhisperBedGain && this.stalkerWhisperBedFilter) {
      const bedGain = 0.008 + Math.pow(chaos, 1.35) * 0.12;
      this.stalkerWhisperBedGain.gain.setTargetAtTime(bedGain, now, 0.18);
      this.stalkerWhisperBedFilter.frequency.setTargetAtTime(980 + chaos * 1150, now, 0.18);
      this.stalkerWhisperBedFilter.Q.setTargetAtTime(3.2 + chaos * 2.8, now, 0.2);
    }
    if (this.stalkerWhisperBedPanner) {
      const jitterPan = pan + Math.sin(now * (4 + chaos * 9)) * (0.18 + chaos * 0.42);
      this.stalkerWhisperBedPanner.pan.setTargetAtTime(
        Math.max(-0.95, Math.min(0.95, jitterPan)),
        now,
        0.1,
      );
    }

    const nowMs = performance.now();
    if (nowMs - this.lastChaoticWhisperTime >= this.nextChaoticWhisperCooldown) {
      this.lastChaoticWhisperTime = nowMs;
      const baseInterval = Math.max(320, 2150 - chaos * 1750);
      this.nextChaoticWhisperCooldown = baseInterval * (0.68 + Math.random() * 0.56);

      // Faint single muttering at 14-15u; 2-4 overlapping chaotic voices as stalker closes in
      const voiceCount = chaos > 0.65 ? 3 : chaos > 0.3 ? 2 : 1;
      for (let v = 0; v < voiceCount; v++) {
        this.spawnChaoticWhisperVoice(closeness, chaos, pan, v * (0.06 + Math.random() * 0.1));
      }
    }
  }

  private spawnChaoticWhisperVoice(
    closeness: number,
    chaos: number,
    basePan: number,
    delayOffset: number,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const startBase = this.ctx.currentTime + delayOffset;

    // Swirl voices progressively wider across stereo field as chaos climbs
    const panScatter = (Math.random() * 2 - 1) * (0.25 + chaos * 0.72);
    const voicePan = Math.max(-0.96, Math.min(0.96, basePan * (1 - chaos * 0.55) + panScatter));

    const voiceGain = this.ctx.createGain();
    const volScale = 0.06 + Math.pow(closeness, 1.15) * 0.28;
    voiceGain.gain.value = volScale;

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(voicePan, startBase);
      panner.pan.linearRampToValueAtTime(
        Math.max(-0.96, Math.min(0.96, voicePan + (Math.random() - 0.5) * 0.7 * chaos)),
        startBase + 0.55,
      );
      voiceGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      voiceGain.connect(this.masterGain);
    }

    const syllables = 2 + Math.floor(Math.random() * (2 + chaos * 3));
    let cursor = 0;
    for (let i = 0; i < syllables; i++) {
      const dur = 0.085 + Math.random() * (0.16 - chaos * 0.05);
      const gap = 0.025 + Math.random() * (0.1 - chaos * 0.05);
      const t0 = startBase + cursor;

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(420 + Math.random() * 520, t0);
      f1.frequency.linearRampToValueAtTime(280 + Math.random() * 440, t0 + dur);
      f1.Q.value = 5.0 + chaos * 3.8;

      const f2 = this.ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(1650 + Math.random() * 1750, t0);
      f2.frequency.linearRampToValueAtTime(1250 + Math.random() * 1450, t0 + dur);
      f2.Q.value = 4.2 + chaos * 3.5;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0006, t0);
      env.gain.linearRampToValueAtTime(0.45 + Math.random() * 0.35, t0 + dur * 0.35);
      env.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);

      src.connect(f1);
      src.connect(f2);
      f1.connect(env);
      f2.connect(env);
      env.connect(voiceGain);
      src.start(t0, Math.random() * 0.9, dur + 0.03);

      // Faint unnerving gravelly pitch undertone on close chaotic whispers
      if (chaos > 0.28 && Math.random() < 0.65) {
        const osc = this.ctx.createOscillator();
        const oGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(92 + Math.random() * 95, t0);
        osc.frequency.linearRampToValueAtTime(74 + Math.random() * 75, t0 + dur);
        oGain.gain.setValueAtTime(0.0005, t0);
        oGain.gain.linearRampToValueAtTime(0.08 * chaos, t0 + dur * 0.3);
        oGain.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
        osc.connect(oGain);
        oGain.connect(f1);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      }

      cursor += dur + gap;
    }
  }

  /**
   * Sculpted formant-whisper phrase: "I... SEE... YOU..."
   * Pan-spatialized toward the stalker with eerie corridor echo.
   */
  public playISeeYouWhisper(closeness: number, pan = 0): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.25, Math.min(1, closeness));

    const phraseBus = this.ctx.createGain();
    phraseBus.gain.value = 0.34 + clamped * 0.44;

    // Eerie corridor echo on the whispered voice
    const echo = this.ctx.createDelay(1.0);
    echo.delayTime.value = 0.21;
    const echoFb = this.ctx.createGain();
    echoFb.gain.value = 0.32;
    const echoLpf = this.ctx.createBiquadFilter();
    echoLpf.type = 'lowpass';
    echoLpf.frequency.value = 1400;
    echo.connect(echoLpf);
    echoLpf.connect(echoFb);
    echoFb.connect(echo);

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.88, Math.min(0.88, pan));
      phraseBus.connect(panner);
      phraseBus.connect(echo);
      echoLpf.connect(panner);
      panner.connect(this.masterGain);
    } else {
      phraseBus.connect(this.masterGain);
      phraseBus.connect(echo);
      echoLpf.connect(this.masterGain);
    }

    const scheduleWhisperSyllable = (
      offset: number,
      dur: number,
      f1Start: number,
      f1End: number,
      f2Start: number,
      f2End: number,
      hasSibilance: boolean,
      subFreqStart: number,
      subFreqEnd: number,
    ) => {
      if (!this.ctx || !this.noiseBuffer) return;
      const t0 = now + offset;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(f1Start, t0);
      f1.frequency.linearRampToValueAtTime(f1End, t0 + dur);
      f1.Q.value = 6.5;

      const f2 = this.ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(f2Start, t0);
      f2.frequency.linearRampToValueAtTime(f2End, t0 + dur);
      f2.Q.value = 7.4;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.0005, t0);
      nGain.gain.linearRampToValueAtTime(0.42, t0 + dur * 0.25);
      nGain.gain.setValueAtTime(0.38, t0 + dur * 0.68);
      nGain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

      src.connect(f1);
      src.connect(f2);
      f1.connect(nGain);
      f2.connect(nGain);
      nGain.connect(phraseBus);
      src.start(t0, Math.random() * 0.6, dur + 0.04);

      if (hasSibilance) {
        const sSrc = this.ctx.createBufferSource();
        sSrc.buffer = this.noiseBuffer;
        const sFilter = this.ctx.createBiquadFilter();
        sFilter.type = 'bandpass';
        sFilter.frequency.value = 4350;
        sFilter.Q.value = 3.8;
        const sGain = this.ctx.createGain();
        sGain.gain.setValueAtTime(0.0005, t0);
        sGain.gain.linearRampToValueAtTime(0.28, t0 + 0.04);
        sGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.19);
        sSrc.connect(sFilter);
        sFilter.connect(sGain);
        sGain.connect(phraseBus);
        sSrc.start(t0, Math.random() * 0.5, 0.21);
      }

      // Low raspy sub-vocal fry giving haunting ghostly presence
      const fry = this.ctx.createOscillator();
      const fryGain = this.ctx.createGain();
      fry.type = 'sawtooth';
      fry.frequency.setValueAtTime(subFreqStart, t0);
      fry.frequency.linearRampToValueAtTime(subFreqEnd, t0 + dur);
      fryGain.gain.setValueAtTime(0.0004, t0);
      fryGain.gain.linearRampToValueAtTime(0.11, t0 + dur * 0.28);
      fryGain.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
      fry.connect(fryGain);
      fryGain.connect(f1);
      fry.start(t0);
      fry.stop(t0 + dur + 0.02);
    };

    // "I..." -> "SEE..." -> "YOU..."
    scheduleWhisperSyllable(0.0, 0.27, 740, 360, 1120, 2120, false, 110, 96);
    scheduleWhisperSyllable(0.36, 0.44, 290, 270, 2320, 2180, true, 98, 106);
    scheduleWhisperSyllable(0.92, 0.58, 320, 240, 1980, 740, false, 102, 76);
  }

  /**
   * Dynamic heavy-breathing audio layer driven by low stamina and sustained running.
   * Escalates continuously from steady rhythmic breaths into ragged panting as fatigue rises.
   */
  public updateExertionBreathing(
    stamina: number,
    sprintDuration: number,
    isSprinting: boolean,
    activeGameplay: boolean,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    if (!activeGameplay) {
      this.smoothedExertion = 0;
      return;
    }

    const staminaLoss = Math.max(0, Math.min(1, (78 - stamina) / 78));
    const sustainedRun = Math.max(0, Math.min(1, (sprintDuration - 1.2) / 4.2));
    const sprintBoost = isSprinting ? 0.14 : 0;
    const targetExertion = Math.max(
      0,
      Math.min(1, Math.max(staminaLoss, sustainedRun * 0.88) + sprintBoost * Math.max(staminaLoss, sustainedRun > 0.02 ? 0.7 : 0)),
    );

    // Smooth climb and natural recovery lag so heavy breathing lingers while catching breath
    const alpha = targetExertion > this.smoothedExertion ? 0.18 : 0.06;
    this.smoothedExertion += (targetExertion - this.smoothedExertion) * alpha;

    if (this.smoothedExertion < 0.06) return;

    const nowMs = performance.now();
    if (nowMs - this.lastPlayerBreathTime < this.nextPlayerBreathCooldown) return;

    this.lastPlayerBreathTime = nowMs;
    const cycleMs = Math.max(590, Math.round(1480 - this.smoothedExertion * 870));
    this.nextPlayerBreathCooldown = cycleMs * (0.94 + Math.random() * 0.12);
    this.playPlayerBreathCycle(this.smoothedExertion, cycleMs / 1000);
  }

  private playPlayerBreathCycle(intensity: number, cycleSec: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.06, Math.min(1, intensity));
    const pitchVar = 0.94 + Math.random() * 0.12;

    const inhaleDur = Math.min(0.36, Math.max(0.18, cycleSec * 0.36));
    const pauseGap = Math.max(0.03, cycleSec * 0.06);
    const exhaleStart = now + inhaleDur + pauseGap;
    const exhaleDur = Math.min(0.56, Math.max(0.24, cycleSec * 0.48));

    // 1. Inhale: crisp nasal/chest intake + light upper-air turbulence
    {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const chestBand = this.ctx.createBiquadFilter();
      chestBand.type = 'bandpass';
      chestBand.frequency.setValueAtTime(520 * pitchVar, now);
      chestBand.frequency.linearRampToValueAtTime((780 + clamped * 240) * pitchVar, now + inhaleDur);
      chestBand.Q.value = 2.6;

      const airBand = this.ctx.createBiquadFilter();
      airBand.type = 'bandpass';
      airBand.frequency.setValueAtTime(1750 * pitchVar, now);
      airBand.frequency.linearRampToValueAtTime((2250 + clamped * 450) * pitchVar, now + inhaleDur);
      airBand.Q.value = 3.1;

      const peak = 0.032 + Math.pow(clamped, 1.15) * 0.16;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(peak, now + inhaleDur * 0.48);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + inhaleDur);

      src.connect(chestBand);
      src.connect(airBand);
      chestBand.connect(gain);
      airBand.connect(gain);
      gain.connect(this.masterGain);
      src.start(now, Math.random() * 0.7, inhaleDur + 0.04);
    }

    // 2. Exhale: heavier throat/lung release + subtle strained vocal-chord rasp when exhausted
    {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const exhaleFilter = this.ctx.createBiquadFilter();
      exhaleFilter.type = 'bandpass';
      exhaleFilter.frequency.setValueAtTime((560 + clamped * 160) * pitchVar, exhaleStart);
      exhaleFilter.frequency.exponentialRampToValueAtTime((250 + clamped * 60) * pitchVar, exhaleStart + exhaleDur);
      exhaleFilter.Q.value = 2.1;

      const peak = 0.045 + Math.pow(clamped, 1.1) * 0.21;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0005, exhaleStart);
      gain.gain.linearRampToValueAtTime(peak, exhaleStart + exhaleDur * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0008, exhaleStart + exhaleDur);

      src.connect(exhaleFilter);
      exhaleFilter.connect(gain);
      gain.connect(this.masterGain);
      src.start(exhaleStart, Math.random() * 0.7, exhaleDur + 0.05);

      if (clamped > 0.35) {
        // Subtle exhausted vocal sigh underneath the exhale
        const sigh = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        sigh.type = 'triangle';
        sigh.frequency.setValueAtTime((132 + clamped * 28) * pitchVar, exhaleStart);
        sigh.frequency.exponentialRampToValueAtTime(84 * pitchVar, exhaleStart + exhaleDur);
        sGain.gain.setValueAtTime(0.0004, exhaleStart);
        sGain.gain.linearRampToValueAtTime((clamped - 0.35) * 0.042, exhaleStart + exhaleDur * 0.2);
        sGain.gain.exponentialRampToValueAtTime(0.0004, exhaleStart + exhaleDur);
        sigh.connect(sGain);
        sGain.connect(this.masterGain);
        sigh.start(exhaleStart);
        sigh.stop(exhaleStart + exhaleDur + 0.03);
      }
    }
  }

  public playCaughtScare(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Layer one of the sharp horror wail/slam clips from the uploaded SFX pack
    const scareClip = INTENSE_GHOST_CLIPS[Math.random() < 0.5 ? 0 : 3];
    this.playClipSlice(scareClip, 1.0, 0, true);

    // Low impact boom
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(140, now);
    boom.frequency.exponentialRampToValueAtTime(24, now + 0.9);
    boomGain.gain.setValueAtTime(0.55, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 1.0);

    // Dissonant sting + static burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.8;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.42, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now, 0, 0.9);
  }

  /**
   * 3-Beat Fatal Eye-Crush Cutscene Audio:
   * 0.00s: Grab screech & impact sting
   * 1.02s: Ghost hands clamp & crush the eyes (wet bone snap + sub-slam + ear-ringing)
   * 1.32s-2.75s: Red blood-water surges & submerges the screen/ears
   */
  public playFatalEyeCrushCutscene(): void {
    this.playCaughtScare();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Beat 2 (t + 1.02s): Visceral Eye-Crush Impact + Bone Crunch + Ear-Ringing
    const crushAt = now + 1.02;

    // Heavy low-end slam
    const slam = this.ctx.createOscillator();
    const slamGain = this.ctx.createGain();
    slam.type = 'sine';
    slam.frequency.setValueAtTime(118, crushAt);
    slam.frequency.exponentialRampToValueAtTime(22, crushAt + 0.55);
    slamGain.gain.setValueAtTime(0.001, crushAt);
    slamGain.gain.linearRampToValueAtTime(0.62, crushAt + 0.02);
    slamGain.gain.exponentialRampToValueAtTime(0.0008, crushAt + 0.65);
    slam.connect(slamGain);
    slamGain.connect(this.masterGain);
    slam.start(crushAt);
    slam.stop(crushAt + 0.7);

    // Multi-layered wet crunch impulses
    [0, 0.055, 0.12].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
      const t0 = crushAt + offset;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(1150 - idx * 240, t0);
      bpf.frequency.exponentialRampToValueAtTime(280, t0 + 0.16);
      bpf.Q.value = 3.2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.42 - idx * 0.08, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.18);

      src.connect(bpf);
      bpf.connect(g);
      g.connect(this.masterGain);
      src.start(t0, Math.random() * 0.5, 0.2);

      // Sharp bone/socket snap oscillator
      const snap = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(520 - idx * 110, t0);
      snap.frequency.exponentialRampToValueAtTime(68, t0 + 0.09);
      sGain.gain.setValueAtTime(0.2, t0);
      sGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.1);
      snap.connect(sGain);
      sGain.connect(this.masterGain);
      snap.start(t0);
      snap.stop(t0 + 0.11);
    });

    // Piercing trauma ear-ringing after eyes are crushed
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3320, crushAt + 0.03);
    ring.frequency.linearRampToValueAtTime(2980, crushAt + 1.68);
    ringGain.gain.setValueAtTime(0.0004, crushAt);
    ringGain.gain.linearRampToValueAtTime(0.085, crushAt + 0.08);
    ringGain.gain.exponentialRampToValueAtTime(0.0005, crushAt + 1.7);
    ring.connect(ringGain);
    ringGain.connect(this.masterGain);
    ring.start(crushAt);
    ring.stop(crushAt + 1.72);

    // Beat 3 (t + 1.28s -> 2.75s): Rising Red Blood-Water Submersion
    const floodAt = now + 1.28;
    const floodDur = 1.5;
    const floodSrc = this.ctx.createBufferSource();
    floodSrc.buffer = this.noiseBuffer;

    const floodFilter = this.ctx.createBiquadFilter();
    floodFilter.type = 'bandpass';
    floodFilter.frequency.setValueAtTime(860, floodAt);
    floodFilter.frequency.exponentialRampToValueAtTime(165, floodAt + floodDur);
    floodFilter.Q.value = 3.8;

    const sloshLfo = this.ctx.createOscillator();
    const sloshDepth = this.ctx.createGain();
    sloshLfo.type = 'sine';
    sloshLfo.frequency.value = 3.6;
    sloshDepth.gain.value = 140;
    sloshLfo.connect(sloshDepth);
    sloshDepth.connect(floodFilter.frequency);

    const floodGain = this.ctx.createGain();
    floodGain.gain.setValueAtTime(0.0008, floodAt);
    floodGain.gain.linearRampToValueAtTime(0.28, floodAt + 0.38);
    floodGain.gain.setValueAtTime(0.26, floodAt + floodDur - 0.35);
    floodGain.gain.exponentialRampToValueAtTime(0.001, floodAt + floodDur);

    floodSrc.connect(floodFilter);
    floodFilter.connect(floodGain);
    floodGain.connect(this.masterGain);

    sloshLfo.start(floodAt);
    floodSrc.start(floodAt, 0.15, floodDur + 0.05);
    sloshLfo.stop(floodAt + floodDur + 0.05);
  }

  public dispose(): void {
    if (this.lobbyCueTimer !== null) {
      clearTimeout(this.lobbyCueTimer);
      this.lobbyCueTimer = null;
    }
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.swellTimer !== null) {
      clearTimeout(this.swellTimer);
      this.swellTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.isStarted = false;
    this.lobbyMode = false;
  }
}
