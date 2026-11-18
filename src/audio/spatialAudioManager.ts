import type { FloorMaterial } from '../game/mapData';

/**
 * SpatialAudioManager
 * Manages Web Audio 3D listener orientation/position, HRTF spatialization buses,
 * distance air-absorption filtering, and material-aware spatialized Stalker footsteps
 * (wet_carpet, concrete, squeaky_wood, metal).
 */
export class SpatialAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private concreteReverbSend: GainNode | null = null;
  private lastPlayerStepMs = 0;

  public attach(ctx: AudioContext, masterGain: GainNode, noiseBuffer: AudioBuffer): void {
    this.ctx = ctx;
    this.masterGain = masterGain;
    this.noiseBuffer = noiseBuffer;

    // Subtle cold corridor slapback bus used specifically for concrete footstep reflections
    const delay1 = ctx.createDelay(0.6);
    delay1.delayTime.value = 0.095;
    const delay2 = ctx.createDelay(0.6);
    delay2.delayTime.value = 0.19;

    const fb = ctx.createGain();
    fb.gain.value = 0.24;

    const damp = ctx.createBiquadFilter();
    damp.type = 'bandpass';
    damp.frequency.value = 1150;
    damp.Q.value = 0.85;

    const send = ctx.createGain();
    send.gain.value = 0.34;

    send.connect(delay1);
    delay1.connect(damp);
    damp.connect(delay2);
    delay2.connect(fb);
    fb.connect(delay1);
    damp.connect(masterGain);
    delay2.connect(masterGain);

    this.concreteReverbSend = send;
  }

  /**
   * Syncs Web Audio AudioListener with the player's 3D camera transform every frame
   * (compatible with both AudioParam-based modern listeners and legacy setter APIs).
   */
  public updateListener(px: number, py: number, pz: number, yaw: number, pitch: number): void {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const now = this.ctx.currentTime;

    const cosP = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cosP;
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * cosP;

    const ux = -Math.sin(yaw) * -Math.sin(pitch);
    const uy = cosP;
    const uz = -Math.cos(yaw) * -Math.sin(pitch);

    if (listener.positionX) {
      listener.positionX.setValueAtTime(px, now);
      listener.positionY.setValueAtTime(py, now);
      listener.positionZ.setValueAtTime(pz, now);
      listener.forwardX.setValueAtTime(fx, now);
      listener.forwardY.setValueAtTime(fy, now);
      listener.forwardZ.setValueAtTime(fz, now);
      listener.upX.setValueAtTime(ux, now);
      listener.upY.setValueAtTime(uy, now);
      listener.upZ.setValueAtTime(uz, now);
    } else if (
      typeof (listener as unknown as { setPosition?: (x: number, y: number, z: number) => void })
        .setPosition === 'function'
    ) {
      const legacy = listener as unknown as {
        setPosition: (x: number, y: number, z: number) => void;
        setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void;
      };
      legacy.setPosition(px, py, pz);
      legacy.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /**
   * Plays a player footstep tuned to the floor surface under the player's boots.
   */
  public playPlayerFootstep(
    material: FloorMaterial,
    sprinting: boolean,
    crouching: boolean,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const nowMs = performance.now();
    const interval = sprinting ? 305 : crouching ? 650 : 475;
    if (nowMs - this.lastPlayerStepMs < interval) return;
    this.lastPlayerStepMs = nowMs;

    const now = this.ctx.currentTime;
    const pitchJitter = 0.92 + Math.random() * 0.16;

    if (material === 'metal') {
      // Crisp industrial boot strike on hollow diamond-plate steel floor
      const plateGain = this.ctx.createGain();
      const plateVol = sprinting ? 0.24 : crouching ? 0.055 : 0.145;
      plateGain.gain.setValueAtTime(0.001, now);
      plateGain.gain.linearRampToValueAtTime(plateVol, now + 0.005);
      plateGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      plateGain.connect(this.masterGain);
      if (this.concreteReverbSend && !crouching) {
        plateGain.connect(this.concreteReverbSend);
      }

      // Solid steel heel thump
      const thump = this.ctx.createOscillator();
      thump.type = 'triangle';
      thump.frequency.setValueAtTime((sprinting ? 134 : 112) * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(42, now + 0.095);
      thump.connect(plateGain);
      thump.start(now);
      thump.stop(now + 0.11);

      // Hollow metallic plate overtones
      [268, 442].forEach((freq, idx) => {
        if (!this.ctx) return;
        const ring = this.ctx.createOscillator();
        const rGain = this.ctx.createGain();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(freq * pitchJitter, now);
        rGain.gain.setValueAtTime(plateVol * (idx === 0 ? 0.34 : 0.2), now);
        rGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.17);
        ring.connect(rGain);
        rGain.connect(this.masterGain!);
        ring.start(now);
        ring.stop(now + 0.19);
      });

      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      const clack = this.ctx.createBiquadFilter();
      clack.type = 'bandpass';
      clack.frequency.value = 1780 * pitchJitter;
      clack.Q.value = 2.4;
      noiseSrc.connect(clack);
      clack.connect(plateGain);
      noiseSrc.start(now, Math.random() * 0.5, 0.075);
    } else if (material === 'concrete') {
      // Crisp hard-soled concrete boot strike + high-frequency pebble click + slapback echo
      const tapGain = this.ctx.createGain();
      const tapVol = sprinting ? 0.22 : crouching ? 0.05 : 0.13;
      tapGain.gain.setValueAtTime(0.001, now);
      tapGain.gain.linearRampToValueAtTime(tapVol, now + 0.006);
      tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      tapGain.connect(this.masterGain);
      if (this.concreteReverbSend && !crouching) {
        tapGain.connect(this.concreteReverbSend);
      }

      // Transient sole-on-concrete grit burst
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      const gritFilter = this.ctx.createBiquadFilter();
      gritFilter.type = 'bandpass';
      gritFilter.frequency.value = (sprinting ? 1950 : 1550) * pitchJitter;
      gritFilter.Q.value = 1.65;
      noiseSrc.connect(gritFilter);
      gritFilter.connect(tapGain);
      noiseSrc.start(now, Math.random() * 0.6, 0.09);

      // Solid concrete heel impact
      const impact = this.ctx.createOscillator();
      const impactGain = this.ctx.createGain();
      impact.type = 'triangle';
      impact.frequency.setValueAtTime((sprinting ? 148 : crouching ? 105 : 128) * pitchJitter, now);
      impact.frequency.exponentialRampToValueAtTime(44, now + 0.065);
      impactGain.gain.setValueAtTime(sprinting ? 0.14 : crouching ? 0.032 : 0.085, now);
      impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
      impact.connect(impactGain);
      impactGain.connect(this.masterGain);
      if (this.concreteReverbSend && !crouching) {
        impactGain.connect(this.concreteReverbSend);
      }
      impact.start(now);
      impact.stop(now + 0.08);
    } else if (material === 'squeaky_wood') {
      // Hollow plank thump + audible floorboard squeak
      const woodGain = this.ctx.createGain();
      const woodVol = sprinting ? 0.22 : crouching ? 0.055 : 0.135;
      woodGain.gain.setValueAtTime(0.001, now);
      woodGain.gain.linearRampToValueAtTime(woodVol, now + 0.006);
      woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      woodGain.connect(this.masterGain);

      const thump = this.ctx.createOscillator();
      thump.type = 'triangle';
      thump.frequency.setValueAtTime((sprinting ? 136 : 114) * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(46, now + 0.09);
      thump.connect(woodGain);
      thump.start(now);
      thump.stop(now + 0.11);

      const squeak = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      squeak.type = 'sawtooth';
      squeak.frequency.setValueAtTime(640 * pitchJitter, now + 0.02);
      squeak.frequency.exponentialRampToValueAtTime(840 * pitchJitter, now + 0.11);
      sGain.gain.setValueAtTime(0.0006, now + 0.02);
      sGain.gain.linearRampToValueAtTime(woodVol * 0.36, now + 0.05);
      sGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.15);
      squeak.connect(sGain);
      sGain.connect(this.masterGain);
      squeak.start(now + 0.02);
      squeak.stop(now + 0.16);
    } else {
      // Soaked Backrooms wet carpet squelch + muted heel weight
      const brushSrc = this.ctx.createBufferSource();
      brushSrc.buffer = this.noiseBuffer;

      const carpetFilter = this.ctx.createBiquadFilter();
      carpetFilter.type = 'bandpass';
      carpetFilter.Q.value = 3.2;
      carpetFilter.frequency.setValueAtTime(680 * pitchJitter, now);
      carpetFilter.frequency.exponentialRampToValueAtTime((sprinting ? 1950 : 1450) * pitchJitter, now + 0.085);

      const brushGain = this.ctx.createGain();
      const peak = sprinting ? 0.18 : crouching ? 0.042 : 0.105;
      brushGain.gain.setValueAtTime(peak, now);
      brushGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      brushSrc.connect(carpetFilter);
      carpetFilter.connect(brushGain);
      brushGain.connect(this.masterGain);
      brushSrc.start(now, Math.random() * 0.5, 0.14);

      if (!crouching) {
        const thud = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime((sprinting ? 92 : 72) * pitchJitter, now);
        thud.frequency.exponentialRampToValueAtTime(31, now + 0.08);
        thudGain.gain.setValueAtTime(sprinting ? 0.095 : 0.045, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        thud.connect(thudGain);
        thudGain.connect(this.masterGain);
        thud.start(now);
        thud.stop(now + 0.095);
      }
    }
  }

  /**
   * Plays a true 3D HRTF-spatialized Stalker Entity footstep from its exact world coordinates,
   * styled distinctly for wet_carpet, concrete, squeaky_wood, and metal floors.
   */
  public playStalkerFootstep(
    wx: number,
    wz: number,
    distance: number,
    material: FloorMaterial,
    chasing: boolean,
    fallbackPan = 0,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    if (distance > 26) return;

    const now = this.ctx.currentTime;
    const pitchJitter = 0.9 + Math.random() * 0.2;

    // Distance air-absorption filter: distant corridors naturally muffle high transients
    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = Math.max(580, 3600 - distance * 115);

    if (typeof this.ctx.createPanner === 'function') {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.4;
      panner.maxDistance = 28;
      panner.rolloffFactor = 1.3;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(wx, now);
        panner.positionY.setValueAtTime(0.15, now);
        panner.positionZ.setValueAtTime(wz, now);
      } else if (typeof (panner as unknown as { setPosition?: (x: number, y: number, z: number) => void }).setPosition === 'function') {
        (panner as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(wx, 0.15, wz);
      }
      airFilter.connect(panner);
      panner.connect(this.masterGain);
    } else if (this.ctx.createStereoPanner) {
      const sp = this.ctx.createStereoPanner();
      sp.pan.value = Math.max(-0.95, Math.min(0.95, fallbackPan));
      airFilter.connect(sp);
      sp.connect(this.masterGain);
    } else {
      airFilter.connect(this.masterGain);
    }

    const approachScale = Math.pow(Math.max(0.14, Math.min(1.0, 1 - distance / 27)), 0.85);
    const baseVol = (chasing ? 0.62 : 0.44) * approachScale;

    if (material === 'metal') {
      // Heavy-metallic thudding footstep on steel floor plates (sub-plate slam + hollow steel clang + echo)
      const thud = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime((chasing ? 98 : 82) * pitchJitter, now);
      thud.frequency.exponentialRampToValueAtTime(23, now + 0.23);
      thudGain.gain.setValueAtTime(baseVol * 1.15, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      thud.connect(thudGain);
      thudGain.connect(airFilter);
      thud.start(now);
      thud.stop(now + 0.26);

      // Secondary deep sub-weight floor shudder
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime((chasing ? 62 : 52) * pitchJitter, now);
      sub.frequency.exponentialRampToValueAtTime(20, now + 0.26);
      subGain.gain.setValueAtTime(baseVol * 0.92, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      sub.connect(subGain);
      subGain.connect(airFilter);
      sub.start(now);
      sub.stop(now + 0.29);

      // Resonant hollow steel plate partials (inharmonic metallic clang)
      const plateBus = this.ctx.createGain();
      plateBus.gain.value = 1;
      plateBus.connect(airFilter);
      if (this.concreteReverbSend && distance < 22) {
        const echoSend = this.ctx.createGain();
        echoSend.gain.value = Math.max(0.12, 1 - distance / 22) * 0.68;
        plateBus.connect(echoSend);
        echoSend.connect(this.concreteReverbSend);
      }

      [176, 292, 488].forEach((freq, idx) => {
        if (!this.ctx) return;
        const clang = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        clang.type = idx === 0 ? 'triangle' : 'sine';
        clang.frequency.setValueAtTime(freq * pitchJitter, now);
        clang.frequency.exponentialRampToValueAtTime(freq * 0.94 * pitchJitter, now + 0.36);
        const partialAmp = baseVol * (idx === 0 ? 0.56 : idx === 1 ? 0.38 : 0.24);
        cGain.gain.setValueAtTime(0.001, now);
        cGain.gain.linearRampToValueAtTime(partialAmp, now + 0.006);
        cGain.gain.exponentialRampToValueAtTime(0.0008, now + (0.34 - idx * 0.04));
        clang.connect(cGain);
        cGain.connect(plateBus);
        clang.start(now);
        clang.stop(now + 0.38);
      });

      // Steel grate bolt rattle / metallic scrape transient
      const rattleSrc = this.ctx.createBufferSource();
      rattleSrc.buffer = this.noiseBuffer;
      const rattleFilter = this.ctx.createBiquadFilter();
      rattleFilter.type = 'bandpass';
      rattleFilter.frequency.value = 1320 * pitchJitter;
      rattleFilter.Q.value = 2.8;
      const rattleGain = this.ctx.createGain();
      rattleGain.gain.setValueAtTime(baseVol * 0.64, now);
      rattleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      rattleSrc.connect(rattleFilter);
      rattleFilter.connect(rattleGain);
      rattleGain.connect(plateBus);
      rattleSrc.start(now, Math.random() * 0.5, 0.12);
    } else if (material === 'concrete') {
      // Heavy creature heel impact + sharp talon/bone click + eerie concrete hallway reflection
      const thud = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime((chasing ? 112 : 90) * pitchJitter, now);
      thud.frequency.exponentialRampToValueAtTime(28, now + 0.14);
      thudGain.gain.setValueAtTime(baseVol * 0.85, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      thud.connect(thudGain);
      thudGain.connect(airFilter);
      thud.start(now);
      thud.stop(now + 0.16);

      // Sharp concrete talon/grit clack (two quick micro-clicks: heel then claw tip)
      [0, 0.045].forEach((offset, idx) => {
        if (!this.ctx || !this.noiseBuffer) return;
        const clickSrc = this.ctx.createBufferSource();
        clickSrc.buffer = this.noiseBuffer;
        const clackFilter = this.ctx.createBiquadFilter();
        clackFilter.type = 'bandpass';
        clackFilter.frequency.value = (idx === 0 ? 1580 : 2350) * pitchJitter;
        clackFilter.Q.value = 2.4;

        const clackGain = this.ctx.createGain();
        clackGain.gain.setValueAtTime(baseVol * (idx === 0 ? 0.72 : 0.45), now + offset);
        clackGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.075);

        clickSrc.connect(clackFilter);
        clackFilter.connect(clackGain);
        clackGain.connect(airFilter);
        if (this.concreteReverbSend && distance < 18) {
          // Attenuated echo feed scaled by distance
          const echoAtten = this.ctx.createGain();
          echoAtten.gain.value = Math.max(0.08, 1 - distance / 18) * 0.48;
          clackGain.connect(echoAtten);
          echoAtten.connect(this.concreteReverbSend);
        }
        clickSrc.start(now + offset, Math.random() * 0.5, 0.085);
      });
    } else if (material === 'squeaky_wood') {
      // Heavy Stalker stomp + eerie groaning floorboard creak
      const thud = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime((chasing ? 102 : 84) * pitchJitter, now);
      thud.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      thudGain.gain.setValueAtTime(baseVol * 0.92, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      thud.connect(thudGain);
      thudGain.connect(airFilter);
      thud.start(now);
      thud.stop(now + 0.22);

      const creak = this.ctx.createOscillator();
      const cFilter = this.ctx.createBiquadFilter();
      const cGain = this.ctx.createGain();
      creak.type = 'sawtooth';
      creak.frequency.setValueAtTime(360 * pitchJitter, now + 0.025);
      creak.frequency.exponentialRampToValueAtTime(250 * pitchJitter, now + 0.26);
      cFilter.type = 'bandpass';
      cFilter.frequency.value = 980;
      cFilter.Q.value = 3.8;
      cGain.gain.setValueAtTime(0.001, now + 0.025);
      cGain.gain.linearRampToValueAtTime(baseVol * 0.56, now + 0.08);
      cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.27);
      creak.connect(cFilter);
      cFilter.connect(cGain);
      cGain.connect(airFilter);
      creak.start(now + 0.025);
      creak.stop(now + 0.29);
    } else {
      // Heavy wet carpet stomp + soaked squelch
      const thud = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime((chasing ? 84 : 66) * pitchJitter, now);
      thud.frequency.exponentialRampToValueAtTime(24, now + 0.16);
      thudGain.gain.setValueAtTime(baseVol * 0.9, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      thud.connect(thudGain);
      thudGain.connect(airFilter);
      thud.start(now);
      thud.stop(now + 0.18);

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(520 * pitchJitter, now);
      filter.frequency.exponentialRampToValueAtTime((chasing ? 1580 : 1120) * pitchJitter, now + 0.1);
      filter.Q.value = 2.6;
      const scuffGain = this.ctx.createGain();
      scuffGain.gain.setValueAtTime(baseVol * 0.62, now);
      scuffGain.gain.exponentialRampToValueAtTime(0.001, now + 0.145);
      src.connect(filter);
      filter.connect(scuffGain);
      scuffGain.connect(airFilter);
      src.start(now, Math.random() * 0.5, 0.155);
    }
  }
}
