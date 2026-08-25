import * as THREE from "three";

/**
 * Restrained Emissive & Screen Materials (AI core, Server LEDs, Displays, Desk lamps)
 */
export const EmissiveMaterials = {
  // Restrained Cyan Status Glow (AI Core display accents)
  cyanTechGlow: new THREE.MeshStandardMaterial({
    color: "#0284c7",
    emissive: "#0369a1",
    emissiveIntensity: 0.8,
    roughness: 0.2,
  }),

  // Warm Amber Reading Glow (Desk Lamps, Kitchen Pendants)
  warmLampGlow: new THREE.MeshStandardMaterial({
    color: "#fbbf24",
    emissive: "#f59e0b",
    emissiveIntensity: 1.2,
    roughness: 0.2,
  }),

  // Soft White Linear Architectural Light Bar
  linearWhiteGlow: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#f8fafc",
    emissiveIntensity: 1.0,
    roughness: 0.1,
  }),

  // Server LED - Active Green
  serverLedGreen: new THREE.MeshStandardMaterial({
    color: "#10b981",
    emissive: "#059669",
    emissiveIntensity: 1.5,
    roughness: 0.2,
  }),

  // Server LED - Processing Blue
  serverLedBlue: new THREE.MeshStandardMaterial({
    color: "#3b82f6",
    emissive: "#2563eb",
    emissiveIntensity: 1.5,
    roughness: 0.2,
  }),

  // Active Screen UI Texture Simulation (Monitors / Boardroom display)
  codeScreen: new THREE.MeshStandardMaterial({
    color: "#0f172a",
    emissive: "#0284c7",
    emissiveIntensity: 0.25,
    roughness: 0.15,
    metalness: 0.5,
  }),
};
