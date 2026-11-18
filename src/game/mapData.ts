import { InventoryItem, ItemId } from '../types/game';

export const CELL_SIZE = 4.0;
export const WALL_HEIGHT = 3.6;

/**
 * Chapter 1: The Awakening — 19x19 Backrooms Corridor & Power Voltage Sector
 * Legend:
 *  '#' = Solid Backrooms Wall
 *  '.' = Open Walkable Corridor / Room
 *  'S' = Player Spawn Corridor (South-West)
 *  'P' = Barricaded Power Voltage Room Door (Requires Crowbar)
 *  'B' = Black & Yellow Hazard Door (Requires Power Button switched ON inside Power Voltage Room)
 *  'D' = Forgotten Office Door (Openable exploration room)
 *  'E' = Exit Door to Our World (Requires Old Brass Key found behind Black & Yellow Door)
 */
export const CHAPTER_1_GRID: string[] = [
  '###################', // 0
  '#.....#.....#...E.#', // 1  (Exit Door to Our World at x=16,z=1)
  '#.###.#.###.#.#####', // 2
  '#.#...#...#.#.#...#', // 3
  '#.#.#####.#.#.#.###', // 4
  '#.#.....D.#...#...#', // 5  (Forgotten Office Door at x=8,z=5)
  '#.#####.#.#####.#.#', // 6
  '#.....#.#.......#.#', // 7  (Crowbar at x=1,z=7)
  '###.#.#.#######.#.#', // 8
  '#...#.....#.....#.#', // 9
  '#.#######.#.###.#.#', // 10
  '#.#.....#.#.#...#.#', // 11
  '#.#.#####B###.###.#', // 12 (Black & Yellow Door at x=9,z=12 -> leads to Old Key at x=11,z=13)
  '#.#.#...#...#.....#', // 13 (Power Voltage Room at x=5..7,z=13 with Power Button at x=7,z=13)
  '#.#.#P#########.#.#', // 14 (Power Voltage Room Door at x=5,z=14 -> pry open with Crowbar)
  '#S..#...........#.#', // 15 (Player Spawn at x=1,z=15 facing East along foggy corridor)
  '#.#####.#######.#.#', // 16
  '#.......#.........#', // 17 (Heavy-Duty Tactical Flashlight hidden at x=17,z=17)
  '###################', // 18
];

export const GRID_ROWS = CHAPTER_1_GRID.length;
export const GRID_COLS = CHAPTER_1_GRID[0].length;

export function cellToWorld(gx: number, gz: number): { x: number; z: number } {
  return {
    x: (gx - GRID_COLS / 2 + 0.5) * CELL_SIZE,
    z: (gz - GRID_ROWS / 2 + 0.5) * CELL_SIZE,
  };
}

export function worldToCell(wx: number, wz: number): { gx: number; gz: number } {
  return {
    gx: Math.floor(wx / CELL_SIZE + GRID_COLS / 2),
    gz: Math.floor(wz / CELL_SIZE + GRID_ROWS / 2),
  };
}

export type FloorMaterial = 'wet_carpet' | 'concrete' | 'squeaky_wood' | 'metal';

export function getCellChar(gx: number, gz: number): string {
  if (gz < 0 || gz >= GRID_ROWS || gx < 0 || gx >= GRID_COLS) return '#';
  return CHAPTER_1_GRID[gz][gx];
}

