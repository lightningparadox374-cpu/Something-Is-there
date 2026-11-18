import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ActivePrompt,
  CheckpointSave,
  DEFAULT_KEY_BINDINGS,
  GamePhase,
  GameSettings,
  InventoryItem,
  ItemId,
  StalkerBehaviorState,
  formatKeyCode,
} from '../types/game';
import {
  CELL_SIZE,
  CHAPTER_1_GRID,
  CHAPTER_1_LOCKERS,
  CHAPTER_1_PICKUPS,
  GRID_COLS,
  GRID_ROWS,
  ITEM_CATALOG,
  STALKER_PATROL_CELLS,
  WALL_HEIGHT,
  cellToWorld,
  findGridPath,
  getFloorMaterialAtCell,
  getFloorMaterialAtWorld,
  hasLineOfSight,
  isCellSolid,
  worldToCell,
} from '../game/mapData';
import {
  GhostCrushHandsRig,
  LockerRig,
  StalkerRig,
  createBlackYellowDoorModel,
  createExitBulkheadModel,
  createFlashlightRig,
  createGhostCrushHandsRig,
  createItemPickupModel,
  createLockerModel,
  createOfficeDoorModel,
  createPowerRoomDoorModel,
  createPowerVoltagePanelModel,
  createProceduralTextures,
  createStalkerModel,
  createUtilityTableModel,
} from '../game/proceduralAssets';
import { HorrorAudioEngine } from '../audio/horrorAudio';
import {
  LoadedGlbAsset,
  clearCustomModelFile,
  fetchModelsManifest,
  loadGlbAssetFromSource,
} from '../game/customModels';

export interface MobileInputState {
  moveX: number;
  moveY: number;
  lookDeltaX: number;
  lookDeltaY: number;
  sprinting: boolean;
}

export interface LiveHudSnapshot {
  health: number;
  sanity: number;
  maxSanity: number;
  stamina: number;
  battery: number;
  flashlightOn: boolean;
  hasBetterFlashlight: boolean;
  crouching: boolean;
  sliding: boolean;
  hiding: boolean;
  stalkerDistance: number;
  stalkerState: StalkerBehaviorState;
  stepIndex: number;
  pointerLocked: boolean;
  jumpscareIntensity: number;
  panic: number;
  iSeeYouIntensity: number;
  fatalCutsceneProgress: number;
}

export interface GameActionsRef {
  toggleFlashlight: () => void;
  toggleCrouch: () => void;
  triggerSlide: () => void;
  interact: () => void;
  useSlot: (slotIndex: number) => void;
  dropSlot: (slotIndex: number) => void;
  resetFromCheckpoint: (save: CheckpointSave | null) => void;
  requestPointerLock: () => void;
}

interface BackroomsCanvasProps {
  phase: GamePhase;
  settings: GameSettings;
  audio: HorrorAudioEngine;
  inventory: (InventoryItem | null)[];
  activeSlot: number;
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  actionsRef: React.MutableRefObject<GameActionsRef | null>;
  onHudSnapshot: (snap: LiveHudSnapshot) => void;
  onPromptChange: (prompt: ActivePrompt | null) => void;
  onInventoryChange: (next: (InventoryItem | null)[]) => void;
  onStepAdvance: (nextStep: number, save: CheckpointSave) => void;
  onStatusToast: (msg: string) => void;
  onInspectDocument: (title: string, body: string) => void;
  onHidingChange: (hiding: boolean) => void;
  onPlayerCaught: (reason: string) => void;
  onChapterComplete: () => void;
  onPauseRequest: () => void;
  customModelVersion?: number;
}

// Pre-allocated math helpers (zero GC inside render loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _toPlayer = new THREE.Vector3();
const _stalkerForward = new THREE.Vector3();
const _rayCenter = new THREE.Vector2(0, 0);

interface InteractableTarget {
  id: string;
  kind:
    | 'pickup'
    | 'power_door'
    | 'power_switch'
    | 'hazard_door'
    | 'office_door'
    | 'exit_door'
    | 'locker';
  collider: THREE.Object3D;
  rootGroup: THREE.Group;
  itemId?: ItemId;
  lockerId?: string;
  loreTitle?: string;
  loreBody?: string;
  worldX: number;
  worldZ: number;
  facingYaw?: number;
}

