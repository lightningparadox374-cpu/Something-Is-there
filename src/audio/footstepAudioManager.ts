import { FloorMaterial, getFloorMaterialAtCell, worldToCell } from '../game/mapData';

export interface FootstepSoundProfile {
  material: FloorMaterial;
  label: string;
  baseGain: number;
  sprintMultiplier: number;
  crouchMultiplier: number;
  reverbSend: number;
  creakProbability: number;
  noiseAlertScale: number;
}

export const SURFACE_SOUND_PROFILES: Record<FloorMaterial, FootstepSoundProfile> = {
  wet_carpet: {
    material: 'wet_carpet',
    label: 'Wet Carpet',
    baseGain: 0.14,
    sprintMultiplier: 1.65,
    crouchMultiplier: 0.38,
    reverbSend: 0.0,
    creakProbability: 0.0,
    noiseAlertScale: 0.85,
  },
  concrete: {
    material: 'concrete',
    label: 'Concrete',
    baseGain: 0.155,
    sprintMultiplier: 1.65,
    crouchMultiplier: 0.38,
    reverbSend: 0.44,
    creakProbability: 0.0,
    noiseAlertScale: 1.22,
  },
  squeaky_wood: {
    material: 'squeaky_wood',
    label: 'Squeaky Wood',
    baseGain: 0.155,
    sprintMultiplier: 1.62,
    crouchMultiplier: 0.42,
    reverbSend: 0.22,
    creakProbability: 0.78,
    noiseAlertScale: 1.18,
  },
  metal: {
    material: 'metal',
    label: 'Steel Grate',
    baseGain: 0.16,
    sprintMultiplier: 1.62,
    crouchMultiplier: 0.38,
    reverbSend: 0.48,
    creakProbability: 0.0,
    noiseAlertScale: 1.25,
  },
};

export interface ResolvedSurfaceInfo {
  material: FloorMaterial;
  gx: number;
  gz: number;
  profile: FootstepSoundProfile;
}

/**
 * FootstepAudioManager
 * Dynamically inspects the player's current (wx, wz) world coordinate in the
 * Backrooms maze, maps it to a floor material profile (wet_carpet, concrete,
 * squeaky_wood, or metal), and synthesizes realistic two-stage human walking
 * footsteps (heel strike + sole roll / toe push-off + subtle cloth gait swish)
 * as well as abrasive human-body floor-scratching slide SFX.
 */
export class FootstepAudioManager {
  private ctx: AudioContext | null = null;
  private outputBus: AudioNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private slapbackBus: GainNode | null = null;

  private lastStepMs = 0;
  private footParity: -1 | 1 = 1;
  private lastSurface: FloorMaterial = 'wet_carpet';
  private lastCellKey = '';

  public attach(ctx: AudioContext, outputBus: AudioNode, noiseBuffer: AudioBuffer): void {
    this.ctx = ctx;
    this.outputBus = outputBus;
    this.noiseBuffer = noiseBuffer;

    // Short corridor slapback reflection bus for hard surfaces
    const tap1 = ctx.createDelay(0.5);
    tap1.delayTime.value = 0.078;
    const tap2 = ctx.createDelay(0.5);
    tap2.delayTime.value = 0.168;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.2;

    const damp = ctx.createBiquadFilter();
    damp.type = 'bandpass';
    damp.frequency.value = 960;
    damp.Q.value = 0.85;

    const send = ctx.createGain();
    send.gain.value = 1.0;

    send.connect(tap1);
    tap1.connect(damp);
    damp.connect(tap2);
    tap2.connect(feedback);
    feedback.connect(tap1);
    damp.connect(outputBus);
    tap2.connect(outputBus);

    this.slapbackBus = send;
  }

  public resolveSurfaceAtCoordinate(wx: number, wz: number): ResolvedSurfaceInfo {
    const { gx, gz } = worldToCell(wx, wz);
    const material = getFloorMaterialAtCell(gx, gz);
    return {
      material,
      gx,
      gz,
      profile: SURFACE_SOUND_PROFILES[material],
    };
  }

  public getLastSurface(): FloorMaterial {
    return this.lastSurface;
  }

  public getSurfaceProfile(material: FloorMaterial): FootstepSoundProfile {
    return SURFACE_SOUND_PROFILES[material];
  }