export function getFloorMaterialAtCell(gx: number, gz: number): FloorMaterial {
  // 1. Industrial Metal Floors
  // Power Voltage Room (heavy steel generator deck)
  if (gx >= 5 && gx <= 7 && gz >= 13 && gz <= 14) return 'metal';
  // Black & Yellow Hazard Key Vault (bolted steel floor plates)
  if (gx >= 9 && gx <= 11 && gz >= 12 && gz <= 13) return 'metal';
  // Central Stalker Spine Catwalk & East-West Maintenance Crossing
  if (gx === 9 && gz >= 7 && gz <= 11) return 'metal';
  if (gx >= 11 && gx <= 15 && gz === 9) return 'metal';
  // North-East Exit Bulkhead Steel Threshold
  if (gx >= 15 && gx <= 17 && gz === 1) return 'metal';

  // 2. Aged Squeaky Wood Planking Zones
  // Western Boarded Corridor & Crowbar Alcove
  if (gx === 1 && gz >= 3 && gz <= 9) return 'squeaky_wood';
  if (gx >= 1 && gx <= 5 && gz === 7) return 'squeaky_wood';
  // Forgotten Office Inner Timber Study
  if (gx >= 7 && gx <= 9 && gz === 3) return 'squeaky_wood';
  // Lower West Creaking Subfloor
  if (gx >= 1 && gx <= 7 && gz === 17) return 'squeaky_wood';
  // Eastern Timber Wing
  if (gx === 17 && gz >= 5 && gz <= 11) return 'squeaky_wood';

  // 3. Poured Concrete Floor Zones
  // Forgotten Office & Maintenance Wing
  if (gx >= 7 && gx <= 11 && gz >= 3 && gz <= 5) return 'concrete';
  // North-East Exit Outer Concrete Approach
  if (gx >= 13 && gx <= 17 && gz >= 1 && gz <= 2) return 'concrete';
  // South-East Tactical Flashlight Utility Bay
  if (gx >= 15 && gx <= 17 && gz === 17) return 'concrete';

  // 4. Default Soaked Yellow-Lit Backrooms Commercial Carpet
  return 'wet_carpet';
}

export function getFloorMaterialAtWorld(wx: number, wz: number): FloorMaterial {
  const { gx, gz } = worldToCell(wx, wz);
  return getFloorMaterialAtCell(gx, gz);
}

export function isCellSolid(
  gx: number,
  gz: number,
  state: {
    powerRoomOpened: boolean;
    hazardDoorOpened: boolean;
    officeUnlocked: boolean;
    exitUnlocked: boolean;
  },
): boolean {
  const ch = getCellChar(gx, gz);
  if (ch === '#') return true;
  if (ch === 'P' && !state.powerRoomOpened) return true;
  if (ch === 'B' && !state.hazardDoorOpened) return true;
  if (ch === 'D' && !state.officeUnlocked) return true;
  if (ch === 'E' && !state.exitUnlocked) return true;
  return false;
}

export const ITEM_CATALOG: Record<ItemId, InventoryItem> = {
  crowbar: {
    id: 'crowbar',
    name: 'Heavy Crowbar',
    category: 'escape',
    description: 'Forged steel pry bar. Forces open the barricaded Power Voltage Room door.',
    usableDirectly: false,
  },
  old_key: {
    id: 'old_key',
    name: 'Old Brass Key',
    category: 'escape',
    description: 'Heavy brass key stamped "REALITY THRESHOLD". Unlocks the Exit Door back to our world.',
    usableDirectly: false,
  },
  screwdriver: {
    id: 'screwdriver',
    name: 'Screwdriver',
    category: 'escape',
    description: 'Heavy flathead screwdriver.',
    usableDirectly: false,
  },
  fuse: {
    id: 'fuse',
    name: 'High-Volt Fuse',
    category: 'escape',
    description: 'Industrial backup cartridge fuse.',
    usableDirectly: false,
  },
  battery: {
    id: 'battery',
    name: 'Battery Pack',
    category: 'survival',
    description: 'High-capacity Battery Pack. Restores +50% charge to your flashlight when used.',
    usableDirectly: true,
  },
  first_aid: {
    id: 'first_aid',
    name: 'First Aid Kit',
    category: 'survival',
    description: 'Field trauma kit. Restores +50 HP when used.',
    usableDirectly: true,
  },
  memory_tape: {
    id: 'memory_tape',
    name: 'Memory Tape #01',
    category: 'special',
    description: 'Labelled "DAY 14 — VOLTAGE & THE YELLOW DOOR". Inspect to read transcript.',
    usableDirectly: true,
  },
  tactical_flashlight: {
    id: 'tactical_flashlight',
    name: 'Heavy-Duty Flashlight',
    category: 'survival',
    description: 'High-lumen tactical beam hidden in the maze. Upgrades flashlight range, beam width, and restores 100% charge.',
    usableDirectly: false,
  },
  lore_note: {
    id: 'lore_note',
    name: 'Lore Note',
    category: 'special',
    description: 'Weathered survivor field note detailing phenomena inside Sector 04.',
    usableDirectly: false,
  },
};

