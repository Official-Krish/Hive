import * as THREE from "three";

/**
 * Premium Wood & Architectural Surface Materials
 */
export const WoodMaterials = {
  // Executive Dark Walnut (Desks & Conference Table)
  darkWalnut: new THREE.MeshStandardMaterial({
    color: "#2a1e17",
    roughness: 0.35,
    metalness: 0.05,
  }),

  // Warm Natural Oak (Lounge Coffee Table, Accents, Stools)
  warmOak: new THREE.MeshStandardMaterial({
    color: "#4a3b2c",
    roughness: 0.45,
    metalness: 0.02,
  }),

  // Matte Black Stained Ash (Sleek Desks / Command Consoles)
  blackStainedAsh: new THREE.MeshStandardMaterial({
    color: "#1a1a1a",
    roughness: 0.3,
    metalness: 0.1,
  }),

  // Light Architectural Birch (Shelving / Acoustic Wall Panels)
  lightBirch: new THREE.MeshStandardMaterial({
    color: "#6b5847",
    roughness: 0.5,
    metalness: 0.0,
  }),
};