  /**
   * Resolves the floor surface directly from the player's current (wx, wz) maze
   * coordinate and triggers the matching human walking footstep on cadence.
   */
  public playStepAtCoordinate(
    wx: number,
    wz: number,
    sprinting: boolean,
    crouching: boolean,
  ): FloorMaterial | null {
    const { material, gx, gz } = this.resolveSurfaceAtCoordinate(wx, wz);
    return this.playStepForMaterial(material, sprinting, crouching, gx, gz);
  }

  public playStepForMaterial(
    material: FloorMaterial,
    sprinting: boolean,
    crouching: boolean,
    gx?: number,
    gz?: number,
  ): FloorMaterial | null {
    if (!this.ctx || !this.outputBus || !this.noiseBuffer) return null;

    const nowMs = performance.now();
    const interval = sprinting ? 295 : crouching ? 635 : 465;
    if (nowMs - this.lastStepMs < interval) return null;
    this.lastStepMs = nowMs;

    this.lastSurface = material;
    if (gx !== undefined && gz !== undefined) {
      this.lastCellKey = `${gx},${gz}`;
    }

    // Left/right stride alternation with subtle gait asymmetry
    this.footParity = this.footParity === 1 ? -1 : 1;
    const pan = this.footParity * (sprinting ? 0.14 : 0.1);
    const now = this.ctx.currentTime;
    const gaitScale = this.footParity > 0 ? 1.0 : 0.94;
    const pitchJitter = (0.94 + Math.random() * 0.12) * gaitScale;
    const rollDelay = sprinting ? 0.048 : crouching ? 0.115 : 0.078;

    const stepBus = this.ctx.createGain();
    stepBus.gain.value = 1.0;

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      stepBus.connect(panner);
      panner.connect(this.outputBus);
    } else {
      stepBus.connect(this.outputBus);
    }

    const profile = SURFACE_SOUND_PROFILES[material];
    const volume =
      profile.baseGain *
      (sprinting
        ? profile.sprintMultiplier
        : crouching
          ? profile.crouchMultiplier
          : 1.0);