export const BackroomsCanvas: React.FC<BackroomsCanvasProps> = ({
  phase,
  settings,
  audio,
  inventory,
  activeSlot,
  mobileInputRef,
  actionsRef,
  onHudSnapshot,
  onPromptChange,
  onInventoryChange,
  onStepAdvance,
  onStatusToast,
  onInspectDocument,
  onHidingChange,
  onPlayerCaught,
  onChapterComplete,
  onPauseRequest,
  customModelVersion = 0,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const reloadModelsRef = useRef<(() => void) | null>(null);

  // Synced refs so the stable WebGL loop reads fresh React state without recreating WebGLRenderer
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const settingsRef = useRef<GameSettings>(settings);
  settingsRef.current = settings;
  const inventoryRef = useRef<(InventoryItem | null)[]>(inventory);
  inventoryRef.current = inventory;
  const activeSlotRef = useRef<number>(activeSlot);
  activeSlotRef.current = activeSlot;

  const callbacksRef = useRef({
    onHudSnapshot,
    onPromptChange,
    onInventoryChange,
    onStepAdvance,
    onStatusToast,
    onInspectDocument,
    onHidingChange,
    onPlayerCaught,
    onChapterComplete,
    onPauseRequest,
  });
  callbacksRef.current = {
    onHudSnapshot,
    onPromptChange,
    onInventoryChange,
    onStepAdvance,
    onStatusToast,
    onInspectDocument,
    onHidingChange,
    onPlayerCaught,
    onChapterComplete,
    onPauseRequest,
  };

  useEffect(() => {
    reloadModelsRef.current?.();
  }, [customModelVersion]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // 2. Scene, Dense Black Fog & Studio Environment
    const scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x050506);
    scene.background = fogColor;
    scene.fog = new THREE.FogExp2(0x050506, 0.30);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.06;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      settingsRef.current.fov,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.08,
      40,
    );

    // Near-pitch-black Backrooms ambient fill (when flashlight dies, darkness is real)
    const hemiLight = new THREE.HemisphereLight(0x2e2918, 0x030302, 0.025);
    scene.add(hemiLight);

    // 3. Procedural Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);

    // 4. Build Watertight Backrooms Sector Geometry
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const totalW = GRID_COLS * CELL_SIZE;
    const totalD = GRID_ROWS * CELL_SIZE;

    const floorGeo = new THREE.PlaneGeometry(totalW, totalD);
    const floorMat = new THREE.MeshStandardMaterial({
      map: textures.carpetMap,
      bumpMap: textures.carpetBumpMap,
      bumpScale: 0.035,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.03,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    worldGroup.add(floor);

    // Poured Concrete, Squeaky Wood & Industrial Metal Floor Slabs across specialized Backrooms sectors
    const concreteCoords: { gx: number; gz: number }[] = [];
    const woodCoords: { gx: number; gz: number }[] = [];
    const metalCoords: { gx: number; gz: number }[] = [];
    for (let gz = 0; gz < GRID_ROWS; gz++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        if (CHAPTER_1_GRID[gz][gx] === '#') continue;
        const matType = getFloorMaterialAtCell(gx, gz);
        if (matType === 'concrete') {
          concreteCoords.push({ gx, gz });
        } else if (matType === 'squeaky_wood') {
          woodCoords.push({ gx, gz });
        } else if (matType === 'metal') {
          metalCoords.push({ gx, gz });
        }
      }
    }
    const slabGeo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
    const slabDummy = new THREE.Object3D();
    slabDummy.rotation.x = -Math.PI / 2;

    let concreteMat: THREE.MeshStandardMaterial | null = null;
    if (concreteCoords.length > 0) {
      concreteMat = new THREE.MeshStandardMaterial({
        map: textures.concreteMap,
        bumpMap: textures.concreteBumpMap,
        bumpScale: 0.03,
        roughness: 0.74,
        metalness: 0.05,
        envMapIntensity: 0.06,
      });
      const concreteInstanced = new THREE.InstancedMesh(
        slabGeo,
        concreteMat,
        concreteCoords.length,
      );
      concreteInstanced.receiveShadow = true;
      concreteCoords.forEach((cell, idx) => {
        const pos = cellToWorld(cell.gx, cell.gz);
        slabDummy.position.set(pos.x, 0.004, pos.z);
        slabDummy.updateMatrix();
        concreteInstanced.setMatrixAt(idx, slabDummy.matrix);
      });
      concreteInstanced.computeBoundingSphere();
      worldGroup.add(concreteInstanced);
    }

    let woodFloorMat: THREE.MeshStandardMaterial | null = null;
    if (woodCoords.length > 0) {
      woodFloorMat = new THREE.MeshStandardMaterial({
        map: textures.woodFloorMap,
        bumpMap: textures.woodFloorBumpMap,
        bumpScale: 0.042,
        roughness: 0.82,
        metalness: 0.02,
        envMapIntensity: 0.05,
      });
      const woodInstanced = new THREE.InstancedMesh(
        slabGeo,
        woodFloorMat,
        woodCoords.length,
      );
      woodInstanced.receiveShadow = true;
      woodCoords.forEach((cell, idx) => {
        const pos = cellToWorld(cell.gx, cell.gz);
        slabDummy.position.set(pos.x, 0.0045, pos.z);
        slabDummy.updateMatrix();
        woodInstanced.setMatrixAt(idx, slabDummy.matrix);
      });
      woodInstanced.computeBoundingSphere();
      worldGroup.add(woodInstanced);
    }

    let metalFloorMat: THREE.MeshStandardMaterial | null = null;
    if (metalCoords.length > 0) {
      metalFloorMat = new THREE.MeshStandardMaterial({
        map: textures.metalFloorMap,
        bumpMap: textures.metalFloorBumpMap,
        bumpScale: 0.045,
        roughness: 0.42,
        metalness: 0.78,
        envMapIntensity: 0.24,
      });
      const metalInstanced = new THREE.InstancedMesh(
        slabGeo,
        metalFloorMat,
        metalCoords.length,
      );
      metalInstanced.receiveShadow = true;
      metalCoords.forEach((cell, idx) => {
        const pos = cellToWorld(cell.gx, cell.gz);
        slabDummy.position.set(pos.x, 0.005, pos.z);
        slabDummy.updateMatrix();
        metalInstanced.setMatrixAt(idx, slabDummy.matrix);
      });
      metalInstanced.computeBoundingSphere();
      worldGroup.add(metalInstanced);
    }

    const ceilingGeo = new THREE.PlaneGeometry(totalW, totalD);
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: textures.ceilingMap,
      bumpMap: textures.ceilingBumpMap,
      bumpScale: 0.03,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.03,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    worldGroup.add(ceiling);

    // Merge static wall cells for optimal draw calls
    const wallMat = new THREE.MeshStandardMaterial({
      map: textures.wallpaperMap,
      bumpMap: textures.wallpaperBumpMap,
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.04,
    });
    const wallBoxGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    let wallCount = 0;
    for (let gz = 0; gz < GRID_ROWS; gz++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        if (CHAPTER_1_GRID[gz][gx] === '#') wallCount++;
      }
    }
    const wallInstanced = new THREE.InstancedMesh(wallBoxGeo, wallMat, wallCount);
    wallInstanced.castShadow = true;
    wallInstanced.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let wi = 0;
    for (let gz = 0; gz < GRID_ROWS; gz++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        if (CHAPTER_1_GRID[gz][gx] === '#') {
          const pos = cellToWorld(gx, gz);
          dummy.position.set(pos.x, WALL_HEIGHT / 2, pos.z);
          dummy.updateMatrix();
          wallInstanced.setMatrixAt(wi++, dummy.matrix);
        }
      }
    }
    wallInstanced.computeBoundingSphere();
    worldGroup.add(wallInstanced);

    // 5. Overhead Fluorescent Light Fixtures (true ON/OFF flickering + Stalker proximity warning)
    interface CeilingFixture {
      x: number;
      z: number;
      light: THREE.PointLight;
      panelMat: THREE.MeshStandardMaterial;
      baseIntensity: number;
      flickerPhase: number;
      isFaulty: boolean;
      isOn: boolean;
      nextSwitchAt: number;
      burstRemaining: number;
      prevNormIntensity: number;
    }
    const fixtures: CeilingFixture[] = [];
    const panelGeo = new THREE.BoxGeometry(1.4, 0.06, 0.55);
    const fixturePositions: { x: number; z: number }[] = [];

    for (let gz = 1; gz < GRID_ROWS - 1; gz += 2) {
      for (let gx = 1; gx < GRID_COLS - 1; gx += 2) {
        if (CHAPTER_1_GRID[gz][gx] === '#') continue;
        // Keep some corridors unlit for oppressive darkness
        if ((gx + gz) % 4 !== 0 && !(gx === 1 && gz === 15) && !(gx === 3 && gz === 15)) continue;

        const pos = cellToWorld(gx, gz);
        fixturePositions.push(pos);
        const isFaulty = (gx * 7 + gz * 13) % 3 !== 0;
        const pMat = new THREE.MeshStandardMaterial({
          color: 0xfef9dc,
          emissive: 0xd6cb8c,
          emissiveIntensity: 0.72,
          roughness: 0.35,
        });
        const panel = new THREE.Mesh(panelGeo, pMat);
        panel.position.set(pos.x, WALL_HEIGHT - 0.04, pos.z);
        worldGroup.add(panel);

        const pt = new THREE.PointLight(0xe6d896, isFaulty ? 0.38 : 0.48, 6.2, 2.2);
        pt.position.set(pos.x, WALL_HEIGHT - 0.32, pos.z);
        worldGroup.add(pt);

        fixtures.push({
          x: pos.x,
          z: pos.z,
          light: pt,
          panelMat: pMat,
          baseIntensity: isFaulty ? 0.38 : 0.48,
          flickerPhase: Math.random() * 100,
          isFaulty,
          isOn: true,
          nextSwitchAt: 0.4 + Math.random() * 1.8,
          burstRemaining: isFaulty ? 3 : 0,
          prevNormIntensity: 1,
        });
      }
    }

    // Metallic ceiling troffer bezels framing each fluorescent panel
    const trofferGeo = new THREE.BoxGeometry(1.52, 0.045, 0.67);
    const trofferMat = new THREE.MeshStandardMaterial({
      map: textures.metalMap,
      color: 0x62676d,
      roughness: 0.48,
      metalness: 0.72,
      envMapIntensity: 0.22,
    });
    if (fixturePositions.length > 0) {
      const trofferInstanced = new THREE.InstancedMesh(trofferGeo, trofferMat, fixturePositions.length);
      const tDummy = new THREE.Object3D();
      fixturePositions.forEach((fp, idx) => {
        tDummy.position.set(fp.x, WALL_HEIGHT - 0.022, fp.z);
        tDummy.updateMatrix();
        trofferInstanced.setMatrixAt(idx, tDummy.matrix);
      });
      trofferInstanced.computeBoundingSphere();
      worldGroup.add(trofferInstanced);
    }

    // Floating atmospheric dust motes drifting inside light cones (zero per-frame GC)
    const DUST_COUNT = isSoftwareGl ? 110 : 260;
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    const dustBaseX = new Float32Array(DUST_COUNT);
    const dustBaseY = new Float32Array(DUST_COUNT);
    const dustBaseZ = new Float32Array(DUST_COUNT);
    const dustPhases = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      const rx = (Math.random() - 0.5) * (totalW - 2);
      const ry = 0.25 + Math.random() * (WALL_HEIGHT - 0.45);
      const rz = (Math.random() - 0.5) * (totalD - 2);
      dustBaseX[i] = rx;
      dustBaseY[i] = ry;
      dustBaseZ[i] = rz;
      dustPositions[i * 3] = rx;
      dustPositions[i * 3 + 1] = ry;
      dustPositions[i * 3 + 2] = rz;
      dustPhases[i] = Math.random() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    const dustPosAttr = new THREE.BufferAttribute(dustPositions, 3);
    dustPosAttr.setUsage(THREE.DynamicDrawUsage);
    dustGeo.setAttribute('position', dustPosAttr);
    const dustMat = new THREE.PointsMaterial({
      map: textures.dustMoteMap,
      color: 0xe8ddba,
      size: 0.068,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.frustumCulled = false;
    worldGroup.add(dustPoints);

    // 6. Tight-Beam Flashlight + Fatal Cutscene Camera Ghost Hands Rig
    const flashlightRig = createFlashlightRig();
    const proceduralFlashlightChildren = [...flashlightRig.children];
    camera.add(flashlightRig);

    const crushHandsRig: GhostCrushHandsRig = createGhostCrushHandsRig();
    crushHandsRig.group.visible = false;
    camera.add(crushHandsRig.group);

    const crushLight = new THREE.PointLight(0xff3030, 0, 3.0, 1.5);
    crushLight.position.set(0, 0.05, 0.04);
    camera.add(crushLight);

    const flashlightSpot = new THREE.SpotLight(0xfff4d2, 3.2, 13.5, Math.PI / 7.8, 0.46, 2.0);
    flashlightSpot.position.set(0.18, -0.14, -0.35);
    flashlightSpot.target.position.set(0, -0.04, -6);
    flashlightSpot.castShadow = !isSoftwareGl;
    flashlightSpot.shadow.mapSize.set(1024, 1024);
    flashlightSpot.shadow.camera.near = 0.2;
    flashlightSpot.shadow.camera.far = 14;
    flashlightSpot.shadow.bias = -0.0005;
    flashlightSpot.shadow.normalBias = 0.02;
    flashlightSpot.shadow.radius = 2.5;
    camera.add(flashlightSpot);
    camera.add(flashlightSpot.target);
    scene.add(camera);

    // 7. Interactive Doors, Power Voltage Switch, Black & Yellow Door, Exit, Lockers & Pickups
    const interactables: InteractableTarget[] = [];
    const pickupMap = new Map<string, InteractableTarget>();
    const lockerRigs = new Map<string, { rig: LockerRig; wx: number; wz: number; facingYaw: number }>();

    // Power Voltage Room Barricaded Door at (5, 14)
    const powerDoorPos = cellToWorld(5, 14);
    const powerRoomDoorObj = createPowerRoomDoorModel();
    powerRoomDoorObj.group.position.set(powerDoorPos.x, 0, powerDoorPos.z);
    scene.add(powerRoomDoorObj.group);
    interactables.push({
      id: 'power_room_door',
      kind: 'power_door',
      collider: powerRoomDoorObj.collider,
      rootGroup: powerRoomDoorObj.group,
      worldX: powerDoorPos.x,
      worldZ: powerDoorPos.z,
    });

    // Power Voltage Panel / Power Button inside Power Voltage Room at (7, 13) East wall
    const powerSwitchPos = cellToWorld(7, 13);
    const powerSwitchObj = createPowerVoltagePanelModel();
    powerSwitchObj.group.position.set(powerSwitchPos.x + CELL_SIZE * 0.43, 0, powerSwitchPos.z);
    powerSwitchObj.group.rotation.y = -Math.PI / 2;
    scene.add(powerSwitchObj.group);
    interactables.push({
      id: 'power_switch',
      kind: 'power_switch',
      collider: powerSwitchObj.collider,
      rootGroup: powerSwitchObj.group,
      worldX: powerSwitchPos.x,
      worldZ: powerSwitchPos.z,
    });

    // Black & Yellow Hazard Door at (9, 12)
    const hazardDoorPos = cellToWorld(9, 12);
    const hazardDoorObj = createBlackYellowDoorModel();
    hazardDoorObj.group.position.set(hazardDoorPos.x, 0, hazardDoorPos.z);
    scene.add(hazardDoorObj.group);
    interactables.push({
      id: 'hazard_door',
      kind: 'hazard_door',
      collider: hazardDoorObj.collider,
      rootGroup: hazardDoorObj.group,
      worldX: hazardDoorPos.x,
      worldZ: hazardDoorPos.z,
    });

    // Forgotten Office Door at (8, 5) — spans East-West corridor
    const doorPos = cellToWorld(8, 5);
    const officeDoorObj = createOfficeDoorModel();
    officeDoorObj.group.position.set(doorPos.x, 0, doorPos.z);
    officeDoorObj.group.rotation.y = Math.PI / 2;
    scene.add(officeDoorObj.group);
    interactables.push({
      id: 'office_door',
      kind: 'office_door',
      collider: officeDoorObj.collider,
      rootGroup: officeDoorObj.group,
      worldX: doorPos.x,
      worldZ: doorPos.z,
    });

    // Exit Door to Our World at (16, 1) — spans East-West corridor, faces West toward (15, 1)
    const exitPos = cellToWorld(16, 1);
    const exitObj = createExitBulkheadModel();
    exitObj.group.position.set(exitPos.x, 0, exitPos.z);
    exitObj.group.rotation.y = -Math.PI / 2;
    scene.add(exitObj.group);
    interactables.push({
      id: 'exit_door',
      kind: 'exit_door',
      collider: exitObj.collider,
      rootGroup: exitObj.group,
      worldX: exitPos.x,
      worldZ: exitPos.z,
    });

    // Metal Lockers
    for (const lk of CHAPTER_1_LOCKERS) {
      const pos = cellToWorld(lk.gx, lk.gz);
      const rig = createLockerModel(textures.metalMap);
      let yaw = 0;
      let ox = 0;
      let oz = 0;
      if (lk.facing === 'east') {
        yaw = Math.PI / 2;
        ox = -1.42;
      } else if (lk.facing === 'west') {
        yaw = -Math.PI / 2;
        ox = 1.42;
      } else if (lk.facing === 'south') {
        yaw = 0;
        oz = -1.42;
      } else {
        yaw = Math.PI;
        oz = 1.42;
      }
      rig.group.position.set(pos.x + ox, 0, pos.z + oz);
      rig.group.rotation.y = yaw;
      scene.add(rig.group);

      lockerRigs.set(lk.id, {
        rig,
        wx: pos.x + ox,
        wz: pos.z + oz,
        facingYaw: yaw,
      });

      interactables.push({
        id: lk.id,
        kind: 'locker',
        collider: rig.colliderMesh,
        rootGroup: rig.group,
        lockerId: lk.id,
        worldX: pos.x + ox,
        worldZ: pos.z + oz,
        facingYaw: yaw,
      });
    }

    // Utility Tables & Pickups
    const tablesGroup = new THREE.Group();
    scene.add(tablesGroup);

    const spawnWorldPickup = (
      pickupId: string,
      itemId: ItemId,
      wx: number,
      wz: number,
      wy: number,
      withTable: boolean,
      loreTitle?: string,
      loreBody?: string,
    ) => {
      if (withTable) {
        const table = createUtilityTableModel();
        table.position.set(wx, 0, wz);
        tablesGroup.add(table);
      }
      const model = createItemPickupModel(itemId);
      model.group.position.set(wx, wy, wz);
      scene.add(model.group);

      const target: InteractableTarget = {
        id: pickupId,
        kind: 'pickup',
        collider: model.collider,
        rootGroup: model.group,
        itemId,
        loreTitle,
        loreBody,
        worldX: wx,
        worldZ: wz,
      };
      interactables.push(target);
      pickupMap.set(pickupId, target);
    };

    for (const p of CHAPTER_1_PICKUPS) {
      const w = cellToWorld(p.gx, p.gz);
      spawnWorldPickup(
        p.pickupId,
        p.itemId,
        w.x + (p.offsetX ?? 0),
        w.z + (p.offsetZ ?? 0),
        p.heightOffset ?? 0.78,
        !p.noTable,
        p.loreTitle,
        p.loreBody,
      );
    }

    // 8. Spawn The Stalker (far away from player spawn!)
    const stalkerRig: StalkerRig = createStalkerModel();
    const proceduralStalkerChildren = [...stalkerRig.group.children];
    const stalkerSpawn = cellToWorld(STALKER_PATROL_CELLS[0].gx, STALKER_PATROL_CELLS[0].gz);
    stalkerRig.group.position.set(stalkerSpawn.x, 0, stalkerSpawn.z);
    scene.add(stalkerRig.group);

    // Optional Custom .glb 3D Model Overrides (Ghost & Flashlight)
    let customGhostAsset: LoadedGlbAsset | null = null;
    let customFlashlightAsset: LoadedGlbAsset | null = null;
    let customLoadTicket = 0;

    const syncCustomModels = async () => {
      const ticket = ++customLoadTicket;
      try {
        // Clear any leftover IndexedDB custom model overrides from removed Settings uploader
        await Promise.all([
          clearCustomModelFile('ghost'),
          clearCustomModelFile('flashlight'),
        ]);
        const manifest = await fetchModelsManifest();
        if (disposed || ticket !== customLoadTicket) return;

        // Clear previous Ghost GLB
        if (customGhostAsset) {
          stalkerRig.group.remove(customGhostAsset.root);
          customGhostAsset.dispose();
          customGhostAsset = null;
        }
        const ghostSource = manifest.ghost;
        if (ghostSource) {
          try {
            const loaded = await loadGlbAssetFromSource(ghostSource, {
              targetHeight: 2.85,
              alignToFloor: true,
            });
            if (disposed || ticket !== customLoadTicket) {
              loaded.dispose();
              return;
            }
            customGhostAsset = loaded;
            for (const c of proceduralStalkerChildren) c.visible = false;
            stalkerRig.group.add(loaded.root);
          } catch {
            for (const c of proceduralStalkerChildren) c.visible = true;
          }
        } else {
          for (const c of proceduralStalkerChildren) c.visible = true;
        }

        // Clear previous Flashlight GLB
        if (customFlashlightAsset) {
          flashlightRig.remove(customFlashlightAsset.root);
          customFlashlightAsset.dispose();
          customFlashlightAsset = null;
        }
        const flashlightSource = manifest.flashlight;
        if (flashlightSource) {
          try {
            const loaded = await loadGlbAssetFromSource(flashlightSource, {
              targetHeight: 0.34,
              alignToFloor: false,
            });
            if (disposed || ticket !== customLoadTicket) {
              loaded.dispose();
              return;
            }
            customFlashlightAsset = loaded;
            for (const c of proceduralFlashlightChildren) c.visible = false;
            flashlightRig.add(loaded.root);
          } catch {
            for (const c of proceduralFlashlightChildren) c.visible = true;
          }
        } else {
          for (const c of proceduralFlashlightChildren) c.visible = true;
        }
      } catch {
        // Fallback silently to procedural assets
      }
    };

    reloadModelsRef.current = () => {
      void syncCustomModels();
    };
    void syncCustomModels();

    // 9. Mutable Simulation State
    const spawnPos = cellToWorld(1, 15);
    const sim = {
      px: spawnPos.x,
      pz: spawnPos.z,
      yaw: -Math.PI / 2, // Facing East down foggy corridor!
      pitch: 0,
      eyeHeight: 1.65,
      health: 100,
      sanity: 100,
      maxSanity: 100,
      darkExposureTime: 0,
      hasShownLowSanityHint: false,
      lastSanityWhisperTime: 0,
      cameraRoll: 0,
      stamina: 100,
      sprintDuration: 0,
      battery: 100,
      flashlightOn: true,
      hasBetterFlashlight: false,
      crouching: false,
      slideTimer: 0,
      slideDuration: 0.52,
      slideCooldown: 0,
      slideDirX: 0,
      slideDirZ: 0,
      hidingLockerId: null as string | null,
      hidingBaseYaw: 0,
      preHideX: spawnPos.x,
      preHideZ: spawnPos.z,
      preHideYaw: -Math.PI / 2,
      hitCooldown: 0,
      stalkerStunTimer: 0,
      stepIndex: 1,
      powerRoomOpened: false,
      powerSwitchedOn: false,
      hazardDoorOpened: false,
      officeUnlocked: false,
      exitOpened: false,
      collectedPickupIds: new Set<string>(),
      walkPhase: 0,
      scareTimer: 0,
      scareDuration: 0.85,
      scareFatal: false,
      scareStartX: spawnPos.x,
      scareStartY: 1.65,
      scareStartZ: spawnPos.z,
      scareStartYaw: -Math.PI / 2,
      scareStartPitch: 0,
      shakeTimer: 0,
      shakeIntensity: 0,
      panic: 0,
      iSeeYouTimer: 0,
      nextISeeYouIn: 1.2,
      globalBlackoutTimer: 0,
      globalFlickerTimer: 0,
      hasShownFlickerHint: false,
      hasShownLowBatteryHint: false,
      nextHorrorEventIn: 16,
      lastHudEmit: 0,
      lastPromptId: null as string | null,
      // Stalker AI
      stalkerX: stalkerSpawn.x,
      stalkerZ: stalkerSpawn.z,
      stalkerYaw: 0,
      stalkerState: 'patrol' as StalkerBehaviorState,
      stalkerPatrolIdx: 1,
      stalkerTargetX: stalkerSpawn.x,
      stalkerTargetZ: stalkerSpawn.z,
      stalkerPath: [] as { gx: number; gz: number }[],
      stalkerPathTimer: 0,
      stalkerSearchTimer: 0,
      stalkerWalkCycle: 0,
      lastStalkerStepSin: 0,
      stalkTimer: 0,
      stalkStareTimer: 0,
      stalkerRetreatCooldown: 0,
      lastPlayerNoiseTime: 0,
      sawPlayerHideLocker: false,
    };

    const getDoorState = () => ({
      powerRoomOpened: sim.powerRoomOpened,
      hazardDoorOpened: sim.hazardDoorOpened,
      officeUnlocked: sim.officeUnlocked,
      exitUnlocked: sim.exitOpened,
    });

    const emitCheckpointAdvance = (newStep: number) => {
      if (newStep <= sim.stepIndex) return;
      sim.stepIndex = newStep;
      const save: CheckpointSave = {
        chapter: 1,
        stepIndex: newStep,
        playerX: sim.px,
        playerZ: sim.pz,
        battery: sim.battery,
        health: sim.health,
        sanity: sim.sanity,
        maxSanity: sim.maxSanity,
        hasBetterFlashlight: sim.hasBetterFlashlight,
        inventory: inventoryRef.current,
        powerRoomOpened: sim.powerRoomOpened,
        powerSwitchedOn: sim.powerSwitchedOn,
        hazardDoorOpened: sim.hazardDoorOpened,
        officeUnlocked: sim.officeUnlocked,
        collectedPickupIds: Array.from(sim.collectedPickupIds),
        savedAt: new Date().toISOString(),
      };
      callbacksRef.current.onStepAdvance(newStep, save);
    };

    const alertStalkerSound = (sx: number, sz: number, radius: number) => {
      const dist = Math.hypot(sim.stalkerX - sx, sim.stalkerZ - sz);
      if (dist <= radius && sim.stalkerState !== 'chase') {
        sim.stalkerState = 'investigate';
        sim.stalkerTargetX = sx;
        sim.stalkerTargetZ = sz;
        sim.stalkerPathTimer = 0; // force path recompute
      }
    };

    // 10. Input Tracking (Keyboard & PointerLock)
    const keys = new Set<string>();
    let isPointerLocked = false;

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'hiding') return;

      const binds = settingsRef.current.keyBindings ?? DEFAULT_KEY_BINDINGS;
      if (
        e.code === 'Space' ||
        e.code.startsWith('Arrow') ||
        Object.values(binds).includes(e.code)
      ) {
        e.preventDefault();
      }

      if (sim.scareTimer > 0) return;

      if (e.code === binds.flashlight) {
        if (!e.repeat) actionsRef.current?.toggleFlashlight();
      } else if (e.code === binds.slide) {
        if (!e.repeat) actionsRef.current?.triggerSlide();
      } else if (e.code === binds.crouch) {
        if (!e.repeat) actionsRef.current?.toggleCrouch();
      } else if (e.code === binds.interact) {
        if (!e.repeat) actionsRef.current?.interact();
      } else if (e.code === 'Escape') {
        callbacksRef.current.onPauseRequest();
      } else if (e.code.startsWith('Digit')) {
        const num = Number(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 6) {
          actionsRef.current?.useSlot(num - 1);
        }
      } else if (e.code === 'Backspace') {
        actionsRef.current?.dropSlot(activeSlotRef.current);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const applyLookDelta = (dx: number, dy: number, sens: number) => {
      if (sim.hidingLockerId) {
        let relYaw = sim.yaw - sim.hidingBaseYaw;
        while (relYaw > Math.PI) relYaw -= Math.PI * 2;
        while (relYaw < -Math.PI) relYaw += Math.PI * 2;
        relYaw = THREE.MathUtils.clamp(relYaw - dx * sens, -0.58, 0.58);
        sim.yaw = sim.hidingBaseYaw + relYaw;
        sim.pitch = THREE.MathUtils.clamp(sim.pitch - dy * sens, -0.45, 0.45);
      } else {
        sim.yaw -= dx * sens;
        sim.pitch = THREE.MathUtils.clamp(sim.pitch - dy * sens, -1.35, 1.35);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked) return;
      if (phaseRef.current !== 'playing' && phaseRef.current !== 'hiding') return;
      const sens = 0.0021 * settingsRef.current.mouseSensitivity;
      applyLookDelta(e.movementX, e.movementY, sens);
    };

    const onPointerLockChange = () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement;
    };

    const safeRequestPointerLock = () => {
      if (settingsRef.current.mobileControls) return;
      if (document.pointerLockElement === renderer.domElement) return;
      const navWithActivation = navigator as Navigator & {
        userActivation?: { isActive: boolean };
      };
      if (navWithActivation.userActivation && !navWithActivation.userActivation.isActive) {
        return;
      }
      try {
        const result = renderer.domElement.requestPointerLock?.() as unknown as
          | Promise<void>
          | undefined;
        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            // Ignore transient pointer lock rejections (e.g., immediate Escape press or iframe sandbox)
          });
        }
      } catch {
        // Ignore synchronous SecurityError / NotSupportedError
      }
    };

    const onCanvasClick = () => {
      if (phaseRef.current === 'playing' || phaseRef.current === 'hiding') {
        safeRequestPointerLock();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    renderer.domElement.addEventListener('click', onCanvasClick);

    // 11. Expose Imperative Actions to HUD / App
    const raycaster = new THREE.Raycaster();
    raycaster.far = 3.2;

    const getAimedTarget = (): InteractableTarget | null => {
      if (sim.hidingLockerId) {
        return interactables.find((t) => t.id === sim.hidingLockerId) || null;
      }
      raycaster.setFromCamera(_rayCenter, camera);
      const colliders = interactables
        .filter((t) => t.rootGroup.visible)
        .map((t) => t.collider);
      const hits = raycaster.intersectObjects(colliders, false);
      if (hits.length === 0) return null;
      const hitObj = hits[0].object;
      return interactables.find((t) => t.collider === hitObj) || null;
    };

    actionsRef.current = {
      requestPointerLock: () => {
        safeRequestPointerLock();
      },
      toggleFlashlight: () => {
        if (sim.battery <= 0) {
          const batIdx = inventoryRef.current.findIndex((s) => s?.id === 'battery');
          if (batIdx !== -1) {
            sim.battery = 50;
            sim.hasShownLowBatteryHint = false;
            sim.flashlightOn = true;
            const next = [...inventoryRef.current];
            next[batIdx] = null;
            callbacksRef.current.onInventoryChange(next);
            audio.playPickup();
            audio.playFlashlightClick(true);
            callbacksRef.current.onStatusToast('Loaded Battery Pack (+50% charge).');
            return;
          }
          sim.flashlightOn = false;
          audio.playFlashlightClick(false);
          callbacksRef.current.onStatusToast(
            'Flashlight battery depleted — find a Battery Pack in the corridors.',
          );
          return;
        }
        sim.flashlightOn = !sim.flashlightOn;
        audio.playFlashlightClick(sim.flashlightOn);
      },
      toggleCrouch: () => {
        if (sim.hidingLockerId || sim.slideTimer > 0) return;
        sim.crouching = !sim.crouching;
      },
      triggerSlide: () => {
        if (phaseRef.current !== 'playing' || sim.hidingLockerId || sim.scareTimer > 0) return;
        if (sim.slideTimer > 0 || sim.slideCooldown > 0) return;
        if (sim.stamina < 14) {
          callbacksRef.current.onStatusToast('Not enough stamina to slide.');
          return;
        }
        const binds = settingsRef.current.keyBindings ?? DEFAULT_KEY_BINDINGS;
        const usedCodes = new Set(Object.values(binds));
        let mf = 0;
        let ms = 0;
        if (keys.has(binds.walkForward) || (!usedCodes.has('ArrowUp') && keys.has('ArrowUp'))) {
          mf += 1;
        }
        if (keys.has(binds.walkBackward) || (!usedCodes.has('ArrowDown') && keys.has('ArrowDown'))) {
          mf -= 1;
        }
        if (keys.has(binds.moveRight) || (!usedCodes.has('ArrowRight') && keys.has('ArrowRight'))) {
          ms += 1;
        }
        if (keys.has(binds.moveLeft) || (!usedCodes.has('ArrowLeft') && keys.has('ArrowLeft'))) {
          ms -= 1;
        }
        mf += -mobileInputRef.current.moveY;
        ms += mobileInputRef.current.moveX;

        const mag = Math.hypot(mf, ms);
        const nf = mag > 0.08 ? mf / mag : 1;
        const ns = mag > 0.08 ? ms / mag : 0;

        _forward.set(-Math.sin(sim.yaw), 0, -Math.cos(sim.yaw));
        _right.set(Math.cos(sim.yaw), 0, -Math.sin(sim.yaw));
        const dx = _forward.x * nf + _right.x * ns;
        const dz = _forward.z * nf + _right.z * ns;
        const dLen = Math.max(0.001, Math.hypot(dx, dz));

        sim.slideDirX = dx / dLen;
        sim.slideDirZ = dz / dLen;
        sim.slideDuration = 0.52;
        sim.slideTimer = sim.slideDuration;
        sim.slideCooldown = 0.25;
        sim.crouching = false;
        sim.stamina = Math.max(0, sim.stamina - 14);
        audio.playBodySlide(audio.getFootstepSurfaceAt(sim.px, sim.pz));
        alertStalkerSound(sim.px, sim.pz, 14);
      },
      useSlot: (slotIdx: number) => {
        const item = inventoryRef.current[slotIdx];
        if (!item) return;

        if (item.id === 'battery') {
          if (sim.battery >= 99.5) {
            callbacksRef.current.onStatusToast('Flashlight battery is already full.');
            return;
          }
          sim.battery = Math.min(100, sim.battery + 50);
          sim.hasShownLowBatteryHint = false;
          sim.flashlightOn = true;
          audio.playPickup();
          const next = [...inventoryRef.current];
          next[slotIdx] = null;
          callbacksRef.current.onInventoryChange(next);
          callbacksRef.current.onStatusToast('Installed Battery Pack (+50% charge).');
        } else if (item.id === 'first_aid') {
          if (sim.health >= 100 && sim.sanity >= sim.maxSanity - 5) {
            callbacksRef.current.onStatusToast('Health and sanity are already steady.');
            return;
          }
          sim.health = Math.min(100, sim.health + 50);
          sim.sanity = Math.min(sim.maxSanity, sim.sanity + 25);
          audio.playPickup();
          const next = [...inventoryRef.current];
          next[slotIdx] = null;
          callbacksRef.current.onInventoryChange(next);
          callbacksRef.current.onStatusToast(
            `Used First Aid Kit (+50 HP, +25 Sanity up to ${sim.maxSanity}% max).`,
          );
        } else if (item.id === 'memory_tape') {
          audio.playHorrorEvent('static');
          callbacksRef.current.onInspectDocument(
            'MEMORY TAPE #01 — TRANSCRIPT',
            '"Day 14. Something tall with shadowy tendrils stalks these foggy halls. Grab the Heavy Crowbar in the West Wing to pry open the Power Voltage Room, then switch ON the Power Button inside. Only then will the Black & Yellow Door unlock so you can claim the Old Brass Key to our world."',
          );
        } else {
          callbacksRef.current.onStatusToast(`${item.name}: ${item.description}`);
        }
      },
      dropSlot: (slotIdx: number) => {
        const item = inventoryRef.current[slotIdx];
        if (!item) return;
        const dropId = `dropped_${item.id}_${Date.now()}`;
        const dropX = sim.px - Math.sin(sim.yaw) * 0.85;
        const dropZ = sim.pz - Math.cos(sim.yaw) * 0.85;
        spawnWorldPickup(dropId, item.id, dropX, dropZ, 0.08, false);
        const next = [...inventoryRef.current];
        next[slotIdx] = null;
        callbacksRef.current.onInventoryChange(next);
        audio.playPickup();
        callbacksRef.current.onStatusToast(`Dropped ${item.name}.`);
      },
      interact: () => {
        const target = getAimedTarget();
        if (!target) return;

        if (target.kind === 'pickup' && target.itemId) {
          if (target.itemId === 'lore_note') {
            target.rootGroup.visible = false;
            sim.collectedPickupIds.add(target.id);
            sim.lastPromptId = null;
            audio.playPickup();
            callbacksRef.current.onPromptChange(null);
            callbacksRef.current.onInspectDocument(
              target.loreTitle ?? 'RECOVERED LORE NOTE',
              target.loreBody ?? 'The ink has faded in the damp fluorescent light.',
            );
            return;
          }

          if (target.itemId === 'tactical_flashlight') {
            sim.hasBetterFlashlight = true;
            sim.battery = 100;
            sim.flashlightOn = true;
            target.rootGroup.visible = false;
            sim.collectedPickupIds.add(target.id);
            audio.playPickup();
            callbacksRef.current.onStatusToast(
              'Equipped Heavy-Duty Flashlight! Wider beam & deeper reach through the black fog.',
            );
            return;
          }

          const emptyIdx = inventoryRef.current.findIndex((s) => s === null);
          if (emptyIdx === -1) {
            callbacksRef.current.onStatusToast('Inventory full (6/6 slots). Press Backspace to drop an item.');
            return;
          }
          const next = [...inventoryRef.current];
          next[emptyIdx] = ITEM_CATALOG[target.itemId];
          target.rootGroup.visible = false;
          sim.collectedPickupIds.add(target.id);
          audio.playPickup();
          callbacksRef.current.onInventoryChange(next);
          callbacksRef.current.onStatusToast(`Picked up ${ITEM_CATALOG[target.itemId].name}.`);

          if (target.itemId === 'crowbar' && sim.stepIndex < 2) {
            emitCheckpointAdvance(2);
          } else if (target.itemId === 'old_key' && sim.stepIndex < 5) {
            emitCheckpointAdvance(5);
          }
        } else if (target.kind === 'power_door') {
          if (sim.powerRoomOpened) return;
          const idx = inventoryRef.current.findIndex((s) => s?.id === 'crowbar');
          if (idx === -1) {
            audio.playLockedRattle();
            callbacksRef.current.onStatusToast('Power Voltage Room barricaded — Requires Heavy Crowbar.');
            return;
          }
          sim.powerRoomOpened = true;
          powerRoomDoorObj.plankGroup.visible = false;
          powerRoomDoorObj.collider.visible = false;
          audio.playMetalClank();
          alertStalkerSound(target.worldX, target.worldZ, 18);
          callbacksRef.current.onStatusToast(
            'Pried open the Power Voltage Room! Switch ON the Power Button inside.',
          );
        } else if (target.kind === 'power_switch') {
          if (sim.powerSwitchedOn) return;
          sim.powerSwitchedOn = true;
          powerSwitchObj.ledMat.color.setHex(0x22c55e);
          powerSwitchObj.ledMat.emissive.setHex(0x16a34a);
          powerSwitchObj.buttonMat.color.setHex(0x22c55e);
          powerSwitchObj.buttonMat.emissive.setHex(0x15803d);
          powerSwitchObj.buttonMesh.position.z = 0.17;
          powerSwitchObj.roomLight.intensity = 2.4;
          powerSwitchObj.collider.visible = false;
          hazardDoorObj.statusMat.color.setHex(0xfacc15);
          hazardDoorObj.statusMat.emissive.setHex(0xeab308);

          audio.playElectricalSurge();
          sim.globalFlickerTimer = 1.6;
          alertStalkerSound(target.worldX, target.worldZ, 26);
          callbacksRef.current.onStatusToast(
            'Power ON! Go to the Black & Yellow Door to claim the Old Brass Key.',
          );
          if (sim.stepIndex < 3) emitCheckpointAdvance(3);
        } else if (target.kind === 'hazard_door') {
          if (sim.hazardDoorOpened) return;
          if (!sim.powerSwitchedOn) {
            audio.playLockedRattle();
            callbacksRef.current.onStatusToast(
              'Black & Yellow Door unpowered — Switch ON the Power Button in the Power Voltage Room.',
            );
            return;
          }
          sim.hazardDoorOpened = true;
          hazardDoorObj.collider.visible = false;
          hazardDoorObj.statusMat.color.setHex(0x22c55e);
          hazardDoorObj.statusMat.emissive.setHex(0x16a34a);
          audio.playDoorCreak();
          alertStalkerSound(target.worldX, target.worldZ, 18);
          callbacksRef.current.onStatusToast(
            'Black & Yellow Door unlocked! Grab the Old Brass Key inside.',
          );
          if (sim.stepIndex < 4) emitCheckpointAdvance(4);
        } else if (target.kind === 'office_door') {
          if (sim.officeUnlocked) return;
          sim.officeUnlocked = true;
          officeDoorObj.collider.visible = false;
          audio.playDoorCreak();
          alertStalkerSound(target.worldX, target.worldZ, 14);
          callbacksRef.current.onStatusToast('Opened the Forgotten Office.');
        } else if (target.kind === 'exit_door') {
          if (!sim.exitOpened) {
            const idx = inventoryRef.current.findIndex((s) => s?.id === 'old_key');
            if (idx === -1) {
              audio.playLockedRattle();
              callbacksRef.current.onStatusToast(
                'Exit Door locked — Find the Old Brass Key behind the Black & Yellow Door.',
              );
              return;
            }
            sim.exitOpened = true;
            const next = [...inventoryRef.current];
            next[idx] = null;
            callbacksRef.current.onInventoryChange(next);
            exitObj.signMat.color.setHex(0x22c55e);
            exitObj.signMat.emissive.setHex(0x16a34a);
            exitObj.sunPortalMat.opacity = 0.96;
            exitObj.sunLight.intensity = 5.5;
            exitObj.collider.visible = false;
            audio.playDoorCreak();
            callbacksRef.current.onStatusToast(
              'Exit Door unlocked! Step into the sunlight to return to our world!',
            );
          } else {
            audio.playDoorCreak();
            if (document.pointerLockElement) document.exitPointerLock?.();
            callbacksRef.current.onChapterComplete();
          }
        } else if (target.kind === 'locker' && target.lockerId) {
          if (sim.hidingLockerId === target.lockerId) {
            // Exit locker
            sim.hidingLockerId = null;
            sim.px = sim.preHideX;
            sim.pz = sim.preHideZ;
            sim.yaw = sim.preHideYaw;
            audio.playLockerDoor('close');
            callbacksRef.current.onHidingChange(false);
            callbacksRef.current.onStatusToast('Stepped out of locker.');
          } else if (!sim.hidingLockerId) {
            const lkData = lockerRigs.get(target.lockerId);
            if (!lkData) return;
            sim.preHideX = sim.px;
            sim.preHideZ = sim.pz;
            sim.preHideYaw = sim.yaw;
            sim.hidingLockerId = target.lockerId;
            sim.crouching = false;
            // Tuck camera right behind the eye-level louver window & cracked door gap
            sim.px = lkData.wx + Math.sin(lkData.facingYaw) * 0.14;
            sim.pz = lkData.wz + Math.cos(lkData.facingYaw) * 0.14;
            sim.hidingBaseYaw = lkData.facingYaw + Math.PI;
            sim.yaw = sim.hidingBaseYaw;
            sim.pitch = 0;
            sim.sawPlayerHideLocker =
              sim.stalkerState === 'chase' &&
              Math.hypot(sim.stalkerX - lkData.wx, sim.stalkerZ - lkData.wz) < 5.5 &&
              hasLineOfSight(sim.stalkerX, sim.stalkerZ, lkData.wx, lkData.wz, getDoorState());
            audio.playLockerDoor('open');
            const interactKeyLabel = formatKeyCode(
              (settingsRef.current.keyBindings ?? DEFAULT_KEY_BINDINGS).interact,
            );
            callbacksRef.current.onHidingChange(true);
            callbacksRef.current.onStatusToast(
              `Hiding inside locker. Press ${interactKeyLabel} to exit.`,
            );
          }
        }
      },
      resetFromCheckpoint: (save: CheckpointSave | null) => {
        sim.health = save?.health ?? 100;
        sim.maxSanity = save?.maxSanity ?? 100;
        sim.sanity = Math.min(sim.maxSanity, save?.sanity ?? sim.maxSanity);
        sim.darkExposureTime = 0;
        sim.hasShownLowSanityHint = false;
        sim.lastSanityWhisperTime = 0;
        sim.cameraRoll = 0;
        camera.rotation.z = 0;
        sim.stamina = 100;
        sim.sprintDuration = 0;
        sim.battery = save?.battery ?? 100;
        sim.flashlightOn = true;
        sim.hasBetterFlashlight = save?.hasBetterFlashlight ?? false;
        sim.crouching = false;
        sim.slideTimer = 0;
        sim.slideCooldown = 0;
        sim.slideDirX = 0;
        sim.slideDirZ = 0;
        sim.hidingLockerId = null;
        sim.hitCooldown = 0;
        sim.stalkerStunTimer = 0;
        sim.scareTimer = 0;
        sim.scareFatal = false;
        crushHandsRig.group.visible = false;
        crushLight.intensity = 0;
        flashlightSpot.position.set(0.18, -0.14, -0.35);
        sim.shakeTimer = 0;
        sim.shakeIntensity = 0;
        sim.panic = 0;
        sim.iSeeYouTimer = 0;
        sim.nextISeeYouIn = 1.2;
        sim.hasShownFlickerHint = false;
        sim.hasShownLowBatteryHint = false;
        callbacksRef.current.onHidingChange(false);
        sim.stepIndex = save?.stepIndex ?? 1;
        sim.powerRoomOpened = save?.powerRoomOpened ?? false;
        sim.powerSwitchedOn = save?.powerSwitchedOn ?? false;
        sim.hazardDoorOpened = save?.hazardDoorOpened ?? false;
        sim.officeUnlocked = save?.officeUnlocked ?? false;
        sim.exitOpened = false;

        powerRoomDoorObj.plankGroup.visible = !sim.powerRoomOpened;
        powerRoomDoorObj.collider.visible = !sim.powerRoomOpened;

        powerSwitchObj.ledMat.color.setHex(sim.powerSwitchedOn ? 0x22c55e : 0xef4444);
        powerSwitchObj.ledMat.emissive.setHex(sim.powerSwitchedOn ? 0x16a34a : 0xef4444);
        powerSwitchObj.buttonMat.color.setHex(sim.powerSwitchedOn ? 0x22c55e : 0xdc2626);
        powerSwitchObj.buttonMat.emissive.setHex(sim.powerSwitchedOn ? 0x15803d : 0x7f1d1d);
        powerSwitchObj.buttonMesh.position.z = sim.powerSwitchedOn ? 0.17 : 0.21;
        powerSwitchObj.roomLight.intensity = sim.powerSwitchedOn ? 2.4 : 0;
        powerSwitchObj.collider.visible = !sim.powerSwitchedOn;

        hazardDoorObj.collider.visible = !sim.hazardDoorOpened;
        hazardDoorObj.statusMat.color.setHex(
          sim.hazardDoorOpened ? 0x22c55e : sim.powerSwitchedOn ? 0xfacc15 : 0xdc2626,
        );
        hazardDoorObj.statusMat.emissive.setHex(
          sim.hazardDoorOpened ? 0x16a34a : sim.powerSwitchedOn ? 0xeab308 : 0x991b1b,
        );

        officeDoorObj.collider.visible = !sim.officeUnlocked;

        exitObj.collider.visible = true;
        exitObj.signMat.color.setHex(0x991b1b);
        exitObj.signMat.emissive.setHex(0x7f1d1d);
        exitObj.sunPortalMat.opacity = 0;
        exitObj.sunLight.intensity = 0;

        sim.collectedPickupIds = new Set(save?.collectedPickupIds ?? []);
        pickupMap.forEach((target, id) => {
          target.rootGroup.visible = !sim.collectedPickupIds.has(id);
        });

        const startPos = save ? { x: save.playerX, z: save.playerZ } : cellToWorld(1, 15);
        sim.px = startPos.x;
        sim.pz = startPos.z;
        sim.yaw = -Math.PI / 2;
        sim.pitch = 0;

        // Reset Stalker far away from respawned player
        const farCell = STALKER_PATROL_CELLS[0];
        const farWorld = cellToWorld(farCell.gx, farCell.gz);
        sim.stalkerX = farWorld.x;
        sim.stalkerZ = farWorld.z;
        sim.stalkerState = 'patrol';
        sim.stalkerPath = [];
        sim.stalkTimer = 0;
        sim.stalkStareTimer = 0;
        sim.stalkerRetreatCooldown = 0;
        sim.lastStalkerStepSin = 0;
        sim.lastPlayerNoiseTime = 0;
        sim.sawPlayerHideLocker = false;
      },
    };

    // 12. Collision Helper (circle vs grid walls)
    const canOccupy = (nx: number, nz: number, radius = 0.44): boolean => {
      const doorState = getDoorState();
      const offsets = [
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
        [radius * 0.7, radius * 0.7],
        [-radius * 0.7, radius * 0.7],
        [radius * 0.7, -radius * 0.7],
        [-radius * 0.7, -radius * 0.7],
      ];
      for (const [ox, oz] of offsets) {
        const { gx, gz } = worldToCell(nx + ox, nz + oz);
        if (isCellSolid(gx, gz, doorState)) return false;
      }
      return true;
    };

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 13. Main Simulation & Render Loop
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();
      const currentPhase = phaseRef.current;

      // Animate ceiling fluorescent hum & flickers (with Stalker vicinity early-warning interference)
      if (sim.globalBlackoutTimer > 0) sim.globalBlackoutTimer -= dt;
      if (sim.globalFlickerTimer > 0) sim.globalFlickerTimer -= dt;

      const activeGameplay =
        currentPhase === 'playing' || currentPhase === 'hiding' || currentPhase === 'intro_fade';
      const playerStalkerDist = activeGameplay
        ? Math.hypot(sim.stalkerX - sim.px, sim.stalkerZ - sim.pz)
        : 999;
      const playerVicinityWarn = activeGameplay && playerStalkerDist <= 16.5;

      if (playerVicinityWarn && currentPhase === 'playing' && !sim.hasShownFlickerHint) {
        sim.hasShownFlickerHint = true;
        callbacksRef.current.onStatusToast(
          'Overhead lights are flickering — something is nearby!',
        );
      }

      let nearbyLightExposure = 0;
      let triggeredWarningZap = false;
      let maxZapProximity = 0;
      let proxWeightSum = 0;
      let weightedNormSum = 0;
      let weightedPanSum = 0;
      let maxProxWeight = 0;
      let maxFlickerDelta = 0;
      _right.set(Math.cos(sim.yaw), 0, -Math.sin(sim.yaw));

      for (const fx of fixtures) {
        const distToStalker = activeGameplay
          ? Math.hypot(fx.x - sim.stalkerX, fx.z - sim.stalkerZ)
          : 999;
        const distToPlayer = activeGameplay ? Math.hypot(fx.x - sim.px, fx.z - sim.pz) : 999;

        // Stalker triggers interference on lights near itself (<= 13.5m) AND near the player when in vicinity (<= 16.5m)
        const bulbInterference =
          distToStalker <= 13.5 ? 1 - distToStalker / 13.5 : 0;
        const playerAreaWarning =
          playerVicinityWarn && distToPlayer <= 14.0
            ? (1 - playerStalkerDist / 16.5) * (1 - distToPlayer / 14.0 * 0.45)
            : 0;
        const stalkerInterference = Math.max(bulbInterference, playerAreaWarning);

        if (sim.globalBlackoutTimer > 0) {
          fx.light.intensity = 0;
          fx.panelMat.emissiveIntensity = 0.02;
        } else if (sim.globalFlickerTimer > 0) {
          const on = Math.random() > 0.48;
          fx.light.intensity = on ? fx.baseIntensity * 1.05 : 0;
          fx.panelMat.emissiveIntensity = on ? 0.95 : 0.02;
        } else if (stalkerInterference > 0.04) {
          // Early-warning erratic flickering: faster & darker as Stalker draws closer
          if (elapsed >= fx.nextSwitchAt) {
            const prevOn = fx.isOn;
            fx.isOn = Math.random() > 0.35 + stalkerInterference * 0.34;
            const minGap = 0.035;
            const maxGap = THREE.MathUtils.lerp(0.32, 0.075, stalkerInterference);
            fx.nextSwitchAt = elapsed + minGap + Math.random() * maxGap;
            if (prevOn !== fx.isOn && distToPlayer < 11.5) {
              triggeredWarningZap = true;
              if (stalkerInterference > maxZapProximity) maxZapProximity = stalkerInterference;
            }
          }
          const surge = fx.isOn ? 0.72 + Math.random() * 0.55 : 0;
          fx.light.intensity = fx.baseIntensity * surge;
          fx.panelMat.emissiveIntensity = fx.isOn ? 0.92 * surge : 0.02;
        } else if (fx.isFaulty) {
          if (elapsed >= fx.nextSwitchAt) {
            fx.isOn = !fx.isOn;
            if (fx.burstRemaining > 0) {
              fx.burstRemaining--;
              fx.nextSwitchAt = elapsed + 0.05 + Math.random() * 0.11;
            } else if (Math.random() < 0.45) {
              fx.burstRemaining = 2 + Math.floor(Math.random() * 5);
              fx.nextSwitchAt = elapsed + 0.06 + Math.random() * 0.12;
            } else {
              fx.nextSwitchAt = elapsed + (fx.isOn ? 0.45 + Math.random() * 1.55 : 0.3 + Math.random() * 1.15);
            }
          }
          fx.light.intensity = fx.isOn ? fx.baseIntensity : 0;
          fx.panelMat.emissiveIntensity = fx.isOn ? 0.85 : 0.02;
        } else {
          // Even steady tubes occasionally blink completely off for a brief moment
          if (elapsed >= fx.nextSwitchAt) {
            fx.isOn = !fx.isOn;
            fx.nextSwitchAt = elapsed + (fx.isOn ? 3.5 + Math.random() * 6.0 : 0.12 + Math.random() * 0.25);
          }
          if (!fx.isOn) {
            fx.light.intensity = 0;
            fx.panelMat.emissiveIntensity = 0.02;
          } else {
            const subtle = 0.94 + Math.sin(elapsed * 8 + fx.flickerPhase) * 0.06;
            fx.light.intensity = fx.baseIntensity * subtle;
            fx.panelMat.emissiveIntensity = 0.82 * subtle;
          }
        }
        const curNorm = fx.baseIntensity > 0 ? fx.light.intensity / fx.baseIntensity : 0;
        const flickerDelta = Math.abs(curNorm - fx.prevNormIntensity);
        fx.prevNormIntensity = curNorm;

        if (activeGameplay && distToPlayer < 9.5) {
          const proxW = Math.pow(1 - distToPlayer / 9.5, 1.5);
          proxWeightSum += proxW;
          weightedNormSum += curNorm * proxW;
          if (proxW > maxProxWeight) maxProxWeight = proxW;
          if (flickerDelta * proxW > maxFlickerDelta) {
            maxFlickerDelta = Math.min(1, flickerDelta * (0.45 + proxW * 0.85));
          }
          if (distToPlayer > 0.15) {
            _camPos.set((fx.x - sim.px) / distToPlayer, 0, (fx.z - sim.pz) / distToPlayer);
            weightedPanSum += _right.dot(_camPos) * proxW;
          }
        }
        if (activeGameplay && fx.light.intensity > 0.05 && distToPlayer < 5.8) {
          nearbyLightExposure += (1 - distToPlayer / 5.8) * curNorm;
        }
      }
      if (triggeredWarningZap) {
        audio.playLightFlickerZap(maxZapProximity);
      }
      const nearbyNorm = proxWeightSum > 0.001 ? weightedNormSum / proxWeightSum : 0;
      const dominantLightPan =
        proxWeightSum > 0.001 ? THREE.MathUtils.clamp(weightedPanSum / proxWeightSum, -0.85, 0.85) : 0;
      audio.updateProximityLightBuzz(
        maxProxWeight,
        nearbyNorm,
        maxFlickerDelta,
        dominantLightPan,
        activeGameplay,
      );

      // Update Sanity meter: drains slowly toward hit maxSanity cap & in darkness, recovers up to maxSanity under light
      let playerInDarkness = false;
      if (currentPhase === 'playing' || currentPhase === 'hiding') {
        const flashlightGlow =
          sim.flashlightOn && sim.battery > 0 ? (sim.hasBetterFlashlight ? 0.95 : 0.72) : 0;
        const voltageRoomGlow =
          sim.powerSwitchedOn &&
          Math.hypot(sim.px - powerSwitchPos.x, sim.pz - powerSwitchPos.z) < 5.5
            ? 0.65
            : 0;
        const exitSunGlow =
          sim.exitOpened && Math.hypot(sim.px - exitPos.x, sim.pz - exitPos.z) < 7.0 ? 1.0 : 0;
        const lightLevel = sim.hidingLockerId
          ? 0.1
          : nearbyLightExposure + flashlightGlow + voltageRoomGlow + exitSunGlow;

        playerInDarkness = lightLevel < 0.4;

        if (sim.sanity > sim.maxSanity) {
          // Smoothly decrease sanity down to the new hit-reduced maxSanity cap (or 0 on fatal hit)
          const drainRate = sim.scareFatal ? 38 : 11;
          sim.sanity = Math.max(sim.maxSanity, sim.sanity - dt * drainRate);
        } else if (playerInDarkness) {
          sim.darkExposureTime += dt;
          if (sim.darkExposureTime > 1.5) {
            const darknessRate = lightLevel < 0.14 ? 2.65 : 1.55;
            const stalkerDread = playerStalkerDist < 10 ? 0.85 : 0;
            sim.sanity = Math.max(0, sim.sanity - dt * (darknessRate + stalkerDread));
          }
        } else if (lightLevel >= 0.52) {
          sim.darkExposureTime = Math.max(0, sim.darkExposureTime - dt * 2.4);
          const recoverRate = nearbyLightExposure > 0.35 || exitSunGlow > 0 ? 2.1 : 1.15;
          sim.sanity = Math.min(sim.maxSanity, sim.sanity + dt * recoverRate);
        }

        if (sim.sanity < 55 && !sim.hasShownLowSanityHint) {
          sim.hasShownLowSanityHint = true;
          callbacksRef.current.onStatusToast(
            'Your sanity is slipping in the dark — turn on your flashlight or find light!',
          );
        }
        if (sim.sanity < 45 && sim.lastSanityWhisperTime === 0) {
          sim.lastSanityWhisperTime = elapsed;
          audio.playSanityHallucination('whisper', 0.72);
        }
        audio.updateSanityAudio(sim.sanity, playerInDarkness, true);
      } else {
        audio.updateSanityAudio(100, false, false);
      }

      if (sim.shakeTimer > 0) {
        sim.shakeTimer = Math.max(0, sim.shakeTimer - dt);
        if (sim.shakeTimer <= 0) sim.shakeIntensity = 0;
      }

      const activeJumpscareIntensity =
        sim.scareTimer > 0
          ? sim.scareFatal
            ? 1.0
            : Math.max(0.35, sim.scareTimer / Math.max(0.1, sim.scareDuration))
          : sim.shakeTimer > 0
            ? (sim.shakeTimer / 0.45) * sim.shakeIntensity
            : 0;
      const activeFatalCutsceneProgress =
        sim.scareTimer > 0 && sim.scareFatal
          ? THREE.MathUtils.clamp(1 - sim.scareTimer / Math.max(0.1, sim.scareDuration), 0.001, 1)
          : 0;

      const rawMadness =
        currentPhase === 'playing' || currentPhase === 'hiding'
          ? THREE.MathUtils.clamp((85 - sim.sanity) / 85, 0, 1)
          : 0;
      const madness = rawMadness > 0 ? Math.pow(rawMadness, 1.25) : 0;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = 0.3 + madness * 0.24;
        const fogShade = 0.02 - madness * 0.015;
        scene.fog.color.setRGB(fogShade, fogShade, fogShade + 0.003 * (1 - madness));
      }

      let scareFovShift = 0;
      if (sim.scareTimer > 0) {
        const p = 1 - sim.scareTimer / Math.max(0.1, sim.scareDuration);
        if (sim.scareFatal) {
          const crushSqueeze =
            p < 0.37
              ? -12 * (p / 0.37)
              : p < 0.62
                ? -12 - 14 * ((p - 0.37) / 0.25)
                : -26 + 8 * ((p - 0.62) / 0.38);
          scareFovShift = crushSqueeze + Math.sin(elapsed * 64) * (p < 0.62 ? 3.5 : 1.1);
        } else {
          scareFovShift = -15 * Math.min(1, p * 3.5) + Math.sin(elapsed * 64) * 4.2;
        }
      }
      const sanityFovDrift =
        madness > 0
          ? Math.sin(elapsed * (1.8 + madness * 1.6)) * 5.8 * madness +
            Math.sin(elapsed * 11.4) * 1.15 * madness * madness +
            madness * 5.2
          : 0;
      const isSlidingNow =
        sim.slideTimer > 0 &&
        currentPhase === 'playing' &&
        !sim.hidingLockerId &&
        sim.scareTimer <= 0;
      const slideProgress = isSlidingNow
        ? THREE.MathUtils.clamp(1 - sim.slideTimer / Math.max(0.1, sim.slideDuration), 0, 1)
        : 0;
      const slideFovBoost = isSlidingNow ? Math.sin(slideProgress * Math.PI) * 5.8 : 0;
      const targetFov = settingsRef.current.fov + sanityFovDrift + scareFovShift + slideFovBoost;
      if (Math.abs(camera.fov - targetFov) > 0.12) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      // Animate doors & lockers smoothly
      powerRoomDoorObj.doorPivot.rotation.y = THREE.MathUtils.damp(
        powerRoomDoorObj.doorPivot.rotation.y,
        sim.powerRoomOpened ? 1.55 : 0,
        6,
        dt,
      );
      hazardDoorObj.doorPivot.rotation.y = THREE.MathUtils.damp(
        hazardDoorObj.doorPivot.rotation.y,
        sim.hazardDoorOpened ? 1.55 : 0,
        6,
        dt,
      );
      officeDoorObj.doorPivot.rotation.y = THREE.MathUtils.damp(
        officeDoorObj.doorPivot.rotation.y,
        sim.officeUnlocked ? 1.55 : 0,
        6,
        dt,
      );
      exitObj.doorLeaf.rotation.y = THREE.MathUtils.damp(
        exitObj.doorLeaf.rotation.y,
        sim.exitOpened ? 1.42 : 0,
        4,
        dt,
      );
      lockerRigs.forEach((lk, id) => {
        const targetAngle = sim.hidingLockerId === id ? 0.11 : 0;
        lk.rig.doorPivot.rotation.y = THREE.MathUtils.damp(lk.rig.doorPivot.rotation.y, targetAngle, 8, dt);
      });

      // Animate floating dust motes smoothly without per-frame allocation
      for (let i = 0; i < DUST_COUNT; i++) {
        const ph = dustPhases[i];
        const i3 = i * 3;
        dustPositions[i3] = dustBaseX[i] + Math.sin(elapsed * 0.24 + ph) * 0.35;
        dustPositions[i3 + 1] = dustBaseY[i] + Math.cos(elapsed * 0.19 + ph * 1.3) * 0.18;
        dustPositions[i3 + 2] = dustBaseZ[i] + Math.sin(elapsed * 0.21 + ph * 0.7) * 0.35;
      }
      dustPosAttr.needsUpdate = true;

      if (currentPhase === 'menu') {
        // Atmospheric slow-drifting corridor camera for Main Menu
        const menuStart = cellToWorld(1, 15);
        camera.position.set(
          menuStart.x + 2.2 + Math.sin(elapsed * 0.28) * 1.5,
          1.58 + Math.sin(elapsed * 0.85) * 0.03,
          menuStart.z + Math.cos(elapsed * 0.22) * 0.24,
        );
        camera.rotation.set(
          Math.sin(elapsed * 0.35) * 0.032,
          -Math.PI / 2 + Math.sin(elapsed * 0.18) * 0.18,
          Math.sin(elapsed * 0.24) * 0.012,
          'YXZ',
        );
        flashlightRig.visible = false;
        flashlightSpot.visible = true;
        flashlightSpot.color.setHex(0xfff4d2);
        flashlightSpot.intensity = 2.15 + Math.sin(elapsed * 2.1) * 0.15;
        audio.setChaseTension(0);
      } else if (currentPhase === 'intro_fade' || currentPhase === 'playing' || currentPhase === 'hiding') {
        flashlightRig.visible = !sim.hidingLockerId;

        // Mobile touch look delta
        const mInput = mobileInputRef.current;
        if (Math.abs(mInput.lookDeltaX) > 0.01 || Math.abs(mInput.lookDeltaY) > 0.01) {
          const mSens = 0.004 * settingsRef.current.mouseSensitivity;
          applyLookDelta(mInput.lookDeltaX, mInput.lookDeltaY, mSens);
          mInput.lookDeltaX = 0;
          mInput.lookDeltaY = 0;
        }

        // Player movement (strictly locked while inside locker, during slide burst, or during jumpscare lunge)
        const binds = settingsRef.current.keyBindings ?? DEFAULT_KEY_BINDINGS;
        const usedCodes = new Set(Object.values(binds));
        if (sim.slideCooldown > 0) sim.slideCooldown = Math.max(0, sim.slideCooldown - dt);

        const activeSlide =
          sim.slideTimer > 0 && currentPhase === 'playing' && !sim.hidingLockerId && sim.scareTimer <= 0;

        let moveForward = 0;
        let moveStrafe = 0;
        if (currentPhase === 'playing' && !sim.hidingLockerId && sim.scareTimer <= 0 && !activeSlide) {
          if (keys.has(binds.walkForward) || (!usedCodes.has('ArrowUp') && keys.has('ArrowUp'))) {
            moveForward += 1;
          }
          if (keys.has(binds.walkBackward) || (!usedCodes.has('ArrowDown') && keys.has('ArrowDown'))) {
            moveForward -= 1;
          }
          if (keys.has(binds.moveRight) || (!usedCodes.has('ArrowRight') && keys.has('ArrowRight'))) {
            moveStrafe += 1;
          }
          if (keys.has(binds.moveLeft) || (!usedCodes.has('ArrowLeft') && keys.has('ArrowLeft'))) {
            moveStrafe -= 1;
          }

          moveForward += -mInput.moveY;
          moveStrafe += mInput.moveX;
        }

        const mag = Math.hypot(moveForward, moveStrafe);
        const isMoving = mag > 0.08 && currentPhase === 'playing' && !sim.hidingLockerId && !activeSlide;
        const runKeyDown =
          keys.has(binds.run) ||
          (binds.run === 'ShiftLeft' && !usedCodes.has('ShiftRight') && keys.has('ShiftRight'));
        const wantsSprint = (runKeyDown || mInput.sprinting) && !sim.crouching && !activeSlide;
        const isSprinting = isMoving && wantsSprint && sim.stamina > 2;

        if (isSprinting) {
          sim.stamina = Math.max(0, sim.stamina - 22 * dt);
          sim.sprintDuration = Math.min(12, sim.sprintDuration + dt);
          alertStalkerSound(sim.px, sim.pz, 16);
        } else if (!activeSlide) {
          sim.stamina = Math.min(100, sim.stamina + 14 * dt);
          sim.sprintDuration = Math.max(0, sim.sprintDuration - dt * 1.4);
        }
        audio.updateExertionBreathing(
          sim.stamina,
          sim.sprintDuration,
          isSprinting || activeSlide,
          currentPhase === 'playing' || currentPhase === 'hiding',
        );

        const speed = isSprinting ? 5.2 : sim.crouching ? 1.85 : 3.15;

        if (activeSlide) {
          sim.slideTimer = Math.max(0, sim.slideTimer - dt);
          const sp = 1 - sim.slideTimer / Math.max(0.1, sim.slideDuration);
          const slideSpeed = THREE.MathUtils.lerp(7.5, 2.2, sp * sp);
          const vx = sim.slideDirX * slideSpeed * dt;
          const vz = sim.slideDirZ * slideSpeed * dt;
          if (canOccupy(sim.px + vx, sim.pz)) sim.px += vx;
          if (canOccupy(sim.px, sim.pz + vz)) sim.pz += vz;
        } else if (isMoving) {
          const nf = moveForward / Math.max(1, mag);
          const ns = moveStrafe / Math.max(1, mag);

          _forward.set(-Math.sin(sim.yaw), 0, -Math.cos(sim.yaw));
          _right.set(Math.cos(sim.yaw), 0, -Math.sin(sim.yaw));

          const vx = (_forward.x * nf + _right.x * ns) * speed * dt;
          const vz = (_forward.z * nf + _right.z * ns) * speed * dt;

          if (canOccupy(sim.px + vx, sim.pz)) sim.px += vx;
          if (canOccupy(sim.px, sim.pz + vz)) sim.pz += vz;

          sim.walkPhase += dt * (isSprinting ? 12.5 : sim.crouching ? 5.5 : 8.2);
          const steppedSurface = audio.playFootstepAt(
            sim.px,
            sim.pz,
            isSprinting,
            sim.crouching,
          );

          // Footsteps noise attraction scaled by coordinate floor material profile
          if (!sim.crouching && elapsed - sim.lastPlayerNoiseTime > (isSprinting ? 0.34 : 0.65)) {
            sim.lastPlayerNoiseTime = elapsed;
            const activeSurface =
              steppedSurface ?? audio.getFootstepSurfaceAt(sim.px, sim.pz);
            const surfaceNoiseScale =
              audio.getFootstepManager().getSurfaceProfile(activeSurface).noiseAlertScale;
            alertStalkerSound(
              sim.px,
              sim.pz,
              (isSprinting ? 18.5 : 7.5) * surfaceNoiseScale,
            );
          }
        }

        // Smooth crouch + slide drop + head bob
        const targetEye = sim.hidingLockerId
          ? 1.52
          : activeSlide
            ? 0.74
            : sim.crouching
              ? 0.96
              : 1.65;
        sim.eyeHeight = THREE.MathUtils.damp(sim.eyeHeight, targetEye, activeSlide ? 16 : 10, dt);
        const bobY = isMoving ? Math.sin(sim.walkPhase) * (isSprinting ? 0.055 : 0.028) : 0;
        const bobX = isMoving ? Math.cos(sim.walkPhase * 0.5) * 0.018 : 0;

        const postHitShake =
          sim.shakeTimer > 0 ? (sim.shakeTimer / 0.45) * sim.shakeIntensity : 0;
        const shakePosX = postHitShake > 0 ? Math.sin(elapsed * 68) * 0.06 * postHitShake : 0;
        const shakePosY = postHitShake > 0 ? Math.cos(elapsed * 82) * 0.05 * postHitShake : 0;

        camera.position.set(sim.px + bobX + shakePosX, sim.eyeHeight + bobY + shakePosY, sim.pz);
        audio.updateSpatialListener(sim.px + bobX, sim.eyeHeight + bobY, sim.pz, sim.yaw, sim.pitch);
        const slideTilt = isSlidingNow ? -0.065 * Math.sin(slideProgress * Math.PI) : 0;
        const targetRoll =
          slideTilt +
          (madness > 0
            ? Math.sin(elapsed * 1.45) * 0.052 * madness +
              Math.sin(elapsed * 19) * 0.014 * madness * madness
            : 0) +
          (postHitShake > 0 ? Math.sin(elapsed * 56) * 0.095 * postHitShake : 0);
        sim.cameraRoll = THREE.MathUtils.damp(sim.cameraRoll, targetRoll, activeSlide ? 14 : 7, dt);
        const jitterX =
          (madness > 0.16 ? Math.sin(elapsed * 23) * 0.009 * madness * madness : 0) +
          (postHitShake > 0 ? Math.sin(elapsed * 73) * 0.042 * postHitShake : 0);
        const jitterY =
          (madness > 0.16 ? Math.cos(elapsed * 29) * 0.008 * madness * madness : 0) +
          (postHitShake > 0 ? Math.cos(elapsed * 61) * 0.036 * postHitShake : 0);
        camera.rotation.set(sim.pitch + jitterY, sim.yaw + jitterX, sim.cameraRoll, 'YXZ');

        // Flashlight battery drain (~105s continuous use starter / ~120s tactical) & low-battery sputter
        const lensMat = flashlightRig.userData.lensMat as THREE.MeshStandardMaterial | undefined;
        const ledMat = flashlightRig.userData.ledMat as THREE.MeshStandardMaterial | undefined;
        const rigFillLight = flashlightRig.userData.rigFillLight as THREE.PointLight | undefined;
        const upgraded = sim.hasBetterFlashlight;
        if (sim.scareTimer <= 0) {
          flashlightSpot.color.setHex(upgraded ? 0xf6faff : 0xfff4d2);
          flashlightSpot.distance = upgraded ? 24.0 : 13.5;
          flashlightSpot.angle = upgraded ? Math.PI / 5.0 : Math.PI / 7.8;
          flashlightSpot.penumbra = upgraded ? 0.62 : 0.46;
          flashlightSpot.decay = upgraded ? 1.55 : 2.0;
        }
        const fullIntensity = upgraded ? 6.4 : 3.2;

        if (sim.flashlightOn && sim.battery > 0) {
          const drainPerSec = upgraded ? 0.82 : 0.95;
          sim.battery = Math.max(0, sim.battery - drainPerSec * dt);
          if (sim.battery < 25 && sim.battery > 0 && !sim.hasShownLowBatteryHint) {
            sim.hasShownLowBatteryHint = true;
            callbacksRef.current.onStatusToast(
              `Battery low (<25%) — Conserve light (${formatKeyCode(binds.flashlight)}) or use a Battery Pack!`,
            );
          }
          if (sim.battery <= 0) {
            sim.flashlightOn = false;
            flashlightSpot.intensity = 0;
            flashlightSpot.visible = false;
            if (lensMat) lensMat.emissiveIntensity = 0;
            if (ledMat) ledMat.emissiveIntensity = 0;
            if (rigFillLight) rigFillLight.intensity = 0.08;
            audio.playFlashlightClick(false);
            callbacksRef.current.onStatusToast(
              'Flashlight battery died! Find a Battery Pack in the halls.',
            );
          } else if (sim.battery < 18) {
            const sputterOn = Math.random() > 0.16;
            const dimScale = 0.45 + (sim.battery / 18) * 0.35;
            flashlightSpot.visible = sputterOn;
            flashlightSpot.intensity = sputterOn
              ? fullIntensity * dimScale + Math.random() * 0.75
              : 0;
            if (lensMat) lensMat.emissiveIntensity = sputterOn ? 1.05 : 0.1;
            if (ledMat) ledMat.emissiveIntensity = sputterOn ? 1.6 : 0.15;
            if (rigFillLight) rigFillLight.intensity = sputterOn ? 0.22 : 0.08;
          } else {
            flashlightSpot.visible = true;
            flashlightSpot.intensity = fullIntensity;
            if (lensMat) lensMat.emissiveIntensity = upgraded ? 2.0 : 1.5;
            if (ledMat) ledMat.emissiveIntensity = upgraded ? 2.8 : 2.2;
            if (rigFillLight) rigFillLight.intensity = upgraded ? 0.3 : 0.24;
          }
        } else {
          flashlightSpot.intensity = 0;
          flashlightSpot.visible = false;
          if (lensMat) lensMat.emissiveIntensity = 0;
          if (ledMat) ledMat.emissiveIntensity = 0;
          if (rigFillLight) rigFillLight.intensity = 0.08;
        }

        flashlightRig.position.x = 0.22 + Math.cos(sim.walkPhase * 0.5) * 0.011;
        flashlightRig.position.y = -0.20 + Math.sin(sim.walkPhase) * 0.011;

        // Raycast aiming prompt
        const aimed = getAimedTarget();
        const aimedId = aimed ? aimed.id : null;
        const interactKeyLabel = formatKeyCode(binds.interact).toUpperCase();
        if (aimedId !== sim.lastPromptId || sim.hidingLockerId) {
          sim.lastPromptId = aimedId;
          if (!aimed) {
            callbacksRef.current.onPromptChange(null);
          } else if (aimed.kind === 'pickup' && aimed.itemId) {
            if (aimed.itemId === 'lore_note') {
              callbacksRef.current.onPromptChange({
                targetId: aimed.id,
                pcLabel: `${interactKeyLabel} — READ LORE NOTE`,
                mobileLabel: 'READ NOTE',
              });
            } else {
              callbacksRef.current.onPromptChange({
                targetId: aimed.id,
                pcLabel: `${interactKeyLabel} — PICK UP ${ITEM_CATALOG[aimed.itemId].name.toUpperCase()}`,
                mobileLabel: `PICK UP ${ITEM_CATALOG[aimed.itemId].name.toUpperCase()}`,
              });
            }
          } else if (aimed.kind === 'power_door') {
            callbacksRef.current.onPromptChange({
              targetId: aimed.id,
              pcLabel: sim.powerRoomOpened
                ? 'POWER ROOM OPEN'
                : `${interactKeyLabel} — PRY DOOR (HEAVY CROWBAR)`,
              mobileLabel: sim.powerRoomOpened ? 'OPEN' : 'PRY DOOR',
            });
          } else if (aimed.kind === 'power_switch') {
            callbacksRef.current.onPromptChange({
              targetId: aimed.id,
              pcLabel: sim.powerSwitchedOn
                ? 'POWER VOLTAGE ON'
                : `${interactKeyLabel} — SWITCH ON POWER BUTTON`,
              mobileLabel: sim.powerSwitchedOn ? 'POWER ON' : 'POWER ON',
            });
          } else if (aimed.kind === 'hazard_door') {
            callbacksRef.current.onPromptChange({
              targetId: aimed.id,
              pcLabel: sim.hazardDoorOpened
                ? 'BLACK & YELLOW DOOR OPEN'
                : sim.powerSwitchedOn
                  ? `${interactKeyLabel} — OPEN BLACK & YELLOW DOOR`
                  : 'LOCKED — SWITCH ON POWER BUTTON FIRST',
              mobileLabel: sim.powerSwitchedOn ? 'OPEN DOOR' : 'NO POWER',
            });
          } else if (aimed.kind === 'office_door') {
            callbacksRef.current.onPromptChange({
              targetId: aimed.id,
              pcLabel: sim.officeUnlocked ? 'OFFICE OPEN' : `${interactKeyLabel} — OPEN OFFICE DOOR`,
              mobileLabel: sim.officeUnlocked ? 'OPEN' : 'OPEN OFFICE',
            });
          } else if (aimed.kind === 'exit_door') {
            callbacksRef.current.onPromptChange({
              targetId: aimed.id,
              pcLabel: sim.exitOpened
                ? `${interactKeyLabel} — STEP INTO OUR WORLD`
                : `${interactKeyLabel} — UNLOCK EXIT DOOR (OLD BRASS KEY)`,
              mobileLabel: sim.exitOpened ? 'ESCAPE' : 'UNLOCK EXIT',
            });
          } else if (aimed.kind === 'locker') {
            callbacksRef.current.onPromptChange({
              targetId: aimed.id,
              pcLabel: sim.hidingLockerId
                ? `${interactKeyLabel} — EXIT LOCKER`
                : `${interactKeyLabel} — HIDE IN LOCKER`,
              mobileLabel: sim.hidingLockerId ? 'EXIT LOCKER' : 'HIDE',
            });
          }
        }

        // Complete chapter when player steps through the unlocked Exit Door into the warm sunlit threshold (17, 1)
        if (sim.exitOpened && currentPhase === 'playing') {
          const playerCell = worldToCell(sim.px, sim.pz);
          if (playerCell.gx >= 17 && playerCell.gz <= 2) {
            if (document.pointerLockElement) document.exitPointerLock?.();
            callbacksRef.current.onChapterComplete();
            return;
          }
        }

        // Dynamic Horror Events
        if (currentPhase === 'playing') {
          sim.nextHorrorEventIn -= dt;
          if (sim.nextHorrorEventIn <= 0) {
            sim.nextHorrorEventIn = 22 + Math.random() * 20;
            const roll = Math.random();
            if (roll < 0.3) {
              sim.globalFlickerTimer = 1.8;
              audio.playHorrorEvent('flicker');
            } else if (roll < 0.52) {
              sim.globalBlackoutTimer = 4.2;
              audio.playHorrorEvent('flicker');
              callbacksRef.current.onStatusToast('Sector lights failed...');
            } else if (roll < 0.76) {
              audio.playHorrorEvent('footsteps_behind');
            } else {
              audio.playHorrorEvent('slam');
            }
          }
        }

        // Stalker AI State Machine & Grid Pathfinding (with fog stalking & spatialized footsteps)
        const prevStalkerState = sim.stalkerState;
        const doorState = getDoorState();
        const distToPlayer = Math.hypot(sim.stalkerX - sim.px, sim.stalkerZ - sim.pz);
        const sightRange = sim.flashlightOn ? 18 : sim.crouching ? 8.5 : 13;
        if (sim.stalkerRetreatCooldown > 0) sim.stalkerRetreatCooldown -= dt;

        // Check if player is looking directly toward the Stalker down the corridor
        _camDir.set(-Math.sin(sim.yaw), 0, -Math.cos(sim.yaw));
        _camPos.set(sim.stalkerX - sim.px, 0, sim.stalkerZ - sim.pz);
        if (_camPos.lengthSq() > 0.0001) _camPos.normalize();
        const playerLookingAtStalker =
          distToPlayer < 24 &&
          _camDir.dot(_camPos) > 0.68 &&
          hasLineOfSight(sim.px, sim.pz, sim.stalkerX, sim.stalkerZ, doorState);

        let seesPlayer = false;
        if (!sim.hidingLockerId && distToPlayer < sightRange) {
          _toPlayer.set(sim.px - sim.stalkerX, 0, sim.pz - sim.stalkerZ).normalize();
          _stalkerForward.set(Math.sin(sim.stalkerYaw), 0, Math.cos(sim.stalkerYaw));
          const fovDot = _stalkerForward.dot(_toPlayer);
          if (fovDot > 0.28 || distToPlayer < 4.0) {
            if (hasLineOfSight(sim.stalkerX, sim.stalkerZ, sim.px, sim.pz, doorState)) {
              seesPlayer = true;
            }
          }
        }

        if (sim.hidingLockerId && sim.sawPlayerHideLocker) {
          sim.stalkerState = 'chase';
          sim.stalkerTargetX = sim.px;
          sim.stalkerTargetZ = sim.pz;
        } else if (sim.stalkerState === 'retreat') {
          sim.stalkTimer -= dt;
          const retreatCell = STALKER_PATROL_CELLS[sim.stalkerPatrolIdx];
          const retreatWorld = cellToWorld(retreatCell.gx, retreatCell.gz);
          sim.stalkerTargetX = retreatWorld.x;
          sim.stalkerTargetZ = retreatWorld.z;
          if (
            sim.stalkTimer <= 0 ||
            Math.hypot(sim.stalkerX - retreatWorld.x, sim.stalkerZ - retreatWorld.z) < 1.4
          ) {
            sim.stalkerState = 'patrol';
          }
        } else if (sim.stalkerState === 'stalk') {
          sim.stalkTimer -= dt;
          if (distToPlayer < 6.4 && !sim.hidingLockerId && currentPhase === 'playing') {
            sim.stalkerState = 'chase';
            sim.stalkerTargetX = sim.px;
            sim.stalkerTargetZ = sim.pz;
          } else if (playerLookingAtStalker) {
            // Freeze still in the black fog while staring back with 2 white eyes & 1 mouth
            sim.stalkerTargetX = sim.stalkerX;
            sim.stalkerTargetZ = sim.stalkerZ;
            sim.stalkStareTimer += dt;
            if (sim.stalkStareTimer > 2.2 || sim.stalkTimer <= 0) {
              if (!sim.hidingLockerId && Math.random() < 0.62) {
                sim.stalkerState = 'chase';
                sim.stalkerTargetX = sim.px;
                sim.stalkerTargetZ = sim.pz;
                audio.playHorrorEvent('static');
              } else {
                sim.stalkerState = 'retreat';
                sim.stalkTimer = 5.0;
                sim.stalkerRetreatCooldown = 14;
                sim.stalkerPatrolIdx = (sim.stalkerPatrolIdx + 2) % STALKER_PATROL_CELLS.length;
              }
            }
          } else {
            // Creep silently closer whenever player turns away
            sim.stalkStareTimer = Math.max(0, sim.stalkStareTimer - dt * 0.5);
            sim.stalkerTargetX = sim.px;
            sim.stalkerTargetZ = sim.pz;
            if (sim.stalkTimer <= 0 && distToPlayer > 14) {
              sim.stalkerState = 'patrol';
              sim.stalkerRetreatCooldown = 8;
            }
          }
        } else if (seesPlayer && currentPhase === 'playing') {
          if (
            distToPlayer > 8.2 &&
            sim.stalkerState !== 'chase' &&
            sim.stalkerRetreatCooldown <= 0
          ) {
            sim.stalkerState = 'stalk';
            sim.stalkTimer = 4.6;
            sim.stalkStareTimer = 0;
            sim.stalkerTargetX = sim.stalkerX;
            sim.stalkerTargetZ = sim.stalkerZ;
          } else {
            sim.stalkerState = 'chase';
            sim.stalkerTargetX = sim.px;
            sim.stalkerTargetZ = sim.pz;
          }
        } else if (sim.stalkerState === 'chase') {
          sim.stalkerState = 'search';
          sim.stalkerSearchTimer = 5.5;
        } else if (sim.stalkerState === 'search') {
          sim.stalkerSearchTimer -= dt;
          if (sim.stalkerSearchTimer <= 0) {
            sim.stalkerState = 'patrol';
            const nextP = cellToWorld(
              STALKER_PATROL_CELLS[sim.stalkerPatrolIdx].gx,
              STALKER_PATROL_CELLS[sim.stalkerPatrolIdx].gz,
            );
            sim.stalkerTargetX = nextP.x;
            sim.stalkerTargetZ = nextP.z;
          }
        } else if (sim.stalkerState === 'investigate') {
          if (Math.hypot(sim.stalkerX - sim.stalkerTargetX, sim.stalkerZ - sim.stalkerTargetZ) < 1.2) {
            sim.stalkerState = 'search';
            sim.stalkerSearchTimer = 4.0;
          }
        } else {
          // Patrol — occasionally stop down a dark corridor to stalk the player from the fog
          if (
            currentPhase === 'playing' &&
            !sim.hidingLockerId &&
            sim.stalkerRetreatCooldown <= 0 &&
            distToPlayer >= 8.5 &&
            distToPlayer <= 20 &&
            hasLineOfSight(sim.stalkerX, sim.stalkerZ, sim.px, sim.pz, doorState)
          ) {
            sim.stalkerState = 'stalk';
            sim.stalkTimer = 4.2;
            sim.stalkStareTimer = 0;
            sim.stalkerTargetX = sim.stalkerX;
            sim.stalkerTargetZ = sim.stalkerZ;
          } else {
            const goal = STALKER_PATROL_CELLS[sim.stalkerPatrolIdx];
            const goalWorld = cellToWorld(goal.gx, goal.gz);
            sim.stalkerTargetX = goalWorld.x;
            sim.stalkerTargetZ = goalWorld.z;
            if (Math.hypot(sim.stalkerX - goalWorld.x, sim.stalkerZ - goalWorld.z) < 1.2) {
              sim.stalkerPatrolIdx = (sim.stalkerPatrolIdx + 1) % STALKER_PATROL_CELLS.length;
            }
          }
        }

        // Recompute BFS path periodically
        sim.stalkerPathTimer -= dt;
        if (sim.stalkerPathTimer <= 0) {
          sim.stalkerPathTimer = sim.stalkerState === 'chase' ? 0.35 : 0.9;
          const sc = worldToCell(sim.stalkerX, sim.stalkerZ);
          const gc = worldToCell(sim.stalkerTargetX, sim.stalkerTargetZ);
          sim.stalkerPath = findGridPath(sc.gx, sc.gz, gc.gx, gc.gz, doorState);
        }

        let moveTargetX = sim.stalkerTargetX;
        let moveTargetZ = sim.stalkerTargetZ;
        if (sim.stalkerPath.length > 0) {
          const wp = cellToWorld(sim.stalkerPath[0].gx, sim.stalkerPath[0].gz);
          if (Math.hypot(sim.stalkerX - wp.x, sim.stalkerZ - wp.z) < 0.7) {
            sim.stalkerPath.shift();
          }
          if (sim.stalkerPath.length > 0) {
            const nextWp = cellToWorld(sim.stalkerPath[0].gx, sim.stalkerPath[0].gz);
            moveTargetX = nextWp.x;
            moveTargetZ = nextWp.z;
          }
        }

        const isStalkFrozen = sim.stalkerState === 'stalk' && playerLookingAtStalker;
        const stalkerSpeed =
          sim.stalkerStunTimer > 0
            ? 0.5
            : isStalkFrozen
              ? 0
              : sim.stalkerState === 'chase'
                ? 5.75
                : sim.stalkerState === 'retreat'
                  ? 4.35
                  : sim.stalkerState === 'investigate'
                    ? 3.85
                    : sim.stalkerState === 'stalk'
                      ? 3.55
                      : 2.65;

        const dx = moveTargetX - sim.stalkerX;
        const dz = moveTargetZ - sim.stalkerZ;
        const moveDist = Math.hypot(dx, dz);
        if (stalkerSpeed > 0.05 && moveDist > 0.15) {
          sim.stalkerX += (dx / moveDist) * stalkerSpeed * dt;
          sim.stalkerZ += (dz / moveDist) * stalkerSpeed * dt;
          const targetYaw = Math.atan2(dx, dz);
          let diff = targetYaw - sim.stalkerYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          sim.stalkerYaw += diff * Math.min(1, dt * 8);
        } else if (sim.stalkerState === 'stalk') {
          // Stare straight toward the player from inside the black fog
          const stareYaw = Math.atan2(sim.px - sim.stalkerX, sim.pz - sim.stalkerZ);
          let diff = stareYaw - sim.stalkerYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          sim.stalkerYaw += diff * Math.min(1, dt * 10);
        }

        // Update Stalker terrifying composite rig animation (or custom GLB mixer) + 3D spatialized footsteps
        const isChasing = sim.stalkerState === 'chase';
        const isStalking = sim.stalkerState === 'stalk';
        _right.set(Math.cos(sim.yaw), 0, -Math.sin(sim.yaw));
        _camPos.set(sim.stalkerX - sim.px, 0, sim.stalkerZ - sim.pz);
        if (_camPos.lengthSq() > 0.0001) _camPos.normalize();
        const stalkerPan = _right.dot(_camPos);

        if (
          distToPlayer <= 20 &&
          sim.stalkerState !== prevStalkerState &&
          (isChasing || isStalking)
        ) {
          audio.playGhostProximitySfx('intense', distToPlayer, stalkerPan, true);
        }

        sim.stalkerWalkCycle += dt * stalkerSpeed * 2.2;
        const curStepSin = Math.sin(sim.stalkerWalkCycle);
        if (stalkerSpeed > 0.6 && ((sim.lastStalkerStepSin <= 0 && curStepSin > 0) || (sim.lastStalkerStepSin >= 0 && curStepSin < 0))) {
          audio.playStalkerFootstep(
            sim.stalkerX,
            sim.stalkerZ,
            distToPlayer,
            getFloorMaterialAtWorld(sim.stalkerX, sim.stalkerZ),
            isChasing,
            stalkerPan,
          );
        }
        sim.lastStalkerStepSin = curStepSin;

        // Fade white 2 eyes & 1 mouth eerily out of the pitch-black fog
        const faceVis =
          distToPlayer < 26
            ? THREE.MathUtils.clamp(1 - Math.max(0, distToPlayer - 14) / 12, 0.08, 0.96)
            : 0;
        for (const fMat of stalkerRig.whiteFaceMats) {
          fMat.opacity = faceVis;
        }

        stalkerRig.group.position.set(sim.stalkerX, 0, sim.stalkerZ);
        stalkerRig.group.rotation.y = sim.stalkerYaw;
        if (customGhostAsset?.mixer) {
          customGhostAsset.mixer.timeScale = stalkerSpeed === 0 ? 0 : isChasing ? 1.65 : 1.0;
          customGhostAsset.mixer.update(dt);
        }
        const strideSin = stalkerSpeed > 0.1 ? Math.sin(sim.stalkerWalkCycle) : 0;
        const strideCos = stalkerSpeed > 0.1 ? Math.cos(sim.stalkerWalkCycle) : 0;
        stalkerRig.pelvisGroup.position.y = 1.24 + Math.abs(strideCos) * 0.035;
        stalkerRig.pelvisGroup.rotation.z = strideSin * 0.04;

        stalkerRig.leftLeg.rotation.x = strideSin * 0.54;
        stalkerRig.rightLeg.rotation.x = -strideSin * 0.54;
        stalkerRig.leftKnee.rotation.x =
          stalkerSpeed > 0.1 ? 0.14 + Math.max(0, -strideCos) * 0.52 : 0.08;
        stalkerRig.rightKnee.rotation.x =
          stalkerSpeed > 0.1 ? 0.14 + Math.max(0, strideCos) * 0.52 : 0.08;
        stalkerRig.leftAnkle.rotation.x = -stalkerRig.leftKnee.rotation.x * 0.45;
        stalkerRig.rightAnkle.rotation.x = -stalkerRig.rightKnee.rotation.x * 0.45;

        // Articulated arms & elbows reach violently forward when chasing, hang low when stalking
        if (isChasing) {
          stalkerRig.leftArm.rotation.x = -1.06 + Math.sin(elapsed * 16) * 0.28;
          stalkerRig.rightArm.rotation.x = -1.06 - Math.sin(elapsed * 16) * 0.28;
          stalkerRig.leftElbow.rotation.x = -0.52 + Math.cos(elapsed * 16) * 0.18;
          stalkerRig.rightElbow.rotation.x = -0.52 - Math.cos(elapsed * 16) * 0.18;
          stalkerRig.leftWrist.rotation.x = -0.25;
          stalkerRig.rightWrist.rotation.x = -0.25;
          stalkerRig.torsoGroup.rotation.x = 0.22 + Math.sin(elapsed * 18) * 0.05;
        } else if (isStalkFrozen) {
          stalkerRig.leftArm.rotation.x = -0.1 + Math.sin(elapsed * 1.8) * 0.04;
          stalkerRig.rightArm.rotation.x = -0.1 - Math.sin(elapsed * 1.8) * 0.04;
          stalkerRig.leftElbow.rotation.x = -0.24;
          stalkerRig.rightElbow.rotation.x = -0.24;
          stalkerRig.leftWrist.rotation.x = 0.12;
          stalkerRig.rightWrist.rotation.x = 0.12;
          stalkerRig.torsoGroup.rotation.x = 0.14;
        } else {
          stalkerRig.leftArm.rotation.x = -0.08 - strideSin * 0.28;
          stalkerRig.rightArm.rotation.x = -0.08 + strideSin * 0.28;
          stalkerRig.leftElbow.rotation.x = -0.32 + strideCos * 0.16;
          stalkerRig.rightElbow.rotation.x = -0.32 - strideCos * 0.16;
          stalkerRig.leftWrist.rotation.x = 0.08;
          stalkerRig.rightWrist.rotation.x = 0.08;
          stalkerRig.torsoGroup.rotation.x = 0.09;
        }
        // Crooked Entity-Sighting head tilt + spasmodic micro-twitch + elongated screaming jaw
        const twitch = Math.sin(elapsed * 29) * Math.max(0, Math.sin(elapsed * 2.4));
        stalkerRig.neckGroup.rotation.x = isChasing ? 0.24 : 0.12;
        stalkerRig.headGroup.rotation.z = 0.2 + Math.sin(elapsed * 2.1) * 0.12 + twitch * 0.28;
        stalkerRig.headGroup.rotation.y = twitch * 0.2;
        stalkerRig.jawGroup.rotation.x = isChasing
          ? 0.44 + Math.abs(Math.sin(elapsed * 14)) * 0.22
          : isStalking
            ? 0.36 + Math.sin(elapsed * 4.5) * 0.06
            : 0.2 + Math.max(0, Math.sin(elapsed * 3.1)) * 0.1;
        const tendrilFreq = isChasing ? 9.5 : isStalking ? 3.2 : 2.1;
        for (let ti = 0; ti < stalkerRig.tendrils.length; ti++) {
          const td = stalkerRig.tendrils[ti];
          const sideSign = ti % 2 === 0 ? 1 : -1;
          td.rotation.z = sideSign * (0.52 + Math.sin(elapsed * tendrilFreq + ti * 1.4) * 0.18);
          td.rotation.x = -0.35 + Math.cos(elapsed * tendrilFreq * 0.8 + ti) * 0.14;
        }

        // Smooth Panic buildup when Stalker enters close radius (<= 12.5m), slow decay when safe
        const panicRadius = 12.5;
        const rawProximity = THREE.MathUtils.clamp((panicRadius - distToPlayer) / 10.0, 0, 1);
        const targetPanic =
          distToPlayer <= panicRadius || isChasing
            ? THREE.MathUtils.clamp(
                rawProximity * 0.85 + (isChasing ? 0.35 : isStalking ? 0.18 : 0),
                0,
                1,
              )
            : 0;
        sim.panic = THREE.MathUtils.damp(
          sim.panic,
          targetPanic,
          targetPanic > sim.panic ? 1.35 : 0.75,
          dt,
        );

        // Spatialized Stalker SFX cues, chaotic 15u whispers, "I SEE YOU" voice & heart rate
        audio.tickMonsterProximity(
          distToPlayer,
          isChasing,
          stalkerPan,
          sim.stalkerState,
          sim.panic,
        );
        audio.setChaseTension(
          isChasing ? 1 : Math.max(sim.panic * 0.65, Math.max(0, 1 - distToPlayer / 16) * 0.55),
        );

        if (sim.iSeeYouTimer > 0) {
          sim.iSeeYouTimer = Math.max(0, sim.iSeeYouTimer - dt);
        }
        if (distToPlayer <= 15) {
          const paceMult = isChasing ? 1.55 : isStalking ? 1.25 : 1.0;
          sim.nextISeeYouIn -= dt * paceMult;
          if (sim.nextISeeYouIn <= 0) {
            const closeness = THREE.MathUtils.clamp((15 - distToPlayer) / 15, 0.2, 1);
            audio.playISeeYouWhisper(closeness, stalkerPan);
            sim.iSeeYouTimer = 2.0;
            sim.nextISeeYouIn = Math.max(4.4, 10.6 - closeness * 5.8);
          }
        } else {
          sim.nextISeeYouIn = Math.min(sim.nextISeeYouIn, 1.2);
        }

        // Cooldown timers for Stalker slash hits
        if (sim.hitCooldown > 0) sim.hitCooldown -= dt;
        if (sim.stalkerStunTimer > 0) sim.stalkerStunTimer -= dt;

        // High-Intensity Jumpscare & Fatal Eye-Crush Cutscene System
        if (sim.scareTimer > 0) {
          sim.scareTimer = Math.max(0, sim.scareTimer - dt);
          const progress = 1 - sim.scareTimer / Math.max(0.1, sim.scareDuration);
          // Snap-fast cubic ease for whip-pan directly onto the entity's pale skull
          const panRate = sim.scareFatal ? 4.4 : 3.8;
          const lungeRate = sim.scareFatal ? 3.2 : 2.4;
          const panEase = 1 - Math.pow(1 - Math.min(1, progress * panRate), 3);
          const lungeEase = 1 - Math.pow(1 - Math.min(1, progress * lungeRate), 2);

          const stareDirX = sim.px - sim.stalkerX;
          const stareDirZ = sim.pz - sim.stalkerZ;
          const stareHoriz = Math.max(0.01, Math.hypot(stareDirX, stareDirZ));
          const distGoal = sim.scareFatal ? 0.94 : 1.02;
          const faceX = sim.stalkerX + (stareDirX / stareHoriz) * distGoal;
          const faceZ = sim.stalkerZ + (stareDirZ / stareHoriz) * distGoal;

          const curCamX = THREE.MathUtils.lerp(sim.scareStartX, faceX, lungeEase);
          const sinkDown = sim.scareFatal && progress > 0.58 ? ((progress - 0.58) / 0.42) * 0.22 : 0;
          const curCamY = THREE.MathUtils.lerp(sim.scareStartY, 2.38, lungeEase) - sinkDown;
          const curCamZ = THREE.MathUtils.lerp(sim.scareStartZ, faceZ, lungeEase);

          // Exact YXZ yaw & pitch aiming camera straight at the Stalker's screaming face (y = 2.54)
          const lookVx = sim.stalkerX - curCamX;
          const lookVy = 2.54 - curCamY;
          const lookVz = sim.stalkerZ - curCamZ;
          const targetYaw = Math.atan2(-lookVx, -lookVz);
          const targetPitch = Math.atan2(lookVy, Math.max(0.01, Math.hypot(lookVx, lookVz)));
          let yawDelta = targetYaw - sim.scareStartYaw;
          while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
          while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;

          const panYaw = sim.scareStartYaw + yawDelta * panEase;
          const panPitch = THREE.MathUtils.lerp(sim.scareStartPitch, targetPitch, panEase);

          // Violent screen shake peaking on eye crush, easing to heavy drowning slump
          const crushImpactBoost =
            sim.scareFatal && progress >= 0.36 && progress <= 0.62 ? 1.38 : 1.0;
          const amp =
            (sim.scareFatal
              ? (progress > 0.62 ? 0.38 : 0.95) * crushImpactBoost
              : (1 - progress * 0.35) * 0.78);
          const shakeX = (Math.sin(elapsed * 74) * 0.08 + Math.cos(elapsed * 119) * 0.05) * amp;
          const shakeY = (Math.cos(elapsed * 66) * 0.075 + Math.sin(elapsed * 107) * 0.045) * amp;
          const shakeZ = Math.sin(elapsed * 89) * 0.06 * amp;
          const yawJitter = Math.sin(elapsed * 81) * 0.075 * amp;
          const pitchJitter = Math.cos(elapsed * 93) * 0.065 * amp;
          const rollShake = (Math.sin(elapsed * 58) * 0.16 + Math.cos(elapsed * 97) * 0.06) * amp;

          camera.position.set(curCamX + shakeX, curCamY + shakeY, curCamZ + shakeZ);
          camera.rotation.set(panPitch + pitchJitter, panYaw + yawJitter, rollShake, 'YXZ');

          // Entity locks directly onto victim with screaming wide-open jaw & violent arm lunge
          sim.stalkerYaw = Math.atan2(curCamX - sim.stalkerX, curCamZ - sim.stalkerZ);
          stalkerRig.group.rotation.y = sim.stalkerYaw;
          stalkerRig.jawGroup.rotation.x = 0.62;
          stalkerRig.leftArm.rotation.x = -1.42 + Math.sin(elapsed * 28) * 0.14;
          stalkerRig.rightArm.rotation.x = -1.42 - Math.sin(elapsed * 28) * 0.14;
          for (const fMat of stalkerRig.whiteFaceMats) {
            fMat.opacity = 1.0;
          }

          if (sim.scareFatal) {
            flashlightRig.visible = false;
            flashlightSpot.position.set(0, -0.02, 0.05);
            flashlightSpot.visible = progress < 0.72 && Math.random() > 0.2;
            flashlightSpot.intensity = progress > 0.38 ? 4.2 : 7.0;
            flashlightSpot.color.setHex(progress > 0.38 || Math.random() > 0.45 ? 0xff1e1e : 0xfff6e5);

            // Choreograph 3D Ghost Crush Hands reaching toward & crushing the player's eyes
            crushHandsRig.group.visible = true;
            crushLight.intensity = progress < 0.65 ? 3.8 : THREE.MathUtils.lerp(3.8, 1.4, (progress - 0.65) / 0.35);
            crushLight.color.setHex(progress >= 0.37 ? 0xff2222 : 0xe5d6c5);

            let hx = 0.1;
            let hy = -0.015;
            let hz = -0.25;
            let rotY = 0.28;
            let rotZ = 0.18;
            let fingerCurl = 0.08;

            if (progress < 0.37) {
              // Beat 1: Hands emerge from darkness toward player's eyes, claws spread wide
              const t = progress / 0.37;
              const ease = 1 - Math.pow(1 - t, 2.4);
              hx = THREE.MathUtils.lerp(0.42, 0.105, ease);
              hy = THREE.MathUtils.lerp(-0.32, -0.01, ease);
              hz = THREE.MathUtils.lerp(-0.74, -0.25, ease);
              rotY = THREE.MathUtils.lerp(0.68, 0.28, ease);
              rotZ = THREE.MathUtils.lerp(0.46, 0.16, ease);
              fingerCurl = 0.05 + Math.sin(elapsed * 24) * 0.06;
            } else if (progress < 0.62) {
              // Beat 2: Hands slam onto the eye sockets & all 10 claws clamp shut
              const t = (progress - 0.37) / 0.25;
              const squeeze = 1 - Math.pow(1 - t, 3);
              const tremble = Math.sin(elapsed * 78) * 0.008;
              hx = THREE.MathUtils.lerp(0.105, 0.044, squeeze) + tremble;
              hy = THREE.MathUtils.lerp(-0.01, 0.006, squeeze) + Math.cos(elapsed * 64) * 0.006;
              hz = THREE.MathUtils.lerp(-0.25, -0.155, squeeze);
              rotY = THREE.MathUtils.lerp(0.28, 0.42, squeeze);
              rotZ = THREE.MathUtils.lerp(0.16, -0.06, squeeze);
              fingerCurl = THREE.MathUtils.lerp(0.1, 1.18, squeeze);
            } else {
              // Beat 3: Clenched hands linger darkly as blood water submerges the vision
              const t = (progress - 0.62) / 0.38;
              hx = 0.044 + Math.sin(elapsed * 18) * 0.005;
              hy = 0.006 - t * 0.05;
              hz = -0.155 - t * 0.055;
              rotY = 0.42;
              rotZ = -0.06;
              fingerCurl = 1.18;
            }

            crushHandsRig.leftHand.position.set(-hx, hy, hz);
            crushHandsRig.leftHand.rotation.set(0.08, -rotY, -rotZ);
            crushHandsRig.rightHand.position.set(hx, hy, hz);
            crushHandsRig.rightHand.rotation.set(0.08, rotY, rotZ);
            for (const f of crushHandsRig.leftFingers) {
              f.rotation.x = -fingerCurl;
            }
            for (const f of crushHandsRig.rightFingers) {
              f.rotation.x = -fingerCurl;
            }
          } else {
            crushHandsRig.group.visible = false;
            crushLight.intensity = 0;
            flashlightSpot.visible = Math.random() > 0.24;
            flashlightSpot.intensity = 7.4;
            flashlightSpot.color.setHex(Math.random() > 0.45 ? 0xff2626 : 0xfff6e5);
          }

          if (sim.scareTimer <= 0) {
            crushHandsRig.group.visible = false;
            crushLight.intensity = 0;
            flashlightSpot.position.set(0.18, -0.14, -0.35);
            flashlightSpot.color.setHex(sim.hasBetterFlashlight ? 0xf6faff : 0xfff4d2);
            if (sim.scareFatal) {
              sim.health = 0;
              sim.maxSanity = 0;
              sim.sanity = 0;
              if (document.pointerLockElement) document.exitPointerLock?.();
              callbacksRef.current.onPlayerCaught(
                sim.sawPlayerHideLocker
                  ? 'It ripped the locker door open and finished you.'
                  : 'It caught you in the dark — Sanity depleted.',
              );
            } else {
              // Non-fatal grab jumpscare ends with player breaking free & stumbling back
              sim.yaw = panYaw;
              sim.pitch = THREE.MathUtils.clamp(panPitch, -0.8, 0.8);
              sim.shakeTimer = 0.45;
              sim.shakeIntensity = 0.72;
              const awayDist = Math.max(0.01, distToPlayer);
              const pushX = ((sim.px - sim.stalkerX) / awayDist) * 1.45;
              const pushZ = ((sim.pz - sim.stalkerZ) / awayDist) * 1.45;
              if (canOccupy(sim.px + pushX, sim.pz)) sim.px += pushX;
              if (canOccupy(sim.px, sim.pz + pushZ)) sim.pz += pushZ;
              callbacksRef.current.onStatusToast(
                sim.health <= 40
                  ? `CRITICAL — HP ${sim.health}% · Max Sanity ${sim.maxSanity}%! Next hit is fatal!`
                  : `You broke free! HP ${sim.health}% · Max Sanity capped at ${sim.maxSanity}%`,
              );
            }
          }
        } else {
          crushHandsRig.group.visible = false;
          crushLight.intensity = 0;
          // Trigger Jumpscare when caught by Stalker (or ripped from a compromised locker)
          const startJumpscare = (fatal: boolean) => {
            sim.scareStartX = camera.position.x;
            sim.scareStartY = camera.position.y;
            sim.scareStartZ = camera.position.z;
            sim.scareStartYaw = sim.yaw;
            sim.scareStartPitch = sim.pitch;
            sim.scareFatal = fatal;
            sim.scareDuration = fatal ? 2.75 : 0.42;
            sim.scareTimer = sim.scareDuration;
            sim.globalFlickerTimer = fatal ? 2.6 : 0.75;
            if (fatal) {
              sim.health = 0;
              sim.maxSanity = 0;
              if (document.pointerLockElement) document.exitPointerLock?.();
              callbacksRef.current.onPromptChange(null);
              audio.playFatalEyeCrushCutscene();
            } else {
              audio.playCaughtScare();
            }
          };

          const catchRange = sim.hidingLockerId && !sim.sawPlayerHideLocker ? 0 : 1.5;
          if (
            distToPlayer < catchRange &&
            currentPhase === 'playing' &&
            !sim.hidingLockerId &&
            sim.hitCooldown <= 0
          ) {
            if (sim.health > 40) {
              // 4-hit progression: 100 -> 80 (max san 80) -> 60 (max san 60) -> 40 (max san 40) -> Fatal
              sim.health = Math.max(1, sim.health - 20);
              sim.maxSanity = Math.max(0, sim.maxSanity - 20);
              sim.hitCooldown = 2.8;
              sim.stalkerStunTimer = 1.9;
              startJumpscare(false);
            } else {
              startJumpscare(true);
            }
          } else if (sim.hidingLockerId && sim.sawPlayerHideLocker && distToPlayer < 2.2) {
            sim.hidingLockerId = null;
            callbacksRef.current.onHidingChange(false);
            startJumpscare(true);
          }
        }

        // Throttled HUD snapshot (15 Hz, or immediate on active jumpscare / fatal cutscene frame)
        if (
          elapsed - sim.lastHudEmit > 0.065 ||
          activeJumpscareIntensity > 0.05 ||
          activeFatalCutsceneProgress > 0
        ) {
          sim.lastHudEmit = elapsed;
          callbacksRef.current.onHudSnapshot({
            health: sim.health,
            sanity: sim.sanity,
            maxSanity: sim.maxSanity,
            stamina: sim.stamina,
            battery: sim.battery,
            flashlightOn: sim.flashlightOn,
            hasBetterFlashlight: sim.hasBetterFlashlight,
            crouching: sim.crouching,
            sliding: sim.slideTimer > 0,
            hiding: Boolean(sim.hidingLockerId),
            stalkerDistance: distToPlayer,
            stalkerState: sim.stalkerState,
            stepIndex: sim.stepIndex,
            pointerLocked: isPointerLocked,
            jumpscareIntensity: activeJumpscareIntensity,
            panic: sim.panic,
            iSeeYouIntensity: sim.iSeeYouTimer > 0 ? Math.min(1, sim.iSeeYouTimer / 1.4) : 0,
            fatalCutsceneProgress: activeFatalCutsceneProgress,
          });
        }
      } else {
        audio.setChaseTension(0);
        audio.updateExertionBreathing(100, 0, false, false);
        audio.updateStalkerProximityWhispers(40, false, 0, 'patrol', false);
      }

      // Render frame
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      reloadModelsRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      if (customGhostAsset) {
        customGhostAsset.dispose();
        customGhostAsset = null;
      }
      if (customFlashlightAsset) {
        customFlashlightAsset.dispose();
        customFlashlightAsset = null;
      }
      floorGeo.dispose();
      floorMat.dispose();
      slabGeo.dispose();
      concreteMat?.dispose();
      woodFloorMat?.dispose();
      metalFloorMat?.dispose();
      ceilingGeo.dispose();
      ceilingMat.dispose();
      wallBoxGeo.dispose();
      wallMat.dispose();
      panelGeo.dispose();
      trofferGeo.dispose();
      trofferMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      for (const fx of fixtures) {
        fx.panelMat.dispose();
      }
      crushHandsRig.dispose();
      stalkerRig.dispose();
      (flashlightRig.userData.dispose as (() => void) | undefined)?.();
      textures.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [audio, actionsRef, mobileInputRef]);

  return <div ref={mountRef} className="w-full h-full relative overflow-hidden bg-[#09090B]" />;
};