export interface PickupPlacement {
  pickupId: string;
  itemId: ItemId;
  gx: number;
  gz: number;
  heightOffset?: number;
  offsetX?: number;
  offsetZ?: number;
  noTable?: boolean;
  loreTitle?: string;
  loreBody?: string;
}

export const CHAPTER_1_PICKUPS: PickupPlacement[] = [
  { pickupId: 'pickup_battery_1', itemId: 'battery', gx: 3, gz: 15, heightOffset: 0.78 },
  { pickupId: 'pickup_crowbar', itemId: 'crowbar', gx: 1, gz: 7, heightOffset: 0.78 },
  { pickupId: 'pickup_old_key', itemId: 'old_key', gx: 11, gz: 13, heightOffset: 0.78 },
  { pickupId: 'pickup_battery_2', itemId: 'battery', gx: 15, gz: 13, heightOffset: 0.78 },
  { pickupId: 'pickup_battery_3', itemId: 'battery', gx: 7, gz: 9, heightOffset: 0.78 },
  { pickupId: 'pickup_battery_4', itemId: 'battery', gx: 11, gz: 1, heightOffset: 0.78 },
  { pickupId: 'pickup_battery_5', itemId: 'battery', gx: 17, gz: 3, heightOffset: 0.78 },
  { pickupId: 'pickup_first_aid', itemId: 'first_aid', gx: 13, gz: 7, heightOffset: 0.78 },
  { pickupId: 'pickup_first_aid_office', itemId: 'first_aid', gx: 9, gz: 3, heightOffset: 0.78 },
  { pickupId: 'pickup_tape_1', itemId: 'memory_tape', gx: 7, gz: 3, heightOffset: 0.78 },
  {
    pickupId: 'pickup_tactical_flashlight',
    itemId: 'tactical_flashlight',
    gx: 17,
    gz: 17,
    heightOffset: 0.08,
    offsetX: 1.15,
    offsetZ: 1.15,
    noTable: true,
  },
  {
    pickupId: 'pickup_lore_1',
    itemId: 'lore_note',
    gx: 5,
    gz: 15,
    heightOffset: 0.77,
    loreTitle: 'FIELD NOTE #01 — "THE MONO-YELLOW HUM"',
    loreBody:
      'I slipped through a hairline gap behind a stairwell and landed face-first on soaked commercial carpet. Six hundred million square miles of yellowed wallpaper, buzzing ceiling tubes, and a smell like wet wool and old ozone. Whatever built these halls never meant for anyone to leave—every corner repeats, yet nothing stays still when the lights go out.',
  },
  {
    pickupId: 'pickup_lore_2',
    itemId: 'lore_note',
    gx: 5,
    gz: 13,
    heightOffset: 0.77,
    loreTitle: 'MAINTENANCE LOG #04 — "SECTOR 04 VOLTAGE"',
    loreBody:
      'Crew boarded up this Voltage Room after losing Miller in the east halls. The heavy breaker feeds the Black & Yellow Hazard Vault down the block. Remember this if the ceiling fluorescents above you suddenly start strobing and buzzing: the ballast reacts to electromagnetic distortion whenever The Stalker closes within 16 meters.',
  },
  {
    pickupId: 'pickup_lore_3',
    itemId: 'lore_note',
    gx: 3,
    gz: 5,
    heightOffset: 0.77,
    loreTitle: 'SCRIBBLED PAGE — "DO NOT STAY IN THE DARK"',
    loreBody:
      'Darkness here is not empty. Stay unlit too long and your mind unravels—the edges of vision bleed violet, corridors twist, and whispers fill the static. Keep spare Battery Packs ready. And if you see two pale eyes and a gaping mouth suspended in the black fog down a corridor, duck into a steel locker and hold your breath.',
  },
  {
    pickupId: 'pickup_lore_4',
    itemId: 'lore_note',
    gx: 15,
    gz: 5,
    heightOffset: 0.77,
    loreTitle: 'SURVEYOR MEMO — "CONCRETE & ECHOES"',
    loreBody:
      'Not all floors in Level 0 are damp carpet. Utility wings, key vaults, and the northern exit threshold sit on cold poured concrete. Footsteps snap and echo off concrete slabs—and we learned the hard way that the entity hears every echoed stride. Crouch low (C) when crossing concrete rooms.',
  },
  {
    pickupId: 'pickup_lore_5',
    itemId: 'lore_note',
    gx: 15,
    gz: 9,
    heightOffset: 0.77,
    loreTitle: 'FINAL SCRAP — "REALITY THRESHOLD"',
    loreBody:
      'For anyone reading this: I verified the Old Brass Key lies locked behind the Black & Yellow Hazard Door. Pry the Power Voltage Room open with the Crowbar, slam the main Power Button ON, grab the key, and sprint north-east to the steel Exit Bulkhead. Beyond that door is real sunlight. Don’t look back when you turn the key.',
  },
];

