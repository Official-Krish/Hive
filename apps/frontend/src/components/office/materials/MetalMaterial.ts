import * as THREE from "three";

/**
 * Metal Materials (Graphite, Aluminum, Brass accents, Matte Steel)
 */
export const MetalMaterials = {
  // Dark Graphite (Monitor Arms, Cable Trays, Light Fixtures)
  darkGraphite: new THREE.MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.3,
    metalness: 0.8,
  }),

  // Brushed Aluminum (Server Racks, Monitor Stand Backs)
  brushedAluminum: new THREE.MeshStandardMaterial({
    color: "#94a3b8",
    roughness: 0.25,
    metalness: 0.85,
  }),

  // Anodized Matte Black (Hardware, Ergonomic Chair Legs)
  matteBlackMetal: new THREE.MeshStandardMaterial({
    color: "#0f172a",
    roughness: 0.4,
    metalness: 0.6,
  }),

  // Restrained Muted Brass (Desk Lamps, Accent Trim)
  mutedBrass: new THREE.MeshStandardMaterial({
    color: "#785b34",
    roughness: 0.35,
    metalness: 0.7,
  }),
};
