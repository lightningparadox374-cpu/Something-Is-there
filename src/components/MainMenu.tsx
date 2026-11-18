import React, { useEffect, useState } from 'react';
import { CHAPTER_BLUEPRINTS, ENTITY_CODEX } from '../data/chaptersAndCodex';
import {
  CheckpointSave,
  DEFAULT_KEY_BINDINGS,
  GameSettings,
  KeyBindingAction,
  formatKeyCode,
} from '../types/game';
import { exportStalkerCreatureGlb, exportTacticalFlashlightGlb } from '../game/proceduralAssets';
import { BookOpen, ChevronRight, Download, Eye, Image as ImageIcon, Keyboard, Play, RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react';
import backroomsGhostImg from '../assets/images/backrooms_ghost_entity_1794809649305.jpg';
import gameThumbnailImg from '../assets/images/game_thumbnail_1794912668456.jpg';

const KEY_CONTROL_ITEMS: { action: KeyBindingAction; label: string; hint: string }[] = [
  { action: 'walkForward', label: 'Walk Forward', hint: 'Move ahead down corridors' },
  { action: 'walkBackward', label: 'Walk Backward', hint: 'Step back while keeping sight' },
  { action: 'moveLeft', label: 'Move Left', hint: 'Strafe left around corners' },
  { action: 'moveRight', label: 'Move Right', hint: 'Strafe right around corners' },
  { action: 'run', label: 'Run / Sprint', hint: 'Hold to sprint (drains stamina)' },
  { action: 'crouch', label: 'Crouch', hint: 'Toggle silent low-profile movement' },
  { action: 'slide', label: 'Slide', hint: 'Burst tactical dash-slide along floor' },
  { action: 'interact', label: 'Interact', hint: 'Pick up items, open doors, hide in lockers' },
  { action: 'flashlight', label: 'Flashlight', hint: 'Toggle beam on or off' },
];

const GAME_LOGO_SRC = '/assets/aistudio/Something_in_the_Yellow_Hallway_da2d5601.png';

interface MainMenuProps {
  savedCheckpoint: CheckpointSave | null;
  settings: GameSettings;
  lobbyAudioActive: boolean;
  lobbyMuted: boolean;
  onToggleLobbyAudio: () => void;
  onMenuSfx?: (kind: 'hover' | 'click') => void;
  onUpdateSettings: (next: GameSettings) => void;
  onNewGame: () => void;
  onContinue: () => void;
}

type MenuModal = 'none' | 'chapters' | 'entities' | 'settings' | 'credits' | 'thumbnail';

export const MainMenu: React.FC<MainMenuProps> = ({
  savedCheckpoint,
  settings,
  lobbyAudioActive,
  lobbyMuted,
  onToggleLobbyAudio,
  onMenuSfx,
  onUpdateSettings,
  onNewGame,
  onContinue,
}) => {
  const [modal, setModal] = useState<MenuModal>('none');
  const [exportingCreature, setExportingCreature] = useState(false);
  const [exportingFlashlight, setExportingFlashlight] = useState(false);
  const [listeningAction, setListeningAction] = useState<KeyBindingAction | null>(null);

  useEffect(() => {
    if (!listeningAction || modal !== 'settings') return;
    const onKeyCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListeningAction(null);
        return;
      }
      const nextBindings = { ...DEFAULT_KEY_BINDINGS, ...settings.keyBindings };
      const prevCode = nextBindings[listeningAction];
      // Swap if the key is already assigned to another action so no binding becomes dead
      (Object.keys(nextBindings) as KeyBindingAction[]).forEach((act) => {
        if (act !== listeningAction && nextBindings[act] === e.code) {
          nextBindings[act] = prevCode;
        }
      });
      nextBindings[listeningAction] = e.code;
      onUpdateSettings({ ...settings, keyBindings: nextBindings });
      onMenuSfx?.('click');
      setListeningAction(null);
    };
    window.addEventListener('keydown', onKeyCapture, true);
    return () => window.removeEventListener('keydown', onKeyCapture, true);
  }, [listeningAction, modal, settings, onUpdateSettings, onMenuSfx]);

  const handleExportCreatureGlb = async () => {
    if (exportingCreature) return;
    setExportingCreature(true);
    try {
      const blob = await exportStalkerCreatureGlb();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stalker-horror-creature.glb';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExportingCreature(false);
    }
  };

  const handleExportFlashlightGlb = async () => {
    if (exportingFlashlight) return;
    setExportingFlashlight(true);
    try {
      const blob = await exportTacticalFlashlightGlb();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tactical-flashlight.glb';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExportingFlashlight(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between gap-6 p-6 md:p-12 overflow-y-auto pointer-events-auto bg-gradient-to-r from-[#09090B]/92 via-[#09090B]/65 to-transparent">
      {/* Top quiet header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs tracking-[0.22em] text-[#8E8A7E] uppercase whitespace-nowrap">
          Single-Player Psychological Survival Horror
        </div>
        <button
          type="button"
          onClick={onToggleLobbyAudio}
          onMouseEnter={() => onMenuSfx?.('hover')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[36px] text-xs font-mono-code rounded border transition-colors whitespace-nowrap cursor-pointer ${
            lobbyAudioActive
              ? 'bg-[#141418] text-[#C8A24A] border-[#C8A24A]/45 hover:border-[#C8A24A]'
              : 'bg-[#141418] text-[#A39E93] border-white/15 hover:border-white/35 hover:text-[#EAE6DF]'
          }`}
          aria-label={lobbyMuted ? 'Unmute lobby horror audio' : 'Toggle lobby horror audio'}
        >
          {lobbyAudioActive ? (
            <Volume2 className="w-3.5 h-3.5 text-[#C8A24A]" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-[#8E8A7E]" />
          )}
          <span>
            {lobbyMuted
              ? 'Lobby Audio: Muted'
              : lobbyAudioActive
                ? 'Lobby Audio: On'
                : 'Enable Horror Audio'}
          </span>
        </button>
      </div>

      {/* Center / Left Editorial Logo & Primary Actions */}
      <div className="max-w-xl my-auto py-3">
        <h1 className="sr-only">SOMETHING IS THERE</h1>
        <div className="inline-block overflow-hidden rounded-lg border border-white/12 bg-black shadow-[0_0_40px_rgba(220,38,38,0.2)]">
          <img
            src={GAME_LOGO_SRC}
            alt="SOMETHING IS THERE official game logo"
            referrerPolicy="no-referrer"
            className="w-44 sm:w-52 h-auto aspect-square object-contain block"
          />
        </div>
        <p className="mt-3 text-base md:text-lg text-[#C8A24A] tracking-wide font-medium">
          &ldquo;You are not alone.&rdquo;
        </p>
        <p className="mt-2 text-sm text-[#A39E93] leading-relaxed max-w-md">
          Trapped inside an endless yellow-lit reality with a single dying flashlight. Search for escape tools, stay quiet in the fog, and avoid what hunts the corridors.
        </p>

        {/* Primary Menu Stack */}
        <div className="mt-5 flex flex-col items-start gap-2.5 w-full max-w-xs">
          <button
            type="button"
            onMouseEnter={() => onMenuSfx?.('hover')}
            onClick={() => {
              onMenuSfx?.('click');
              onNewGame();
            }}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-[#09090B] bg-[#C8A24A] hover:bg-[#D9B65C] rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="inline-flex items-center gap-2.5">
              <Play className="w-4 h-4 fill-current" />
              <span>New Game</span>
            </span>
            <span className="text-xs font-mono-code opacity-80">Chapter 1</span>
          </button>

          <button
            type="button"
            disabled={!savedCheckpoint}
            onMouseEnter={() => {
              if (savedCheckpoint) onMenuSfx?.('hover');
            }}
            onClick={() => {
              if (!savedCheckpoint) return;
              onMenuSfx?.('click');
              onContinue();
            }}
            className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium rounded border transition-colors whitespace-nowrap ${
              savedCheckpoint
                ? 'bg-[#141418] text-[#EAE6DF] border-white/15 hover:border-[#C8A24A]/60 cursor-pointer'
                : 'bg-[#111114]/60 text-[#5C584F] border-white/5 cursor-not-allowed'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4" />
              <span>Continue</span>
            </span>
            <span className="text-xs font-mono-code">
              {savedCheckpoint ? `Ch.${savedCheckpoint.chapter} Step ${savedCheckpoint.stepIndex}` : 'No Save'}
            </span>
          </button>

          <button
            type="button"
            onMouseEnter={() => onMenuSfx?.('hover')}
            onClick={() => {
              onMenuSfx?.('click');
              setModal('chapters');
            }}
            className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium text-[#D6D1C7] bg-[#121216]/90 border border-white/10 hover:border-white/25 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="inline-flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-[#8E8A7E]" />
              <span>Chapters</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#8E8A7E]" />
          </button>

          <button
            type="button"
            onMouseEnter={() => onMenuSfx?.('hover')}
            onClick={() => {
              onMenuSfx?.('click');
              setModal('entities');
            }}
            className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium text-[#D6D1C7] bg-[#121216]/90 border border-white/10 hover:border-white/25 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="inline-flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-[#8E8A7E]" />
              <span>Entity Sighting</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#8E8A7E]" />
          </button>

          <button
            type="button"
            onMouseEnter={() => onMenuSfx?.('hover')}
            onClick={() => {
              onMenuSfx?.('click');
              setModal('settings');
            }}
            className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium text-[#D6D1C7] bg-[#121216]/90 border border-white/10 hover:border-white/25 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="inline-flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-[#8E8A7E]" />
              <span>Settings</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#8E8A7E]" />
          </button>

          <button
            type="button"
            onMouseEnter={() => onMenuSfx?.('hover')}
            onClick={() => {
              onMenuSfx?.('click');
              setModal('credits');
            }}
            className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium text-[#D6D1C7] bg-[#121216]/90 border border-white/10 hover:border-white/25 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Credits</span>
            <ChevronRight className="w-4 h-4 text-[#8E8A7E]" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Hint & Game Thumbnail Preview Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8E8A7E] font-mono-code">
          <span>WASD Move</span>
          <span aria-hidden="true">·</span>
          <span>Shift Sprint</span>
          <span aria-hidden="true">·</span>
          <span>C Crouch</span>
          <span aria-hidden="true">·</span>
          <span>F Flashlight</span>
          <span aria-hidden="true">·</span>
          <span>E Interact</span>
          <span aria-hidden="true">·</span>
          <span>1–6 Use Item</span>
        </div>

        <button
          type="button"
          onMouseEnter={() => onMenuSfx?.('hover')}
          onClick={() => {
            onMenuSfx?.('click');
            setModal('thumbnail');
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[34px] text-xs font-mono-code text-[#D6D1C7] bg-[#141418]/95 border border-white/15 hover:border-[#C8A24A]/60 rounded transition-colors cursor-pointer whitespace-nowrap"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#C8A24A]" />
          <span>Game Thumbnail</span>
        </button>
      </div>

      {/* Modal Overlay */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#111115] border border-white/12 rounded-md p-6 md:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="font-display text-xl text-[#EAE6DF]">
                {modal === 'chapters' && 'Story Chapters'}
                {modal === 'entities' && 'Entity Dossier — Recovered Footage'}
                {modal === 'settings' && 'Settings'}
                {modal === 'credits' && 'Credits'}
                {modal === 'thumbnail' && 'Official Game Thumbnail'}
              </h2>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="px-3 py-1.5 text-xs font-medium text-[#D6D1C7] bg-[#1B1B21] hover:bg-[#26262E] rounded cursor-pointer"
              >
                Close
              </button>
            </div>

            {modal === 'chapters' && (
              <div className="mt-5 space-y-4">
                {CHAPTER_BLUEPRINTS.map((ch) => (
                  <div
                    key={ch.chapterNumber}
                    className="p-4 bg-[#16161B] border border-white/8 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs text-[#8E8A7E] font-mono-code">
                        Chapter 0{ch.chapterNumber} · {ch.steps.length} Steps
                      </div>
                      <div className="mt-1 text-base font-semibold text-[#EAE6DF]">{ch.title}</div>
                      <p className="mt-1 text-xs text-[#A39E93]">{ch.environmentMood}</p>
                    </div>
                    {ch.playableInDemo ? (
                      <button
                        type="button"
                        onClick={() => {
                          setModal('none');
                          onNewGame();
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-[#C8A24A] text-[#09090B] hover:bg-[#D9B65C] rounded whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Play Chapter 1
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 text-xs font-mono-code bg-[#16161C] text-[#6E6A60] border border-white/8 rounded whitespace-nowrap shrink-0">
                        Coming Soon
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {modal === 'entities' && (
              <div className="mt-5 space-y-5">
                <div className="overflow-hidden rounded border border-white/10 bg-[#0A0A0C]">
                  <img
                    src={backroomsGhostImg}
                    alt="Recovered found-footage photograph of the Backrooms Ghost Entity emerging from black fog"
                    referrerPolicy="no-referrer"
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono-code text-[#C8A24A] uppercase tracking-wider">
                      Exhibit #01 · Sector 04 Sighting
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#8E8A7E] font-mono-code">
                        Entity Classification: The Stalker
                      </span>
                      <button
                        type="button"
                        disabled={exportingCreature}
                        onClick={() => void handleExportCreatureGlb()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C8A24A] hover:bg-[#D9B65C] disabled:opacity-60 text-[#09090B] rounded transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{exportingCreature ? 'Exporting .glb...' : 'Export 3D (.glb)'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {ENTITY_CODEX.map((entity) => (
                    <div
                      key={entity.name}
                      className="p-4 bg-[#16161B] border border-white/8 rounded space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#EAE6DF]">{entity.name}</span>
                        <span className="text-[11px] font-mono-code text-[#C8A24A]">
                          {entity.chapterDebut}
                        </span>
                      </div>
                      <p className="text-xs text-[#A39E93] leading-relaxed">
                        {entity.behaviorSummary}
                      </p>
                      <div className="pt-1 text-[11px] text-[#8E8A7E] space-y-0.5">
                        <div>
                          <span className="text-[#D6D1C7]">Detection:</span> {entity.detectionMethod}
                        </div>
                        <div>
                          <span className="text-[#D6D1C7]">Survival Note:</span> {entity.weakness}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modal === 'settings' && (
              <div className="mt-6 space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="inline-flex items-center gap-2 text-[#EAE6DF]">
                      <Volume2 className="w-4 h-4 text-[#C8A24A]" />
                      Master Volume
                    </span>
                    <span className="font-mono-code text-xs text-[#A39E93]">
                      {Math.round(settings.masterVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.masterVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, masterVolume: Number(e.target.value) })
                    }
                    className="w-full accent-[#C8A24A]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#EAE6DF]">Look Sensitivity</span>
                    <span className="font-mono-code text-xs text-[#A39E93]">
                      {settings.mouseSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={2.5}
                    step={0.1}
                    value={settings.mouseSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, mouseSensitivity: Number(e.target.value) })
                    }
                    className="w-full accent-[#C8A24A]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#EAE6DF]">Field of View (FOV)</span>
                    <span className="font-mono-code text-xs text-[#A39E93]">{settings.fov}°</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={95}
                    step={1}
                    value={settings.fov}
                    onChange={(e) => onUpdateSettings({ ...settings, fov: Number(e.target.value) })}
                    className="w-full accent-[#C8A24A]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div>
                    <div className="text-sm font-medium text-[#EAE6DF]">On-Screen Mobile Touch Controls</div>
                    <div className="text-xs text-[#8E8A7E]">
                      Enables virtual thumbstick, touch look pad, and tap buttons.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, mobileControls: !settings.mobileControls })
                    }
                    className={`px-4 py-2 text-xs font-semibold rounded border cursor-pointer ${
                      settings.mobileControls
                        ? 'bg-[#C8A24A] text-[#09090B] border-[#C8A24A]'
                        : 'bg-[#19191F] text-[#D6D1C7] border-white/15'
                    }`}
                  >
                    {settings.mobileControls ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Keyboard Controls & Movement Bindings */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[#EAE6DF]">
                      <Keyboard className="w-4 h-4 text-[#C8A24A]" />
                      <span>Keyboard Keys Control</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setListeningAction(null);
                        onUpdateSettings({
                          ...settings,
                          keyBindings: { ...DEFAULT_KEY_BINDINGS },
                        });
                        onMenuSfx?.('click');
                      }}
                      className="px-2.5 py-1 text-[11px] font-mono-code text-[#A39E93] hover:text-[#EAE6DF] bg-[#19191F] border border-white/12 rounded cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>
                  <p className="text-xs text-[#8E8A7E]">
                    Click any action key and press a new key to rebind (Esc cancels).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {KEY_CONTROL_ITEMS.map((item) => {
                      const isListening = listeningAction === item.action;
                      const currentCode =
                        settings.keyBindings?.[item.action] ?? DEFAULT_KEY_BINDINGS[item.action];
                      return (
                        <div
                          key={item.action}
                          className="flex items-center justify-between gap-2 px-3 py-2 bg-[#16161B] border border-white/8 rounded"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[#EAE6DF] truncate">
                              {item.label}
                            </div>
                            <div className="text-[10px] text-[#8E8A7E] truncate">{item.hint}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onMenuSfx?.('click');
                              setListeningAction(isListening ? null : item.action);
                            }}
                            className={`px-2.5 py-1 min-w-[68px] text-[11px] font-mono-code rounded border transition-colors shrink-0 cursor-pointer ${
                              isListening
                                ? 'bg-[#C8A24A] text-[#09090B] border-[#C8A24A] font-semibold'
                                : 'bg-[#0E0E12] text-[#EAE6DF] border-white/15 hover:border-[#C8A24A]/65'
                            }`}
                          >
                            {isListening ? 'Press Key...' : formatKeyCode(currentCode)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {modal === 'credits' && (
              <div className="mt-5 space-y-4 text-sm text-[#A39E93] leading-relaxed">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="w-32 shrink-0 overflow-hidden rounded border border-white/12 bg-black">
                    <img
                      src={GAME_LOGO_SRC}
                      alt="SOMETHING IS THERE official game logo"
                      referrerPolicy="no-referrer"
                      className="w-full aspect-square object-contain"
                    />
                  </div>
                  <div className="flex-1 overflow-hidden rounded border border-white/10 bg-[#0A0A0C]">
                    <img
                      src={gameThumbnailImg}
                      alt="SOMETHING IS THERE official game thumbnail"
                      referrerPolicy="no-referrer"
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                </div>
                <p>
                  <strong className="text-[#EAE6DF]">SOMETHING IS THERE</strong> — Original Single-Player Psychological Backrooms Survival Horror.
                </p>
                <p>
                  3D Horror Engine: Custom procedural Three.js WebGL renderer, procedural PBR textures, dynamic flickering lighting, BFS corridor pathfinding AI, and procedural Web Audio soundscape.
                </p>
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-[#8E8A7E]">
                    Export game-engine-ready PBR 3D Tactical Flashlight (+Z bezel forward, -Z knurled grip, binary .glb)
                  </div>
                  <button
                    type="button"
                    disabled={exportingFlashlight}
                    onClick={() => void handleExportFlashlightGlb()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C8A24A] hover:bg-[#D9B65C] disabled:opacity-60 text-[#09090B] rounded transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{exportingFlashlight ? 'Exporting .glb...' : 'Export Flashlight (.glb)'}</span>
                  </button>
                </div>
              </div>
            )}

            {modal === 'thumbnail' && (
              <div className="mt-5 space-y-4">
                <div className="overflow-hidden rounded border border-white/12 bg-[#0A0A0C]">
                  <img
                    src={gameThumbnailImg}
                    alt="SOMETHING IS THERE official 16:9 game thumbnail"
                    referrerPolicy="no-referrer"
                    className="w-full aspect-video object-cover"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-mono-code text-[#8E8A7E]">
                    16:9 Widescreen Key Art · SOMETHING IS THERE
                  </span>
                  <a
                    href={gameThumbnailImg}
                    download="something-is-there-thumbnail.jpg"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#C8A24A] hover:bg-[#D9B65C] text-[#09090B] rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Thumbnail</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
