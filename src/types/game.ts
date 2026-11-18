export type GamePhase =
  | 'menu'
  | 'intro_fade'
  | 'playing'
  | 'hiding'
  | 'paused'
  | 'dead'
  | 'chapter_complete';

export type ItemCategory = 'escape' | 'survival' | 'special';

export type ItemId =
  | 'crowbar'
  | 'old_key'
  | 'screwdriver'
  | 'fuse'
  | 'battery'
  | 'first_aid'
  | 'memory_tape'
  | 'tactical_flashlight'
  | 'lore_note';

export interface InventoryItem {
  id: ItemId;
  name: string;
  category: ItemCategory;
  description: string;
  usableDirectly: boolean;
}

export interface ChapterStep {
  stepNumber: number;
  title: string;
  objective: string;
  hint: string;
}

export interface ChapterBlueprint {
  chapterNumber: number;
  title: string;
  subtitle: string;
  environmentMood: string;
  primaryEntity: string;
  playableInDemo: boolean;
  steps: ChapterStep[];
  keyPuzzles: string[];
  endingSummary: string;
}

export type KeyBindingAction =
  | 'walkForward'
  | 'walkBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'run'
  | 'crouch'
  | 'slide'
  | 'interact'
  | 'flashlight';

export type KeyBindings = Record<KeyBindingAction, string>;

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  walkForward: 'KeyW',
  walkBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  run: 'ShiftLeft',
  crouch: 'KeyC',
  slide: 'ControlLeft',
  interact: 'KeyE',
  flashlight: 'KeyF',
};

export function formatKeyCode(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ShiftLeft: 'L Shift',
    ShiftRight: 'R Shift',
    ControlLeft: 'L Ctrl',
    ControlRight: 'R Ctrl',
    AltLeft: 'L Alt',
    AltRight: 'R Alt',
    Space: 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Tab: 'Tab',
    CapsLock: 'Caps',
    Enter: 'Enter',
    Backspace: 'Backspace',
  };
  return map[code] ?? code;
}

export interface GameSettings {
  mouseSensitivity: number;
  masterVolume: number;
  fov: number;
  mobileControls: boolean;
  keyBindings: KeyBindings;
}

export interface CheckpointSave {
  chapter: number;
  stepIndex: number;
  playerX: number;
  playerZ: number;
  battery: number;
  health: number;
  sanity?: number;
  maxSanity?: number;
  hasBetterFlashlight?: boolean;
  inventory: (InventoryItem | null)[];
  powerRoomOpened?: boolean;
  powerSwitchedOn?: boolean;
  hazardDoorOpened?: boolean;
  ventOpened?: boolean;
  officeUnlocked: boolean;
  fuseInserted?: boolean;
  collectedPickupIds: string[];
  savedAt: string;
}

export type StalkerBehaviorState =
  | 'idle'
  | 'patrol'
  | 'stalk'
  | 'investigate'
  | 'chase'
  | 'search'
  | 'retreat';

export interface ActivePrompt {
  targetId: string;
  pcLabel: string;
  mobileLabel: string;
  subLabel?: string;
}

export interface InspectedDocument {
  title: string;
  body: string;
  subtitle?: string;
}
