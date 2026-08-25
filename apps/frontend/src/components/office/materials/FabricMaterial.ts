import * as THREE from "three";

/**
 * Fabrics, Leather & Upholstery Materials
 */
export const FabricMaterials = {
  // Slate Ergonomic Mesh (Task Chairs)
  taskChairMesh: new THREE.MeshStandardMaterial({
    color: "#334155",
    roughness: 0.75,
    metalness: 0.1,
  }),

  // Premium Charcoal Sofa Fabric (Lounge Sofa)
  sofaCharcoal: new THREE.MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.85,
    metalness: 0.05,
  }),

  // Warm Amber / Terracotta Accent Fabric (Cushions / Stools)
  terracottaFabric: new THREE.MeshStandardMaterial({
    color: "#7c2d12",
    roughness: 0.8,
    metalness: 0.0,
  }),

  // Executive Dark Leather (Boardroom Chairs)
  executiveLeather: new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.45,
    metalness: 0.1,
  }),

  // Wall Acoustic Felt Panels
  acousticFelt: new THREE.MeshStandardMaterial({
    color: "#475569",
    roughness: 0.95,
    metalness: 0.0,
  }),
};
