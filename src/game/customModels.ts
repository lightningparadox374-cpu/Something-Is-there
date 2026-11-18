import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export type CustomModelSlot = 'ghost' | 'flashlight';

export interface StoredCustomModel {
  slot: CustomModelSlot;
  fileName: string;
  buffer: ArrayBuffer;
  updatedAt: string;
}

export interface CustomModelManifest {
  ghost: string | null;
  flashlight: string | null;
}

export interface LoadedGlbAsset {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: THREE.AnimationAction[];
  dispose: () => void;
}

const DB_NAME = 'something_is_there_custom_models_v1';
const STORE_NAME = 'models';

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slot' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomModelFile(
  slot: CustomModelSlot,
  file: File,
): Promise<StoredCustomModel> {
  const buffer = await file.arrayBuffer();
  const record: StoredCustomModel = {
    slot,
    fileName: file.name,
    buffer,
    updatedAt: new Date().toISOString(),
  };
  const db = await openModelDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return record;
}

export async function loadStoredCustomModel(
  slot: CustomModelSlot,
): Promise<StoredCustomModel | null> {
  try {
    const db = await openModelDb();
    const result = await new Promise<StoredCustomModel | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(slot);
      req.onsuccess = () => resolve((req.result as StoredCustomModel) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearCustomModelFile(slot: CustomModelSlot): Promise<void> {
  try {
    const db = await openModelDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IndexedDB unavailability
  }
}

export async function getCustomModelNames(): Promise<Record<CustomModelSlot, string | null>> {
  const [ghost, flashlight] = await Promise.all([
    loadStoredCustomModel('ghost'),
    loadStoredCustomModel('flashlight'),
  ]);
  return {
    ghost: ghost?.fileName ?? null,
    flashlight: flashlight?.fileName ?? null,
  };
}

export async function fetchModelsManifest(): Promise<CustomModelManifest> {
  try {
    const res = await fetch('/models/models.json', { cache: 'no-store' });
    if (!res.ok) return { ghost: null, flashlight: null };
    const data = (await res.json()) as Partial<CustomModelManifest>;
    return {
      ghost: typeof data.ghost === 'string' && data.ghost.trim() ? data.ghost.trim() : null,
      flashlight:
        typeof data.flashlight === 'string' && data.flashlight.trim()
          ? data.flashlight.trim()
          : null,
    };
  } catch {
    return { ghost: null, flashlight: null };
  }
}

function createConfiguredLoader(): { loader: GLTFLoader; disposeDraco: () => void } {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  return {
    loader,
    disposeDraco: () => draco.dispose(),
  };
}

function finalizeGlbScene(
  gltf: GLTF,
  options: { targetHeight: number; alignToFloor: boolean },
): LoadedGlbAsset {
  const root = new THREE.Group();
  const inner = gltf.scene;
  root.add(inner);

  // Calibrate meshes for Backrooms shadows & pitch-black fog
  inner.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && 'envMapIntensity' in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 0.08;
        }
      }
    }
  });

  // Auto-scale to target size and ground/center cleanly
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const refDim = options.alignToFloor
    ? Math.max(size.y, 0.001)
    : Math.max(size.x, size.y, size.z, 0.001);
  const scale = options.targetHeight / refDim;
  inner.scale.setScalar(scale);

  inner.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(inner);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  inner.position.x -= scaledCenter.x;
  inner.position.z -= scaledCenter.z;
  if (options.alignToFloor) {
    inner.position.y -= scaledBox.min.y;
  } else {
    inner.position.y -= scaledCenter.y;
  }

  let mixer: THREE.AnimationMixer | null = null;
  const actions: THREE.AnimationAction[] = [];
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(inner);
    const primary = mixer.clipAction(gltf.animations[0]);
    primary.play();
    actions.push(primary);
  }

  const dispose = () => {
    mixer?.stopAllAction();
    inner.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          m?.dispose();
        }
      }
    });
  };

  return { root, mixer, actions, dispose };
}

export async function loadGlbAssetFromSource(
  source: ArrayBuffer | string,
  options: { targetHeight: number; alignToFloor: boolean },
): Promise<LoadedGlbAsset> {
  const { loader, disposeDraco } = createConfiguredLoader();
  try {
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      if (typeof source === 'string') {
        loader.load(source, resolve, undefined, reject);
      } else {
        loader.parse(source, '', resolve, reject);
      }
    });
    return finalizeGlbScene(gltf, options);
  } finally {
    disposeDraco();
  }
}
