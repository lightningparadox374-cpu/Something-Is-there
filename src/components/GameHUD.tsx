import React, { useRef } from 'react';
import {
  ActivePrompt,
  DEFAULT_KEY_BINDINGS,
  GamePhase,
  GameSettings,
  InspectedDocument,
  InventoryItem,
  formatKeyCode,
} from '../types/game';
import { CHAPTER_BLUEPRINTS } from '../data/chaptersAndCodex';
import { GameActionsRef, LiveHudSnapshot, MobileInputState } from './BackroomsCanvas';
import { BatteryCharging, Brain, FileText, Flashlight, Heart, Pause } from 'lucide-react';

interface GameHUDProps {
  phase: GamePhase;
  hud: LiveHudSnapshot;
  prompt: ActivePrompt | null;
  inventory: (InventoryItem | null)[];
  activeSlot: number;
  statusToast: string | null;
  deathReason: string;
  inspectedDoc: InspectedDocument | null;
  settings: GameSettings;
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  actionsRef: React.MutableRefObject<GameActionsRef | null>;
  onSelectSlot: (idx: number) => void;
  onCloseDoc: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryCheckpoint: () => void;
  onReturnToMenu: () => void;
  onPlayAgain: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  phase,
  hud,
  prompt,
  inventory,
  activeSlot,
  statusToast,
  deathReason,
  inspectedDoc,
  settings,
  mobileInputRef,
  actionsRef,
  onSelectSlot,
  onCloseDoc,
  onPause,
  onResume,
  onRetryCheckpoint,
  onReturnToMenu,
  onPlayAgain,
}) => {
  const ch1 = CHAPTER_BLUEPRINTS[0];
  const currentStep = ch1.steps[Math.min(ch1.steps.length - 1, Math.max(0, hud.stepIndex - 1))];

  // Virtual joystick & touch-look tracking
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lookPrevRef = useRef<{ x: number; y: number } | null>(null);

  const handleJoyStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    joyOriginRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleJoyMove = (e: React.TouchEvent) => {
    if (!joyOriginRef.current) return;
    const t = e.touches[0];
    const maxR = 44;
    const dx = Math.max(-maxR, Math.min(maxR, t.clientX - joyOriginRef.current.x));
    const dy = Math.max(-maxR, Math.min(maxR, t.clientY - joyOriginRef.current.y));
    mobileInputRef.current.moveX = dx / maxR;
    mobileInputRef.current.moveY = dy / maxR;
  };

  const handleJoyEnd = () => {
    joyOriginRef.current = null;
    mobileInputRef.current.moveX = 0;
    mobileInputRef.current.moveY = 0;
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    lookPrevRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    if (!lookPrevRef.current) return;
    const t = e.touches[0];
    mobileInputRef.current.lookDeltaX += t.clientX - lookPrevRef.current.x;
    mobileInputRef.current.lookDeltaY += t.clientY - lookPrevRef.current.y;
    lookPrevRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookEnd = () => {
    lookPrevRef.current = null;
  };

  const criticalHealth = hud.health > 0 && hud.health < 30;
  const binds = settings.keyBindings ?? DEFAULT_KEY_BINDINGS;
  const interactKeyLabel = formatKeyCode(binds.interact).toUpperCase();
  const flashlightKeyLabel = formatKeyCode(binds.flashlight);
  const panicLevel = Math.max(0, Math.min(1, hud.panic));
  const roundedHealth = Math.max(0, Math.round(hud.health));
  const roundedSanity = Math.max(0, Math.round(hud.sanity));
  const roundedBattery = Math.max(0, Math.ceil(hud.battery));
  const lowBattery = hud.battery < 35;
  const criticalBattery = hud.battery < 18;
  const lowSanity = hud.sanity < 55;
  const criticalSanity = hud.sanity < 25;
  const rawMadness = Math.max(0, Math.min(1, (85 - hud.sanity) / 85));
  const madness = rawMadness > 0 ? Math.pow(rawMadness, 1.2) : 0;
  const jumpscareActive =
    hud.jumpscareIntensity > 0.05 && (phase === 'playing' || phase === 'hiding');
  const fatalProgress =
    phase === 'playing' || phase === 'hiding' ? Math.max(0, Math.min(1, hud.fatalCutsceneProgress)) : 0;
  const inFatalCutscene = fatalProgress > 0.001;
  const eyeCrushBurst =
    fatalProgress >= 0.36 ? Math.max(0, Math.min(1, (fatalProgress - 0.36) / 0.16)) : 0;
  const bloodWaterFill =
    fatalProgress >= 0.48 ? Math.max(0, Math.min(1, (fatalProgress - 0.48) / 0.46)) : 0;

  return (
    <div
      className={`absolute inset-0 z-10 pointer-events-none select-none ${
        jumpscareActive && (!inFatalCutscene || fatalProgress < 0.64) ? 'animate-jumpscare-shake' : ''
      }`}
    >
      {/* High-intensity jumpscare strobe & crimson shock overlay */}
      {jumpscareActive && (
        <div
          className="absolute inset-0 animate-jumpscare-flash"
          style={{
            opacity: inFatalCutscene ? 0.55 + eyeCrushBurst * 0.45 : hud.jumpscareIntensity,
            background:
              'radial-gradient(circle at center, rgba(255,255,255,0.06) 10%, rgba(165, 14, 14, 0.58) 70%, rgba(0,0,0,0.88) 100%)',
            boxShadow:
              'inset 16px 0 36px rgba(239, 68, 68, 0.65), inset -16px 0 36px rgba(56, 189, 248, 0.35)',
          }}
        />
      )}

      {/* Fatal Eye-Crush Cutscene: Palm Clamp + Blood Splatter + Rising Red Blood Water */}
      {inFatalCutscene && (
        <div className="absolute inset-0 z-30 overflow-hidden pointer-events-none">
          {/* Eye-socket crush darkness clamping inward from left & right */}
          {eyeCrushBurst > 0 && (
            <>
              <div
                className="absolute inset-0"
                style={{
                  opacity: Math.min(0.92, eyeCrushBurst * 0.92),
                  background:
                    'radial-gradient(circle at center, rgba(145, 10, 14, 0.38) 8%, rgba(78, 4, 8, 0.72) 55%, rgba(6, 0, 2, 0.96) 100%)',
                }}
              />
              {/* Blood splatter & vertical crimson rivulets streaming from crushed eyes */}
              <div
                className="absolute inset-x-0 top-0 h-[55%] animate-blood-drip"
                style={{
                  backgroundImage:
                    'radial-gradient(ellipse 14% 48% at 32% 18%, rgba(185, 16, 20, 0.92) 0%, transparent 72%), radial-gradient(ellipse 16% 52% at 68% 16%, rgba(165, 12, 16, 0.92) 0%, transparent 74%), linear-gradient(90deg, transparent 22%, rgba(140, 8, 12, 0.78) 24%, transparent 26%, transparent 38%, rgba(190, 18, 22, 0.85) 40%, transparent 43%, transparent 57%, rgba(175, 14, 18, 0.82) 59%, transparent 62%, transparent 74%, rgba(150, 10, 14, 0.78) 76%, transparent 79%)',
                }}
              />
            </>
          )}

          {/* Rising Red Water-Like Blood Liquid filling the entire screen from bottom to top */}
          {bloodWaterFill > 0 && (
            <div
              className="absolute inset-x-0 bottom-0 h-[120%]"
              style={{
                transform: `translate3d(0, ${(102 - bloodWaterFill * 114).toFixed(2)}%, 0)`,
              }}
            >
              {/* Overlapping animated translucent liquid surface wave crests */}
              <div className="relative w-full h-24 overflow-hidden">
                <svg
                  viewBox="0 0 1440 120"
                  preserveAspectRatio="none"
                  className="absolute bottom-0 left-0 w-[200%] h-24 animate-blood-wave-a"
                >
                  <path
                    d="M0,44 C120,8 240,80 360,44 C480,8 600,80 720,44 C840,8 960,80 1080,44 C1200,8 1320,80 1440,44 L1440,120 L0,120 Z"
                    fill="rgba(220, 26, 32, 0.72)"
                  />
                </svg>
                <svg
                  viewBox="0 0 1440 120"
                  preserveAspectRatio="none"
                  className="absolute bottom-0 left-0 w-[200%] h-24 animate-blood-wave-b"
                >
                  <path
                    d="M0,56 C180,96 360,18 540,56 C720,96 900,18 1080,56 C1260,96 1350,30 1440,56 L1440,120 L0,120 Z"
                    fill="rgba(162, 12, 18, 0.88)"
                  />
                </svg>
                {/* Thin crimson highlight foam along meniscus */}
                <div
                  className="absolute bottom-0 inset-x-0 h-5"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(248, 113, 113, 0.24) 0%, rgba(162, 12, 18, 0.88) 100%)',
                  }}
                />
              </div>

              {/* Deep shimmering translucent red blood-water body */}
              <div
                className="w-full h-[calc(100%-6rem)]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(162, 12, 18, 0.9) 0%, rgba(110, 6, 12, 0.96) 42%, rgba(48, 2, 6, 0.99) 100%)',
                  boxShadow: 'inset 0 28px 65px rgba(248, 113, 113, 0.18)',
                }}
              />
            </div>
          )}
        </div>
      )}
      {/* Progressive sanity loss screen distortions & creeping black fog */}
      {madness > 0.01 && (phase === 'playing' || phase === 'hiding') && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle at center, rgba(0, 0, 0, ${(madness * 0.28).toFixed(2)}) ${Math.round(52 - madness * 34)}%, rgba(3, 3, 5, ${(0.28 + madness * 0.66).toFixed(2)}) 100%)`,
              boxShadow: `inset ${(madness * 9).toFixed(1)}px 0 ${(madness * 26).toFixed(1)}px rgba(220, 38, 38, ${(madness * 0.26).toFixed(2)}), inset -${(madness * 9).toFixed(1)}px 0 ${(madness * 26).toFixed(1)}px rgba(56, 189, 248, ${(madness * 0.22).toFixed(2)})`,
            }}
          />
          {/* Encroaching Black Fog Wisps closing in from edges as sanity drops */}
          <div
            className="absolute inset-0 animate-black-fog pointer-events-none"
            style={{
              opacity: Math.min(0.95, 0.16 + madness * 0.84),
              backgroundImage:
                'radial-gradient(ellipse 68% 54% at 14% 22%, rgba(2, 2, 4, 0.88) 0%, transparent 72%), radial-gradient(ellipse 64% 58% at 86% 78%, rgba(2, 2, 4, 0.9) 0%, transparent 72%), radial-gradient(ellipse 85% 42% at 50% 96%, rgba(0, 0, 0, 0.94) 0%, transparent 74%), radial-gradient(ellipse 80% 38% at 50% 4%, rgba(0, 0, 0, 0.88) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute inset-0 animate-sanity-scanlines"
            style={{
              opacity: madness * 0.38,
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 4px)',
              backgroundSize: '100% 8px',
            }}
          />
          {madness > 0.18 && (
            <div
              className="absolute inset-0 animate-sanity-warp"
              style={{
                opacity: Math.min(0.5, (madness - 0.18) * 0.65),
                backgroundImage:
                  'linear-gradient(180deg, transparent 14%, rgba(10, 10, 14, 0.45) 16%, transparent 18%, transparent 57%, rgba(239, 68, 68, 0.06) 59%, transparent 61%, transparent 82%, rgba(8, 8, 12, 0.48) 83.5%, transparent 85%)',
              }}
            />
          )}
        </>
      )}

      {/* Critical (<30%) pulsing blood-red edge vignette */}
      {criticalHealth && (phase === 'playing' || phase === 'hiding') && (
        <div
          className="absolute inset-0 animate-critical-vignette"
          style={{
            background:
              'radial-gradient(circle at center, transparent 42%, rgba(165, 16, 16, 0.56) 100%)',
          }}
        />
      )}

      {/* Progressive Panic Vignette: tightens slowly as the Stalker enters close radius */}
      {panicLevel > 0.01 && (phase === 'playing' || phase === 'hiding') && (
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: Math.min(1, 0.25 + panicLevel * 0.75),
            background: `radial-gradient(circle at center, transparent ${Math.round(64 - panicLevel * 40)}%, rgba(125, 12, 16, ${(panicLevel * 0.36).toFixed(2)}) ${Math.round(86 - panicLevel * 20)}%, rgba(8, 2, 4, ${(0.22 + panicLevel * 0.66).toFixed(2)}) 100%)`,
          }}
        />
      )}

      {/* Stalker 15-unit whisper hallucination: "I SEE YOU" */}
      {hud.iSeeYouIntensity > 0.02 && (phase === 'playing' || phase === 'hiding') && (
        <div
          className="absolute inset-x-0 top-[22%] flex justify-center pointer-events-none"
          style={{ opacity: Math.min(0.9, hud.iSeeYouIntensity * 0.85) }}
        >
          <div className="relative animate-sanity-tremor">
            <span className="font-ghost text-3xl sm:text-5xl tracking-[0.22em] text-[#DC2626] uppercase">
              I SEE YOU
            </span>
          </div>
        </div>
      )}

      {/* Subtle outer locker rim shadow leaving 3D eye-level peek gaps clear */}
      {hud.hiding && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(4,4,6,0.72) 0%, rgba(4,4,6,0.08) 14%, rgba(4,4,6,0.08) 86%, rgba(4,4,6,0.72) 100%)',
          }}
        />
      )}

      {/* Spawn cinematic black fade */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[2600ms] ease-out ${
          phase === 'intro_fade' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Minimal Top-Left Objective */}
      {(phase === 'playing' || phase === 'hiding' || phase === 'intro_fade') && !inFatalCutscene && (
        <div className="absolute top-5 left-5 max-w-sm">
          <div className="text-[11px] font-mono-code tracking-wider text-[#C8A24A] uppercase">
            Chapter 1 · Step {currentStep.stepNumber}: {currentStep.title}
          </div>
          <div className="mt-1 text-sm text-[#EAE6DF] leading-snug">{currentStep.objective}</div>
        </div>
      )}

      {/* Top-Right Pause & Click-to-Lock Hint */}
      {(phase === 'playing' || phase === 'hiding') && !inFatalCutscene && (
        <div className="absolute top-5 right-5 flex items-center gap-2 pointer-events-auto">
          {!settings.mobileControls && !hud.pointerLocked && !inspectedDoc && (
            <button
              type="button"
              onClick={() => actionsRef.current?.requestPointerLock()}
              className="px-3 py-1.5 text-xs font-medium text-[#09090B] bg-[#C8A24A] hover:bg-[#D9B65C] rounded whitespace-nowrap cursor-pointer"
            >
              Click Screen to Look
            </button>
          )}
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause"
            className="p-2 text-[#D6D1C7] bg-[#121216]/90 border border-white/10 hover:border-white/25 rounded cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Fixed Tiny White Center Dot (zero large crosshair) */}
      {(phase === 'playing' || phase === 'hiding') && !inspectedDoc && !inFatalCutscene && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="w-1 h-1 rounded-full bg-[#F5F5F0]" />
          {prompt && (
            <div className="mt-5 px-3 py-1 text-xs font-mono-code tracking-wide text-[#EAE6DF] bg-[#0B0B0E]/85 border border-white/12 rounded whitespace-nowrap">
              {settings.mobileControls ? prompt.mobileLabel : prompt.pcLabel}
            </div>
          )}
        </div>
      )}

      {/* Subtle transient status toast */}
      {statusToast && (phase === 'playing' || phase === 'hiding') && !inFatalCutscene && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 px-4 py-1.5 text-xs text-[#EAE6DF] bg-[#111115]/90 border border-[#C8A24A]/35 rounded whitespace-nowrap">
          {statusToast}
        </div>
      )}

      {/* Minimal Bottom-Center Survival & 6-Slot Inventory + Permanent Flashlight */}
      {(phase === 'playing' || phase === 'hiding') && !inFatalCutscene && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
          {/* Health UI (pulses with dynamic heartbeat below 30%) + Stamina / Crouch */}
          <div className="flex items-center gap-3 text-[11px] font-mono-code text-[#A39E93]">
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
                criticalHealth
                  ? 'animate-hp-heartbeat bg-[#240B0D]/90 border-[#EF4444]/75 text-[#FCA5A5]'
                  : hud.health < 65
                    ? 'bg-[#19140E]/85 border-[#C8A24A]/45 text-[#FCD34D]'
                    : 'bg-[#0E0E12]/80 border-white/10 text-[#D6D1C7]'
              }`}
            >
              <Heart
                className={`w-3 h-3 ${
                  criticalHealth
                    ? 'text-[#EF4444] fill-[#EF4444]'
                    : hud.health < 65
                      ? 'text-[#F59E0B]'
                      : 'text-[#A39E93]'
                }`}
              />
              <span>HP {roundedHealth}%</span>
              <div className="w-14 h-1 bg-[#1D1D24] rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    criticalHealth
                      ? 'bg-[#EF4444]'
                      : hud.health < 65
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#D6D1C7]/80'
                  }`}
                  style={{ width: `${roundedHealth}%` }}
                />
              </div>
            </div>

            {/* Sanity Meter */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
                criticalSanity
                  ? 'animate-sanity-tremor bg-[#200C28]/90 border-[#E879F9]/75 text-[#F5D0FE]'
                  : lowSanity
                    ? 'bg-[#171124]/85 border-[#A855F7]/50 text-[#DDD6FE]'
                    : 'bg-[#0E0E12]/80 border-white/10 text-[#D6D1C7]'
              }`}
            >
              <Brain
                className={`w-3 h-3 ${
                  criticalSanity
                    ? 'text-[#E879F9]'
                    : lowSanity
                      ? 'text-[#A855F7]'
                      : 'text-[#93C5FD]'
                }`}
              />
              <span>
                SAN {roundedSanity}
                {Math.round(hud.maxSanity) < 100 ? `/${Math.round(hud.maxSanity)}` : ''}%
              </span>
              <div className="relative w-14 h-1 bg-[#1D1D24] rounded overflow-hidden">
                {Math.round(hud.maxSanity) < 100 && (
                  <div
                    className="absolute inset-y-0 right-0 bg-[#09090B]/80 border-l border-[#EF4444]/60"
                    style={{ width: `${Math.max(0, 100 - Math.round(hud.maxSanity))}%` }}
                  />
                )}
                <div
                  className={`h-full transition-all duration-150 ${
                    criticalSanity
                      ? 'bg-[#E879F9]'
                      : lowSanity
                        ? 'bg-[#A855F7]'
                        : 'bg-[#93C5FD]/85'
                  }`}
                  style={{ width: `${roundedSanity}%` }}
                />
              </div>
            </div>

            {/* Battery Level Meter */}
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
                criticalBattery
                  ? 'animate-sanity-tremor bg-[#26120B]/90 border-[#EF4444]/75 text-[#FCA5A5]'
                  : lowBattery
                    ? 'bg-[#1D160B]/85 border-[#F59E0B]/55 text-[#FDE68A]'
                    : 'bg-[#0E0E12]/80 border-white/10 text-[#D6D1C7]'
              }`}
            >
              <BatteryCharging
                className={`w-3 h-3 ${
                  criticalBattery
                    ? 'text-[#EF4444]'
                    : lowBattery
                      ? 'text-[#F59E0B]'
                      : 'text-[#C8A24A]'
                }`}
              />
              <span>BAT {roundedBattery}%</span>
              <div className="w-14 h-1 bg-[#1D1D24] rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    criticalBattery
                      ? 'bg-[#EF4444]'
                      : lowBattery
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#C8A24A]/90'
                  }`}
                  style={{ width: `${Math.min(100, roundedBattery)}%` }}
                />
              </div>
            </div>

            {hud.stamina < 98 && (
              <div className="w-24 h-1 bg-[#1D1D24] rounded overflow-hidden">
                <div
                  className="h-full bg-[#EAE6DF]/75 transition-all duration-100"
                  style={{ width: `${Math.round(hud.stamina)}%` }}
                />
              </div>
            )}
            {hud.crouching && !hud.sliding && <span className="text-[#C8A24A]">CROUCH</span>}
            {hud.sliding && <span className="text-[#93C5FD]">SLIDE</span>}
            {hud.hiding && (
              <span className="text-[#93C5FD]">HIDING · PRESS {interactKeyLabel} TO EXIT</span>
            )}
          </div>

          {/* Permanent Flashlight Slot + 6 Inventory Slots */}
          <div className="flex items-center gap-1.5 p-1.5 bg-[#0C0C0F]/90 border border-white/10 rounded">
            {/* Permanent Flashlight Slot */}
            <button
              type="button"
              onClick={() => actionsRef.current?.toggleFlashlight()}
              className={`relative flex flex-col items-center justify-center w-14 h-12 rounded border text-[10px] font-mono-code transition-colors cursor-pointer overflow-hidden ${
                hud.flashlightOn
                  ? hud.hasBetterFlashlight
                    ? 'bg-[#151A22] border-[#93C5FD]/70 text-[#EAE6DF]'
                    : 'bg-[#1D1B14] border-[#C8A24A]/70 text-[#EAE6DF]'
                  : 'bg-[#121216] border-white/10 text-[#8E8A7E]'
              }`}
              title={
                hud.hasBetterFlashlight
                  ? `Heavy-Duty Tactical Flashlight (${flashlightKeyLabel})`
                  : `Toggle Flashlight (${flashlightKeyLabel})`
              }
            >
              {hud.hasBetterFlashlight && (
                <span className="absolute top-0.5 right-1 text-[8px] font-mono-code text-[#93C5FD]">
                  TAC
                </span>
              )}
              <Flashlight className="w-3.5 h-3.5 mb-0.5" />
              <span className={criticalBattery ? 'text-[#EF4444]' : lowBattery ? 'text-[#F59E0B]' : ''}>
                {roundedBattery}%
              </span>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D1D24]">
                <div
                  className={`h-full transition-all duration-150 ${
                    criticalBattery ? 'bg-[#EF4444]' : lowBattery ? 'bg-[#F59E0B]' : 'bg-[#C8A24A]'
                  }`}
                  style={{ width: `${Math.min(100, roundedBattery)}%` }}
                />
              </div>
            </button>

            <div className="w-px h-8 bg-white/10 mx-0.5" />

            {/* 6 Small Inventory Slots */}
            {inventory.map((item, idx) => {
              const selected = activeSlot === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectSlot(idx);
                    actionsRef.current?.useSlot(idx);
                  }}
                  className={`relative flex flex-col items-center justify-center w-14 h-12 px-1 rounded border text-[10px] transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#1C1B18] border-[#C8A24A] text-[#EAE6DF]'
                      : 'bg-[#121216] border-white/10 text-[#A39E93] hover:border-white/25'
                  }`}
                  title={item ? `${item.name}: ${item.description}` : `Empty Slot ${idx + 1}`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-mono-code text-[#6E6A60]">
                    {idx + 1}
                  </span>
                  <span className="truncate w-full text-center font-medium leading-tight mt-1">
                    {item ? (item.id === 'battery' ? 'Battery' : item.name.split(' ').slice(-1)[0]) : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Touch Controls Overlay */}
      {settings.mobileControls && (phase === 'playing' || phase === 'hiding') && (
        <>
          {/* Right-half touch look zone */}
          <div
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
            className="absolute right-0 top-16 bottom-24 w-1/2 pointer-events-auto"
          />

          {/* Left thumbstick */}
          <div
            onTouchStart={handleJoyStart}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            className="absolute left-6 bottom-24 w-24 h-24 rounded-full bg-[#141418]/75 border border-white/20 flex items-center justify-center pointer-events-auto"
          >
            <div className="w-9 h-9 rounded-full bg-[#EAE6DF]/40" />
          </div>

          {/* Right action buttons */}
          <div className="absolute right-5 bottom-24 flex flex-col gap-2.5 pointer-events-auto">
            {prompt && (
              <button
                type="button"
                onClick={() => actionsRef.current?.interact()}
                className="px-4 py-3 text-xs font-semibold bg-[#C8A24A] text-[#09090B] rounded min-h-[44px]"
              >
                INTERACT
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => actionsRef.current?.toggleFlashlight()}
                className="px-3.5 py-2.5 text-xs font-medium bg-[#141418]/90 text-[#EAE6DF] border border-white/20 rounded min-h-[44px]"
              >
                LIGHT
              </button>
              <button
                type="button"
                onClick={() => actionsRef.current?.toggleCrouch()}
                className="px-3.5 py-2.5 text-xs font-medium bg-[#141418]/90 text-[#EAE6DF] border border-white/20 rounded min-h-[44px]"
              >
                CROUCH
              </button>
              <button
                type="button"
                onClick={() => actionsRef.current?.triggerSlide()}
                className="px-3.5 py-2.5 text-xs font-medium bg-[#141418]/90 text-[#EAE6DF] border border-white/20 rounded min-h-[44px]"
              >
                SLIDE
              </button>
              <button
                type="button"
                onTouchStart={() => {
                  mobileInputRef.current.sprinting = true;
                }}
                onTouchEnd={() => {
                  mobileInputRef.current.sprinting = false;
                }}
                className="px-3.5 py-2.5 text-xs font-medium bg-[#141418]/90 text-[#EAE6DF] border border-white/20 rounded min-h-[44px]"
              >
                SPRINT
              </button>
            </div>
          </div>
        </>
      )}

      {/* Lore Note / Memory Tape Inspection Modal */}
      {inspectedDoc && (
        <div
          key={inspectedDoc.title}
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/82 pointer-events-auto animate-lore-backdrop"
        >
          <div className="max-w-lg w-full bg-[#131317] border border-[#C8A24A]/50 rounded-md p-6 shadow-[0_0_50px_rgba(200,162,74,0.14)] animate-lore-card">
            <div className="flex items-center gap-2 text-[10px] font-mono-code tracking-widest text-[#8E8A7E] uppercase">
              <FileText className="w-3.5 h-3.5 text-[#C8A24A]" />
              <span>{inspectedDoc.subtitle ?? 'Recovered Backrooms Document'}</span>
            </div>
            <div className="mt-2 text-sm font-mono-code font-semibold text-[#C8A24A]">
              {inspectedDoc.title}
            </div>
            <div className="animate-lore-body">
              <p className="mt-3 text-sm text-[#EAE6DF] leading-relaxed whitespace-pre-line">
                {inspectedDoc.body}
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onCloseDoc}
                  className="px-5 py-2 text-xs font-semibold bg-[#C8A24A] hover:bg-[#D9B65C] text-[#09090B] rounded cursor-pointer transition-colors"
                >
                  Resume
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Menu */}
      {phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/85 pointer-events-auto">
          <div className="w-full max-w-xs bg-[#121216] border border-white/12 rounded p-6 space-y-3">
            <div className="flex justify-center mb-1">
              <img
                src="/assets/aistudio/Something_in_the_Yellow_Hallway_da2d5601.png"
                alt="SOMETHING IS THERE logo"
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded border border-white/10 bg-black object-contain"
              />
            </div>
            <h2 className="font-display text-xl text-[#EAE6DF] text-center mb-4">Paused</h2>
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2.5 text-sm font-semibold bg-[#C8A24A] text-[#09090B] rounded cursor-pointer"
            >
              Resume Game
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="w-full py-2.5 text-sm font-medium bg-[#18181D] text-[#A39E93] border border-white/10 rounded cursor-pointer"
            >
              Return to Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Death Screen fallback without ghost photo image */}
      {phase === 'dead' && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 pointer-events-auto overflow-hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(64, 5, 10, 0.98) 0%, rgba(28, 2, 5, 0.99) 55%, #070102 100%)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at center, rgba(140, 12, 18, 0.24) 0%, rgba(20, 2, 4, 0.85) 100%)',
            }}
          />
          <div className="relative z-10 flex flex-col items-center">
            <div className="text-xs font-mono-code tracking-[0.24em] text-[#B91C1C] uppercase">
              Signal Lost
            </div>
            <h2 className="mt-3 font-display text-4xl text-[#EAE6DF]">YOU WERE FOUND</h2>
            <p className="mt-3 text-sm text-[#A39E93] text-center max-w-md">{deathReason}</p>
            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={onRetryCheckpoint}
                className="px-6 py-2.5 text-sm font-semibold bg-[#C8A24A] text-[#09090B] hover:bg-[#D9B65C] rounded cursor-pointer"
              >
                Retry Checkpoint
              </button>
              <button
                type="button"
                onClick={onReturnToMenu}
                className="px-6 py-2.5 text-sm font-medium bg-[#17171C] text-[#EAE6DF] border border-white/15 rounded cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapter 1 Complete Screen */}
      {phase === 'chapter_complete' && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 bg-[#09090B] pointer-events-auto">
          <div className="text-xs font-mono-code tracking-[0.22em] text-[#C8A24A] uppercase">
            Chapter 1 Complete
          </div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl text-[#EAE6DF] text-center">
            BACK IN OUR WORLD
          </h2>
          <p className="mt-4 text-sm text-[#A39E93] text-center max-w-lg leading-relaxed">
            You turn the Old Brass Key and push the heavy Exit Door wide, stepping out of the suffocating black fog into warm morning sunlight. Behind you, the doorway vanishes—leaving only the hum of quiet grass and fresh air in our world.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-6 py-2.5 text-sm font-semibold bg-[#C8A24A] text-[#09090B] hover:bg-[#D9B65C] rounded cursor-pointer"
            >
              Play Chapter 1 Again
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="px-6 py-2.5 text-sm font-medium bg-[#17171C] text-[#EAE6DF] border border-white/15 rounded cursor-pointer"
            >
              Return to Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
