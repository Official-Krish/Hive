import * as THREE from "three";

/**
 * Realistic Architectural Glass & Metal Frame Materials
 */
export const GlassMaterials = {
  // Ultra-Clear Architectural Glass (Meeting Room & Server Partition)
  clearPartition: new THREE.MeshPhysicalMaterial({
    color: "#e2e8f0",
    transparent: true,
    opacity: 0.3,
    roughness: 0.08,
    metalness: 0.1,
    transmission: 0.85,
    ior: 1.52,
    reflectivity: 0.5,
    thickness: 0.2,
  }),

  // Subtle Tinted Smoked Glass (AI Core Panels)
  smokedGlass: new THREE.MeshPhysicalMaterial({
    color: "#1e293b",
    transparent: true,
    opacity: 0.45,
    roughness: 0.15,
    metalness: 0.2,
    transmission: 0.65,
    ior: 1.5,
  }),

  // Thin Dark Graphite Frame (Mullions & Glass Door Edges)
  frameGraphite: new THREE.MeshStandardMaterial({
    color: "#334155",
    roughness: 0.35,
    metalness: 0.75,
  }),

  // Brushed Anodized Aluminum Frame
  frameAluminum: new THREE.MeshStandardMaterial({
    color: "#64748b",
    roughness: 0.25,
    metalness: 0.85,
  }),
};
