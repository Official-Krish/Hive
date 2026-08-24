import * as THREE from "three";

/**
 * Custom procedural noise texture for realistic floor roughness and subtle grain
 */
function createNoiseTexture(size = 256, intensity = 0.08) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imgData = ctx.createImageData(size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = 128 + Math.floor((Math.random() - 0.5) * intensity * 255);
    imgData.data[i] = val;
    imgData.data[i + 1] = val;
    imgData.data[i + 2] = val;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

const noiseTexture =
  typeof window !== "undefined" ? createNoiseTexture() : null;

/**
 * Premium Architectural Floor Materials
 */
export const FloorMaterials = {
  // Main building foundation slab
  slabBase: new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.8,
    metalness: 0.1,
  }),

  // Polished Studio Concrete Floor (Central Core)
  polishedConcrete: new THREE.MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.35,
    metalness: 0.15,
    roughnessMap: noiseTexture || undefined,
  }),

  // Dark Slate Stone Tiles (Server Room / Tech zones)
  charcoalSlate: new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.45,
    metalness: 0.25,
    roughnessMap: noiseTexture || undefined,
  }),

  // Executive Hardwood Walnut Plank (Conference Room)
  walnutParquet: new THREE.MeshStandardMaterial({
    color: "#271c16",
    roughness: 0.3,
    metalness: 0.05,
  }),

  // Modern Warm Oak Planks (Lounge)
  warmOakPlanks: new THREE.MeshStandardMaterial({
    color: "#38291e",
    roughness: 0.4,
    metalness: 0.05,
  }),

  // Polished Terrazzo / Quartz (Kitchen & Espresso Station)
  kitchenTerrazzo: new THREE.MeshStandardMaterial({
    color: "#334155",
    roughness: 0.25,
    metalness: 0.1,
  }),

  // Soft Woven Textile Rug Material (Lounge center)
  loungeRug: new THREE.MeshStandardMaterial({
    color: "#475569",
    roughness: 0.9,
    metalness: 0.0,
  }),
};
