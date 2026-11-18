import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivePrompt,
  CheckpointSave,
  DEFAULT_KEY_BINDINGS,
  GamePhase,
  GameSettings,
  InspectedDocument,
  InventoryItem,
} from './types/game';
import { HorrorAudioEngine } from './audio/horrorAudio';
import {
  BackroomsCanvas,
  GameActionsRef,
  LiveHudSnapshot,
  MobileInputState,
} from './components/BackroomsCanvas';
import { MainMenu } from './components/MainMenu';
import { GameHUD } from './components/GameHUD';

const SAVE_STORAGE_KEY = 'something_is_there_checkpoint_v1';
const SETTINGS_STORAGE_KEY = 'something_is_there_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  masterVolume: 0.7,
  fov: 74,
  mobileControls:
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  keyBindings: DEFAULT_KEY_BINDINGS,
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        keyBindings: {
          ...DEFAULT_KEY_BINDINGS,
          ...(parsed.keyBindings ?? {}),
        },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [savedCheckpoint, setSavedCheckpoint] = useState<CheckpointSave | null>(() => {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CheckpointSave) : null;
    } catch {
      return null;
    }
  });

  const [inventory, setInventory] = useState<(InventoryItem | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [prompt, setPrompt] = useState<ActivePrompt | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [deathReason, setDeathReason] = useState<string>('Something caught you in the fog.');
  const [inspectedDoc, setInspectedDoc] = useState<InspectedDocument | null>(null);

  const [hud, setHud] = useState<LiveHudSnapshot>({
    health: 100,
    sanity: 100,
    maxSanity: 100,
    stamina: 100,
    battery: 100,
    flashlightOn: true,
    hasBetterFlashlight: false,
    crouching: false,
    sliding: false,
    hiding: false,
    stalkerDistance: 40,
    stalkerState: 'patrol',
    stepIndex: 1,
    pointerLocked: false,
    jumpscareIntensity: 0,
    panic: 0,
    iSeeYouIntensity: 0,
    fatalCutsceneProgress: 0,
  });

  const audio = useMemo(() => new HorrorAudioEngine(), []);
  const actionsRef = useRef<GameActionsRef | null>(null);
  const mobileInputRef = useRef<MobileInputState>({
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    sprinting: false,
  });

  const toastTimerRef = useRef<number | null>(null);
  const [lobbyMuted, setLobbyMuted] = useState<boolean>(false);
  const [audioActive, setAudioActive] = useState<boolean>(false);

  useEffect(() => {
    const effectiveVolume = phase === 'menu' && lobbyMuted ? 0 : settings.masterVolume;
    audio.setVolume(effectiveVolume);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota issues
    }
  }, [settings, audio, phase, lobbyMuted]);

  useEffect(() => {
    audio.setLobbyMode(phase === 'menu');
    if (phase !== 'menu') return;

    audio.init();
    setAudioActive(audio.isAudioRunning());

    const unlockLobbyAudio = () => {
      if (audio.isAudioRunning()) {
        setAudioActive(true);
        return;
      }
      void audio.resumeContext().then((running) => {
        setAudioActive(running);
      });
    };

    window.addEventListener('pointerdown', unlockLobbyAudio, { passive: true });
    window.addEventListener('keydown', unlockLobbyAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockLobbyAudio);
      window.removeEventListener('keydown', unlockLobbyAudio);
    };
  }, [phase, audio]);

  useEffect(() => {
    return () => {
      audio.dispose();
    };
  }, [audio]);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setStatusToast(null), 3200);
  }, []);

  const startGameSession = useCallback(
    (checkpoint: CheckpointSave | null) => {
      audio.setLobbyMode(false);
      audio.init();
      void audio.resumeContext().then((running) => setAudioActive(running));
      audio.setVolume(settings.masterVolume);
      setInventory(checkpoint?.inventory ?? [null, null, null, null, null, null]);
      setActiveSlot(0);
      setPrompt(null);
      setInspectedDoc(null);
      actionsRef.current?.resetFromCheckpoint(checkpoint);
      setPhase('intro_fade');
      actionsRef.current?.requestPointerLock();

      window.setTimeout(() => {
        setPhase((prev) => (prev === 'intro_fade' ? 'playing' : prev));
      }, 2400);
    },
    [audio, settings.masterVolume],
  );

  const handleToggleLobbyAudio = useCallback(() => {
    if (!audio.isAudioRunning()) {
      void audio.resumeContext().then((running) => {
        setAudioActive(running);
        setLobbyMuted(false);
        audio.setVolume(settings.masterVolume);
        audio.playMenuSfx('click');
      });
      return;
    }
    const nextMuted = !lobbyMuted;
    setLobbyMuted(nextMuted);
    audio.setVolume(nextMuted ? 0 : settings.masterVolume);
    if (!nextMuted) {
      audio.playMenuSfx('click');
    }
  }, [audio, lobbyMuted, settings.masterVolume]);

  const handleNewGame = useCallback(() => {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    setSavedCheckpoint(null);
    startGameSession(null);
  }, [startGameSession]);

  const handleContinue = useCallback(() => {
    if (!savedCheckpoint) return;
    startGameSession(savedCheckpoint);
  }, [savedCheckpoint, startGameSession]);

  const handleStepAdvance = useCallback(
    (nextStep: number, save: CheckpointSave) => {
      setSavedCheckpoint(save);
      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
      } catch {
        // Ignore storage errors
      }
      showToast(`Checkpoint Saved — Step ${nextStep}`);
    },
    [showToast],
  );

  const handleHidingChange = useCallback((isHiding: boolean) => {
    setPhase((prev) => {
      if (prev === 'playing' && isHiding) return 'hiding';
      if (prev === 'hiding' && !isHiding) return 'playing';
      return prev;
    });
  }, []);

  const handlePlayerCaught = useCallback(
    (reason: string) => {
      if (document.pointerLockElement) document.exitPointerLock?.();
      setDeathReason(reason);
      setInspectedDoc(null);
      setPrompt(null);
      setHud((prev) => ({
        ...prev,
        health: 0,
        sanity: 0,
        maxSanity: 0,
        fatalCutsceneProgress: 0,
        jumpscareIntensity: 0,
      }));
      setPhase('menu');
      showToast(reason);
    },
    [showToast],
  );

  const handleRetryCheckpoint = useCallback(() => {
    startGameSession(savedCheckpoint);
  }, [savedCheckpoint, startGameSession]);

  const handleInspectDocument = useCallback((title: string, body: string) => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    setInspectedDoc({ title, body });
  }, []);

  const handleReturnToMenu = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    setInspectedDoc(null);
    setPhase('menu');
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#09090B]">
      <BackroomsCanvas
        phase={phase}
        settings={settings}
        audio={audio}
        inventory={inventory}
        activeSlot={activeSlot}
        mobileInputRef={mobileInputRef}
        actionsRef={actionsRef}
        onHudSnapshot={setHud}
        onPromptChange={setPrompt}
        onInventoryChange={setInventory}
        onStepAdvance={handleStepAdvance}
        onStatusToast={showToast}
        onInspectDocument={handleInspectDocument}
        onHidingChange={handleHidingChange}
        onPlayerCaught={handlePlayerCaught}
        onChapterComplete={() => setPhase('chapter_complete')}
        onPauseRequest={() => {
          if (document.pointerLockElement) document.exitPointerLock?.();
          setPhase((prev) => (prev === 'playing' || prev === 'hiding' ? 'paused' : prev));
        }}
      />

      {phase === 'menu' && (
        <MainMenu
          savedCheckpoint={savedCheckpoint}
          settings={settings}
          lobbyAudioActive={!lobbyMuted && audioActive}
          lobbyMuted={lobbyMuted}
          onToggleLobbyAudio={handleToggleLobbyAudio}
          onMenuSfx={(kind) => audio.playMenuSfx(kind)}
          onUpdateSettings={setSettings}
          onNewGame={handleNewGame}
          onContinue={handleContinue}
        />
      )}

      {phase !== 'menu' && (
        <GameHUD
          phase={phase}
          hud={hud}
          prompt={prompt}
          inventory={inventory}
          activeSlot={activeSlot}
          statusToast={statusToast}
          deathReason={deathReason}
          inspectedDoc={inspectedDoc}
          settings={settings}
          mobileInputRef={mobileInputRef}
          actionsRef={actionsRef}
          onSelectSlot={setActiveSlot}
          onCloseDoc={() => {
            setInspectedDoc(null);
            actionsRef.current?.requestPointerLock();
          }}
          onPause={() => {
            if (document.pointerLockElement) document.exitPointerLock?.();
            setPhase('paused');
          }}
          onResume={() => {
            setPhase(hud.hiding ? 'hiding' : 'playing');
            actionsRef.current?.requestPointerLock();
          }}
          onRetryCheckpoint={handleRetryCheckpoint}
          onReturnToMenu={handleReturnToMenu}
          onPlayAgain={handleNewGame}
        />
      )}
    </div>
  );
}