export interface LockerPlacement {
  id: string;
  gx: number;
  gz: number;
  facing: 'north' | 'south' | 'east' | 'west';
}

export const CHAPTER_1_LOCKERS: LockerPlacement[] = [
  { id: 'locker_1', gx: 5, gz: 11, facing: 'south' },
  { id: 'locker_2', gx: 13, gz: 9, facing: 'south' },
  { id: 'locker_3', gx: 17, gz: 5, facing: 'west' },
  { id: 'locker_4', gx: 2, gz: 15, facing: 'north' },
  { id: 'locker_5', gx: 1, gz: 11, facing: 'east' },
  { id: 'locker_6', gx: 3, gz: 7, facing: 'south' },
  { id: 'locker_7', gx: 1, gz: 3, facing: 'east' },
  { id: 'locker_8', gx: 5, gz: 1, facing: 'south' },
  { id: 'locker_9', gx: 7, gz: 15, facing: 'south' },
  { id: 'locker_10', gx: 11, gz: 15, facing: 'south' },
  { id: 'locker_11', gx: 15, gz: 17, facing: 'north' },
  { id: 'locker_12', gx: 17, gz: 11, facing: 'west' },
  { id: 'locker_13', gx: 12, gz: 7, facing: 'south' },
  { id: 'locker_14', gx: 11, gz: 5, facing: 'north' },
  { id: 'locker_15', gx: 13, gz: 1, facing: 'east' },
];

export const STALKER_PATROL_CELLS: { gx: number; gz: number }[] = [
  { gx: 15, gz: 7 },
  { gx: 15, gz: 15 },
  { gx: 9, gz: 15 },
  { gx: 7, gz: 11 },
  { gx: 11, gz: 7 },
  { gx: 17, gz: 11 },
  { gx: 13, gz: 3 },
];

export function findGridPath(
  startGx: number,
  startGz: number,
  goalGx: number,
  goalGz: number,
  doorState: {
    powerRoomOpened: boolean;
    hazardDoorOpened: boolean;
    officeUnlocked: boolean;
    exitUnlocked: boolean;
  },
): { gx: number; gz: number }[] {
  if (startGx === goalGx && startGz === goalGz) return [];

  const key = (x: number, z: number) => `${x},${z}`;
  const queue: { gx: number; gz: number }[] = [{ gx: startGx, gz: startGz }];
  const visited = new Set<string>([key(startGx, startGz)]);
  const parent = new Map<string, { gx: number; gz: number }>();

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let found = false;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.gx === goalGx && curr.gz === goalGz) {
      found = true;
      break;
    }
    for (const [dx, dz] of dirs) {
      const nx = curr.gx + dx;
      const nz = curr.gz + dz;
      const k = key(nx, nz);
      if (visited.has(k)) continue;
      if (isCellSolid(nx, nz, doorState)) continue;
      visited.add(k);
      parent.set(k, curr);
      queue.push({ gx: nx, gz: nz });
    }
  }

  if (!found) return [];

  const path: { gx: number; gz: number }[] = [];
  let trace: { gx: number; gz: number } | undefined = { gx: goalGx, gz: goalGz };
  while (trace && !(trace.gx === startGx && trace.gz === startGz)) {
    path.push(trace);
    trace = parent.get(key(trace.gx, trace.gz));
  }
  path.reverse();
  return path;
}

export function hasLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  doorState: {
    powerRoomOpened: boolean;
    hazardDoorOpened: boolean;
    officeUnlocked: boolean;
    exitUnlocked: boolean;
  },
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / 0.45);
  if (steps <= 1) return true;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = x1 + dx * t;
    const sz = z1 + dz * t;
    const { gx, gz } = worldToCell(sx, sz);
    if (isCellSolid(gx, gz, doorState)) {
      return false;
    }
  }
  return true;
}