    if (profile.reverbSend > 0 && this.slapbackBus && !crouching) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = profile.reverbSend * (sprinting ? 1.15 : 0.8);
      stepBus.connect(sendGain);
      sendGain.connect(this.slapbackBus);
    }

    // Subtle human clothing / pant-leg brush between strides
    this.triggerClothSwish(now, volume * 0.24, pitchJitter, stepBus);

    switch (material) {
      case 'concrete':
        this.playConcreteWalkStep(now, rollDelay, volume, pitchJitter, sprinting, crouching, stepBus);
        break;
      case 'squeaky_wood':
        this.playWoodWalkStep(
          now,
          rollDelay,
          volume,
          pitchJitter,
          sprinting,
          crouching,
          gx ?? 0,
          gz ?? 0,
          stepBus,
        );
        break;
      case 'metal':
        this.playMetalWalkStep(now, rollDelay, volume, pitchJitter, sprinting, crouching, stepBus);
        break;
      case 'wet_carpet':
      default:
        this.playWetCarpetWalkStep(now, rollDelay, volume, pitchJitter, sprinting, crouching, stepBus);
        break;
    }

    return material;
  }

  /**
   * Plays an abrasive 0.52s slide SFX like a human body scratching and skidding across the floor.
   */
  public playBodySlide(material: FloorMaterial): void {
    if (!this.ctx || !this.outputBus || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const dur = 0.52;
    const jitter = 0.94 + Math.random() * 0.12;

    const slideBus = this.ctx.createGain();
    slideBus.gain.value = 1.0;

    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(-0.14, now);
      panner.pan.linearRampToValueAtTime(0.12, now + dur);
      slideBus.connect(panner);
      panner.connect(this.outputBus);
    } else {
      slideBus.connect(this.outputBus);
    }

    if (this.slapbackBus && material !== 'wet_carpet') {
      const send = this.ctx.createGain();
      send.gain.value = material === 'concrete' || material === 'metal' ? 0.36 : 0.22;
      slideBus.connect(send);
      send.connect(this.slapbackBus);
    }

    // 1. Initial human body drop onto floor (hip/knee/shoulder impact weight)
    this.triggerBodyWeightThump(now, 0.24, 96 * jitter, 27, 0.11, 280, slideBus);

    const dropCloth = this.ctx.createBufferSource();
    dropCloth.buffer = this.noiseBuffer;
    const dropLpf = this.ctx.createBiquadFilter();
    dropLpf.type = 'lowpass';
    dropLpf.frequency.value = 460 * jitter;
    const dropGain = this.ctx.createGain();
    dropGain.gain.setValueAtTime(0.001, now);
    dropGain.gain.linearRampToValueAtTime(0.22, now + 0.018);
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    dropCloth.connect(dropLpf);
    dropLpf.connect(dropGain);
    dropGain.connect(slideBus);
    dropCloth.start(now, Math.random() * 0.6, 0.14);

    // 2. Continuous heavy body-on-floor drag (low cloth/flesh friction decelerating)
    const dragSrc = this.ctx.createBufferSource();
    dragSrc.buffer = this.noiseBuffer;
    const dragFilter = this.ctx.createBiquadFilter();
    dragFilter.type = 'bandpass';
    dragFilter.Q.value = 1.5;
    dragFilter.frequency.setValueAtTime(material === 'wet_carpet' ? 380 : 520, now + 0.015);
    dragFilter.frequency.exponentialRampToValueAtTime(
      material === 'wet_carpet' ? 190 : 240,
      now + dur,
    );
    const dragGain = this.ctx.createGain();
    dragGain.gain.setValueAtTime(0.001, now + 0.01);
    dragGain.gain.linearRampToValueAtTime(0.24, now + 0.055);
    dragGain.gain.setValueAtTime(0.2, now + 0.26);
    dragGain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    dragSrc.connect(dragFilter);
    dragFilter.connect(dragGain);
    dragGain.connect(slideBus);
    dragSrc.start(now + 0.01, Math.random() * 0.4, dur);

    // 3. Rough floor scratching striations (high-friction grit, fingernails/sole/buckle scraping)
    const scratchSrc = this.ctx.createBufferSource();
    scratchSrc.buffer = this.noiseBuffer;
    const scratchBpf = this.ctx.createBiquadFilter();
    scratchBpf.type = 'bandpass';
    scratchBpf.Q.value = material === 'concrete' ? 2.4 : material === 'metal' ? 3.4 : 2.1;
    const startScratchFreq =
      material === 'concrete'
        ? 2350
        : material === 'metal'
          ? 2750
          : material === 'squeaky_wood'
            ? 1780
            : 1120;
    scratchBpf.frequency.setValueAtTime(startScratchFreq * jitter, now + 0.02);
    scratchBpf.frequency.exponentialRampToValueAtTime(startScratchFreq * 0.46, now + dur - 0.03);

    const scratchGain = this.ctx.createGain();
    const scratchAmp = material === 'wet_carpet' ? 0.14 : 0.22;
    scratchGain.gain.setValueAtTime(0.0008, now + 0.02);
    scratchGain.gain.linearRampToValueAtTime(scratchAmp, now + 0.06);
    scratchGain.gain.linearRampToValueAtTime(scratchAmp * 0.72, now + 0.28);
    scratchGain.gain.exponentialRampToValueAtTime(0.0008, now + dur - 0.02);

    scratchSrc.connect(scratchBpf);
    scratchBpf.connect(scratchGain);
    scratchGain.connect(slideBus);
    scratchSrc.start(now + 0.02, Math.random() * 0.5, dur - 0.02);

    // 4. Staggered jagged floor-scratch micro-bursts (stick-slip grit & scraping texture)
    const scratchOffsets = [0.035, 0.088, 0.145, 0.21, 0.275, 0.34, 0.41];
    scratchOffsets.forEach((off, idx) => {
      if (!this.ctx || !this.noiseBuffer) return;
      const t0 = now + off;
      const decay = 1 - idx * 0.11;
      const burstDur = 0.045 + Math.random() * 0.032;

      const grit = this.ctx.createBufferSource();
      grit.buffer = this.noiseBuffer;
      const gFilter = this.ctx.createBiquadFilter();
      gFilter.type = 'bandpass';
      gFilter.frequency.value =
        (material === 'wet_carpet' ? 1450 : 2650 + Math.random() * 1450) * jitter;
      gFilter.Q.value = material === 'metal' ? 5.2 : 3.6;

      const gGain = this.ctx.createGain();
      gGain.gain.setValueAtTime(0.0006, t0);
      gGain.gain.linearRampToValueAtTime(0.14 * decay, t0 + 0.008);
      gGain.gain.exponentialRampToValueAtTime(0.0006, t0 + burstDur);

      grit.connect(gFilter);
      gFilter.connect(gGain);
      gGain.connect(slideBus);
      grit.start(t0, Math.random() * 0.8, burstDur + 0.01);

      // Harsh stick-slip floorboard / metal-plate / concrete grit screech on early scratches
      if (idx < 4 && material !== 'wet_carpet') {
        const scrapeOsc = this.ctx.createOscillator();
        const sFilt = this.ctx.createBiquadFilter();
        const sGain = this.ctx.createGain();
        scrapeOsc.type = 'sawtooth';
        const baseF = material === 'metal' ? 420 : material === 'squeaky_wood' ? 285 : 340;
        scrapeOsc.frequency.setValueAtTime((baseF + idx * 35) * jitter, t0);
        scrapeOsc.frequency.exponentialRampToValueAtTime(baseF * 0.68 * jitter, t0 + burstDur);
        sFilt.type = 'bandpass';
        sFilt.frequency.value = material === 'metal' ? 2200 : 1650;
        sFilt.Q.value = 4.2;
        sGain.gain.setValueAtTime(0.0004, t0);
        sGain.gain.linearRampToValueAtTime(0.042 * decay, t0 + 0.01);
        sGain.gain.exponentialRampToValueAtTime(0.0004, t0 + burstDur);
        scrapeOsc.connect(sFilt);
        sFilt.connect(sGain);
        sGain.connect(slideBus);
        scrapeOsc.start(t0);
        scrapeOsc.stop(t0 + burstDur + 0.015);
      }
    });

    // 5. Final deceleration catch (palm/sole gripping the floor at stop)
    this.triggerBodyWeightThump(now + 0.43, 0.095, 78 * jitter, 32, 0.07, 320, slideBus);
  }

  private triggerClothSwish(now: number, volume: number, jitter: number, dest: AudioNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(420 * jitter, now);
    bpf.frequency.linearRampToValueAtTime(640 * jitter, now + 0.055);
    bpf.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.075);

    src.connect(bpf);
    bpf.connect(gain);
    gain.connect(dest);
    src.start(now, Math.random() * 0.7, 0.085);
  }

  private triggerBodyWeightThump(
    at: number,
    gainPeak: number,
    startFreq: number,
    endFreq: number,
    dur: number,
    cutoffHz: number,
    dest: AudioNode,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const lpf = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, at);
    osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur * 0.85);

    lpf.type = 'lowpass';
    lpf.frequency.value = cutoffHz;
    lpf.Q.value = 0.7;

    gain.gain.setValueAtTime(0.0008, at);
    gain.gain.linearRampToValueAtTime(gainPeak, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);

    osc.connect(lpf);
    lpf.connect(gain);
    gain.connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.015);
  }

  private playWetCarpetWalkStep(
    now: number,
    rollDelay: number,
    volume: number,
    jitter: number,
    sprinting: boolean,
    crouching: boolean,
    stepBus: AudioNode,
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Heel strike: muted wool-pad thump + soggy carpet compression
    if (!crouching) {
      this.triggerBodyWeightThump(
        now,
        volume * 0.75,
        (sprinting ? 92 : 74) * jitter,
        28,
        0.09,
        240,
        stepBus,
      );
    }

    const heelPad = this.ctx.createBufferSource();
    heelPad.buffer = this.noiseBuffer;
    const padLpf = this.ctx.createBiquadFilter();
    padLpf.type = 'lowpass';
    padLpf.frequency.value = (sprinting ? 480 : crouching ? 220 : 340) * jitter;
    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.0008, now);
    padGain.gain.linearRampToValueAtTime(volume * 0.86, now + 0.012);
    padGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
    heelPad.connect(padLpf);
    padLpf.connect(padGain);
    padGain.connect(stepBus);
    heelPad.start(now, Math.random() * 0.6, 0.105);

    // 2. Toe roll & soaked squelch push-off (pure filtered water/fiber noise, zero synth chirp)
    const toeAt = now + rollDelay;
    const squishSrc = this.ctx.createBufferSource();
    squishSrc.buffer = this.noiseBuffer;
    const squishBpf = this.ctx.createBiquadFilter();
    squishBpf.type = 'bandpass';
    squishBpf.Q.value = 3.2;
    squishBpf.frequency.setValueAtTime(520 * jitter, toeAt);
    squishBpf.frequency.exponentialRampToValueAtTime(
      (sprinting ? 1480 : 1080) * jitter,
      toeAt + 0.055,
    );
    squishBpf.frequency.exponentialRampToValueAtTime(420 * jitter, toeAt + 0.11);

    const squishGain = this.ctx.createGain();
    squishGain.gain.setValueAtTime(0.0006, toeAt);
    squishGain.gain.linearRampToValueAtTime(
      volume * (crouching ? 0.52 : sprinting ? 0.85 : 0.68),
      toeAt + 0.022,
    );
    squishGain.gain.exponentialRampToValueAtTime(0.0006, toeAt + 0.115);

    squishSrc.connect(squishBpf);
    squishBpf.connect(squishGain);
    squishGain.connect(stepBus);
    squishSrc.start(toeAt, Math.random() * 0.5, 0.125);
  }

  private playConcreteWalkStep(
    now: number,
    rollDelay: number,
    volume: number,
    jitter: number,
    sprinting: boolean,
    crouching: boolean,
    stepBus: AudioNode,
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Heel strike: solid rubber-heel impact + brief concrete grit transient
    this.triggerBodyWeightThump(
      now,
      volume * (crouching ? 0.45 : 0.82),
      (sprinting ? 136 : crouching ? 94 : 114) * jitter,
      36,
      0.072,
      340,
      stepBus,
    );

    const heelGrit = this.ctx.createBufferSource();
    heelGrit.buffer = this.noiseBuffer;
    const heelBpf = this.ctx.createBiquadFilter();
    heelBpf.type = 'bandpass';
    heelBpf.frequency.value = (sprinting ? 1680 : crouching ? 1050 : 1380) * jitter;
    heelBpf.Q.value = 1.4;
    const heelGain = this.ctx.createGain();
    heelGain.gain.setValueAtTime(0.001, now);
    heelGain.gain.linearRampToValueAtTime(volume * 0.85, now + 0.004);
    heelGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.052);
    heelGrit.connect(heelBpf);
    heelBpf.connect(heelGain);
    heelGain.connect(stepBus);
    heelGrit.start(now, Math.random() * 0.6, 0.06);

    // 2. Forefoot / toe push-off: crisp dry concrete sole brush + gentle weight settle
    const toeAt = now + rollDelay;
    this.triggerBodyWeightThump(
      toeAt,
      volume * (crouching ? 0.34 : 0.56),
      (sprinting ? 116 : 96) * jitter,
      38,
      0.06,
      290,
      stepBus,
    );

    const toeGrit = this.ctx.createBufferSource();
    toeGrit.buffer = this.noiseBuffer;
    const toeBpf = this.ctx.createBiquadFilter();
    toeBpf.type = 'bandpass';
    toeBpf.frequency.setValueAtTime(1450 * jitter, toeAt);
    toeBpf.frequency.linearRampToValueAtTime(2150 * jitter, toeAt + 0.045);
    toeBpf.Q.value = 1.5;
    const toeGain = this.ctx.createGain();
    toeGain.gain.setValueAtTime(0.0008, toeAt);
    toeGain.gain.linearRampToValueAtTime(volume * 0.62, toeAt + 0.01);
    toeGain.gain.exponentialRampToValueAtTime(0.0008, toeAt + 0.065);
    toeGrit.connect(toeBpf);
    toeBpf.connect(toeGain);
    toeGain.connect(stepBus);
    toeGrit.start(toeAt, Math.random() * 0.6, 0.075);
  }

  private playWoodWalkStep(
    now: number,
    rollDelay: number,
    volume: number,
    jitter: number,
    sprinting: boolean,
    crouching: boolean,
    gx: number,
    gz: number,
    stepBus: AudioNode,
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Heel strike: hollow subfloor timber knock + cavity body resonance
    this.triggerBodyWeightThump(
      now,
      volume * 0.88,
      (sprinting ? 128 : crouching ? 88 : 108) * jitter,
      40,
      0.095,
      360,
      stepBus,
    );

    const plankBody = this.ctx.createOscillator();
    const pGain = this.ctx.createGain();
    plankBody.type = 'sine';
    plankBody.frequency.setValueAtTime(188 * jitter, now);
    plankBody.frequency.exponentialRampToValueAtTime(124 * jitter, now + 0.065);
    pGain.gain.setValueAtTime(volume * 0.28, now);
    pGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
    plankBody.connect(pGain);
    pGain.connect(stepBus);
    plankBody.start(now);
    plankBody.stop(now + 0.085);

    // 2. Toe push-off: dry wood sole scuff + lighter secondary knock
    const toeAt = now + rollDelay;
    this.triggerBodyWeightThump(toeAt, volume * 0.48, 96 * jitter, 42, 0.068, 300, stepBus);

    const scuffSrc = this.ctx.createBufferSource();
    scuffSrc.buffer = this.noiseBuffer;
    const scuffBpf = this.ctx.createBiquadFilter();
    scuffBpf.type = 'bandpass';
    scuffBpf.frequency.value = 880 * jitter;
    scuffBpf.Q.value = 1.6;
    const scuffGain = this.ctx.createGain();
    scuffGain.gain.setValueAtTime(0.0008, toeAt);
    scuffGain.gain.linearRampToValueAtTime(volume * 0.44, toeAt + 0.01);
    scuffGain.gain.exponentialRampToValueAtTime(0.0008, toeAt + 0.068);
    scuffSrc.connect(scuffBpf);
    scuffBpf.connect(scuffGain);
    scuffGain.connect(stepBus);
    scuffSrc.start(toeAt, Math.random() * 0.5, 0.078);

    // 3. Organic timber floorboard groan/creak (low warm wood-stress resonance, not shrill synth)
    const tileSeed = Math.abs(Math.sin(gx * 12.9898 + gz * 78.233)) % 1;
    const creakChance = crouching ? 0.45 : SURFACE_SOUND_PROFILES.squeaky_wood.creakProbability;
    if (Math.random() <= creakChance) {
      const creakAt = now + 0.028 + Math.random() * 0.03;
      const creakDur = sprinting ? 0.11 : crouching ? 0.17 : 0.145;

      const creakOsc = this.ctx.createOscillator();
      creakOsc.type = 'sawtooth';
      const baseF = (185 + tileSeed * 115) * jitter;
      creakOsc.frequency.setValueAtTime(baseF, creakAt);
      creakOsc.frequency.linearRampToValueAtTime(
        tileSeed > 0.5 ? baseF * 1.18 : baseF * 0.82,
        creakAt + creakDur,
      );

      const mod = this.ctx.createOscillator();
      const modDepth = this.ctx.createGain();
      mod.type = 'triangle';
      mod.frequency.value = 24 + tileSeed * 18;
      modDepth.gain.value = 18;
      mod.connect(modDepth);
      modDepth.connect(creakOsc.frequency);

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 680 * jitter;
      formant.Q.value = 3.2;

      const cGain = this.ctx.createGain();
      const amp = volume * (crouching ? 0.34 : 0.42);
      cGain.gain.setValueAtTime(0.0005, creakAt);
      cGain.gain.linearRampToValueAtTime(amp, creakAt + creakDur * 0.3);
      cGain.gain.exponentialRampToValueAtTime(0.0005, creakAt + creakDur);

      creakOsc.connect(formant);
      formant.connect(cGain);
      cGain.connect(stepBus);
      mod.start(creakAt);
      creakOsc.start(creakAt);
      mod.stop(creakAt + creakDur + 0.02);
      creakOsc.stop(creakAt + creakDur + 0.02);
    }
  }

  private playMetalWalkStep(
    now: number,
    rollDelay: number,
    volume: number,
    jitter: number,
    sprinting: boolean,
    crouching: boolean,
    stepBus: AudioNode,
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Steel grate heel impact + subdued plate thrum
    this.triggerBodyWeightThump(
      now,
      volume * (crouching ? 0.45 : 0.9),
      (sprinting ? 132 : 108) * jitter,
      36,
      0.095,
      360,
      stepBus,
    );

    [196, 338].forEach((freq, idx) => {
      if (!this.ctx) return;
      const ring = this.ctx.createOscillator();
      const rGain = this.ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(freq * jitter, now);
      rGain.gain.setValueAtTime(volume * (idx === 0 ? 0.22 : 0.12), now);
      rGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.14);
      ring.connect(rGain);
      rGain.connect(stepBus);
      ring.start(now);
      ring.stop(now + 0.16);
    });

    // 2. Sole clack + toe push-off on metal diamond plate
    const toeAt = now + rollDelay;
    const clackSrc = this.ctx.createBufferSource();
    clackSrc.buffer = this.noiseBuffer;
    const clackBpf = this.ctx.createBiquadFilter();
    clackBpf.type = 'bandpass';
    clackBpf.frequency.value = 1720 * jitter;
    clackBpf.Q.value = 2.1;
    const clackGain = this.ctx.createGain();
    clackGain.gain.setValueAtTime(0.0008, toeAt);
    clackGain.gain.linearRampToValueAtTime(volume * 0.56, toeAt + 0.008);
    clackGain.gain.exponentialRampToValueAtTime(0.0008, toeAt + 0.068);
    clackSrc.connect(clackBpf);
    clackBpf.connect(clackGain);
    clackGain.connect(stepBus);
    clackSrc.start(toeAt, Math.random() * 0.5, 0.08);
  }

  public getDebugCellKey(): string {
    return this.lastCellKey;
  }
}
