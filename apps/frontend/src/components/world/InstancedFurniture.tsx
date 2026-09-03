import React, { useLayoutEffect, useRef, useMemo } from "react";
import * as THREE from "three";

export interface TransformData {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

interface InstancedFurnitureProps {
  desks?: TransformData[];
  chairs?: TransformData[];
  monitors?: TransformData[];
  plants?: TransformData[];
  sofas?: TransformData[];
  coffeeTables?: TransformData[];
  lightFixtures?: TransformData[];
}

/**
 * Premium studio-grade low-poly furniture components rendered via InstancedMesh.
 * Keeps draw calls ultra-low while maintaining a sleek, modern architectural aesthetic.
 */
export function InstancedFurniture({
  desks = [],
  chairs = [],
  monitors = [],
  plants = [],
  sofas = [],
  coffeeTables = [],
  lightFixtures = [],
}: InstancedFurnitureProps) {
  // Matrix composer helper
  const createMatrix = (t: TransformData): THREE.Matrix4 => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3(...t.position);
    const rotation = t.rotation
      ? new THREE.Euler(...t.rotation)
      : new THREE.Euler(0, 0, 0);
    const scale = t.scale
      ? new THREE.Vector3(...t.scale)
      : new THREE.Vector3(1, 1, 1);

    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    matrix.compose(position, quaternion, scale);
    return matrix;
  };

  // Reusable Architectural Materials
  const woodMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2d241e",
        roughness: 0.5,
        metalness: 0.1,
      }),
    [],
  );
  const darkMetalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e293b",
        roughness: 0.4,
        metalness: 0.6,
      }),
    [],
  );
  const deskPadMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.8 }),
    [],
  );
  const chairFabricMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 }),
    [],
  );
  const chairAccentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.4,
        metalness: 0.5,
      }),
    [],
  );
  const screenBezelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.8,
      }),
    [],
  );
  const screenGlowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0284c7",
        emissive: "#0369a1",
        emissiveIntensity: 0.6,
        roughness: 0.2,
      }),
    [],
  );
  const potMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.4 }),
    [],
  );
  const leafMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#166534", roughness: 0.6 }),
    [],
  );
  const sofaFabricMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.85 }),
    [],
  );
  const lightBarMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.7,
      }),
    [],
  );
  const lightEmitterMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        emissive: "#f8fafc",
        emissiveIntensity: 1.2,
      }),
    [],
  );

  // Mesh Refs
  const deskTopRef = useRef<THREE.InstancedMesh>(null);
  const deskPadRef = useRef<THREE.InstancedMesh>(null);
  const deskLegsRef = useRef<THREE.InstancedMesh>(null);

  const chairSeatRef = useRef<THREE.InstancedMesh>(null);
  const chairBackRef = useRef<THREE.InstancedMesh>(null);
  const chairBaseRef = useRef<THREE.InstancedMesh>(null);

  const monitorFrameRef = useRef<THREE.InstancedMesh>(null);
  const monitorScreenRef = useRef<THREE.InstancedMesh>(null);
  const monitorArmRef = useRef<THREE.InstancedMesh>(null);

  const plantPotRef = useRef<THREE.InstancedMesh>(null);
  const plantLeavesRef = useRef<THREE.InstancedMesh>(null);

  const sofaSeatRef = useRef<THREE.InstancedMesh>(null);
  const sofaBackRef = useRef<THREE.InstancedMesh>(null);

  const coffeeTableRef = useRef<THREE.InstancedMesh>(null);
  const lightBarRef = useRef<THREE.InstancedMesh>(null);
  const lightStripRef = useRef<THREE.InstancedMesh>(null);

  // Layout instance matrices
  useLayoutEffect(() => {
    // DESKS
    if (deskTopRef.current && desks.length > 0) {
      desks.forEach((d, i) => {
        const m = createMatrix({
          ...d,
          position: [d.position[0], d.position[1] + 0.72, d.position[2]],
        });
        deskTopRef.current!.setMatrixAt(i, m);
      });
      deskTopRef.current.instanceMatrix.needsUpdate = true;
    }

    if (deskPadRef.current && desks.length > 0) {
      desks.forEach((d, i) => {
        const m = createMatrix({
          ...d,
          position: [d.position[0], d.position[1] + 0.761, d.position[2]],
        });
        deskPadRef.current!.setMatrixAt(i, m);
      });
      deskPadRef.current.instanceMatrix.needsUpdate = true;
    }

    if (deskLegsRef.current && desks.length > 0) {
      const legOffsets: [number, number][] = [
        [-0.82, -0.38],
        [0.82, -0.38],
        [-0.82, 0.38],
        [0.82, 0.38],
      ];
      desks.forEach((d, i) => {
        legOffsets.forEach(([dx, dz], legIdx) => {
          const rotY = d.rotation ? d.rotation[1] : 0;
          const cos = Math.cos(rotY);
          const sin = Math.sin(rotY);
          const worldX = d.position[0] + dx * cos - dz * sin;
          const worldZ = d.position[2] + dx * sin + dz * cos;
          const m = createMatrix({
            position: [worldX, d.position[1] + 0.35, worldZ],
            rotation: d.rotation,
          });
          deskLegsRef.current!.setMatrixAt(i * 4 + legIdx, m);
        });
      });
      deskLegsRef.current.instanceMatrix.needsUpdate = true;
    }

    // CHAIRS
    if (chairSeatRef.current && chairs.length > 0) {
      chairs.forEach((c, i) => {
        const m = createMatrix({
          ...c,
          position: [c.position[0], c.position[1] + 0.45, c.position[2]],
        });
        chairSeatRef.current!.setMatrixAt(i, m);
      });
      chairSeatRef.current.instanceMatrix.needsUpdate = true;
    }

    if (chairBackRef.current && chairs.length > 0) {
      chairs.forEach((c, i) => {
        const rotY = c.rotation ? c.rotation[1] : 0;
        const dz = -0.22;
        const worldX = c.position[0] - dz * Math.sin(rotY);
        const worldZ = c.position[2] + dz * Math.cos(rotY);
        const m = createMatrix({
          position: [worldX, c.position[1] + 0.72, worldZ],
          rotation: c.rotation,
        });
        chairBackRef.current!.setMatrixAt(i, m);
      });
      chairBackRef.current.instanceMatrix.needsUpdate = true;
    }

    if (chairBaseRef.current && chairs.length > 0) {
      chairs.forEach((c, i) => {
        const m = createMatrix({
          ...c,
          position: [c.position[0], c.position[1] + 0.2, c.position[2]],
        });
        chairBaseRef.current!.setMatrixAt(i, m);
      });
      chairBaseRef.current.instanceMatrix.needsUpdate = true;
    }

    // MONITORS
    if (monitorFrameRef.current && monitors.length > 0) {
      monitors.forEach((m, i) => {
        const mat = createMatrix({
          ...m,
          position: [m.position[0], m.position[1] + 0.98, m.position[2]],
        });
        monitorFrameRef.current!.setMatrixAt(i, mat);
      });
      monitorFrameRef.current.instanceMatrix.needsUpdate = true;
    }

    if (monitorScreenRef.current && monitors.length > 0) {
      monitors.forEach((m, i) => {
        const rotY = m.rotation ? m.rotation[1] : 0;
        const dz = 0.022;
        const worldX = m.position[0] + dz * Math.sin(rotY);
        const worldZ = m.position[2] + dz * Math.cos(rotY);
        const mat = createMatrix({
          position: [worldX, m.position[1] + 0.98, worldZ],
          rotation: m.rotation,
        });
        monitorScreenRef.current!.setMatrixAt(i, mat);
      });
      monitorScreenRef.current.instanceMatrix.needsUpdate = true;
    }

    if (monitorArmRef.current && monitors.length > 0) {
      monitors.forEach((m, i) => {
        const mat = createMatrix({
          ...m,
          position: [m.position[0], m.position[1] + 0.82, m.position[2]],
        });
        monitorArmRef.current!.setMatrixAt(i, mat);
      });
      monitorArmRef.current.instanceMatrix.needsUpdate = true;
    }

    // PLANTS
    if (plantPotRef.current && plants.length > 0) {
      plants.forEach((p, i) => {
        const m = createMatrix({
          ...p,
          position: [p.position[0], p.position[1] + 0.25, p.position[2]],
        });
        plantPotRef.current!.setMatrixAt(i, m);
      });
      plantPotRef.current.instanceMatrix.needsUpdate = true;
    }

    if (plantLeavesRef.current && plants.length > 0) {
      plants.forEach((p, i) => {
        const m = createMatrix({
          ...p,
          position: [p.position[0], p.position[1] + 0.75, p.position[2]],
        });
        plantLeavesRef.current!.setMatrixAt(i, m);
      });
      plantLeavesRef.current.instanceMatrix.needsUpdate = true;
    }

    // SOFAS
    if (sofaSeatRef.current && sofas.length > 0) {
      sofas.forEach((s, i) => {
        const m = createMatrix({
          ...s,
          position: [s.position[0], s.position[1] + 0.25, s.position[2]],
        });
        sofaSeatRef.current!.setMatrixAt(i, m);
      });
      sofaSeatRef.current.instanceMatrix.needsUpdate = true;
    }

    if (sofaBackRef.current && sofas.length > 0) {
      sofas.forEach((s, i) => {
        const rotY = s.rotation ? s.rotation[1] : 0;
        const dz = -0.3;
        const worldX = s.position[0] - dz * Math.sin(rotY);
        const worldZ = s.position[2] + dz * Math.cos(rotY);
        const m = createMatrix({
          position: [worldX, s.position[1] + 0.55, worldZ],
          rotation: s.rotation,
        });
        sofaBackRef.current!.setMatrixAt(i, m);
      });
      sofaBackRef.current.instanceMatrix.needsUpdate = true;
    }

    // COFFEE TABLES
    if (coffeeTableRef.current && coffeeTables.length > 0) {
      coffeeTables.forEach((ct, i) => {
        const m = createMatrix({
          ...ct,
          position: [ct.position[0], ct.position[1] + 0.175, ct.position[2]],
        });
        coffeeTableRef.current!.setMatrixAt(i, m);
      });
      coffeeTableRef.current.instanceMatrix.needsUpdate = true;
    }

    // LIGHT FIXTURES
    if (lightBarRef.current && lightFixtures.length > 0) {
      lightFixtures.forEach((lf, i) => {
        const m = createMatrix({
          ...lf,
          position: [lf.position[0], lf.position[1] + 2.8, lf.position[2]],
        });
        lightBarRef.current!.setMatrixAt(i, m);
      });
      lightBarRef.current.instanceMatrix.needsUpdate = true;
    }

    if (lightStripRef.current && lightFixtures.length > 0) {
      lightFixtures.forEach((lf, i) => {
        const m = createMatrix({
          ...lf,
          position: [lf.position[0], lf.position[1] + 2.76, lf.position[2]],
        });
        lightStripRef.current!.setMatrixAt(i, m);
      });
      lightStripRef.current.instanceMatrix.needsUpdate = true;
    }

    // Instance transforms span the office, but Three starts with bounds around
    // each source geometry at the origin. Rebuild the aggregate bounds after
    // writing the matrices so visible furniture is not culled, while genuinely
    // off-screen batches still cost no draw call.
    [
      deskTopRef,
      deskPadRef,
      deskLegsRef,
      chairSeatRef,
      chairBackRef,
      chairBaseRef,
      monitorFrameRef,
      monitorScreenRef,
      monitorArmRef,
      plantPotRef,
      plantLeavesRef,
      sofaSeatRef,
      sofaBackRef,
      coffeeTableRef,
      lightBarRef,
      lightStripRef,
    ].forEach((ref) => {
      ref.current?.computeBoundingBox();
      ref.current?.computeBoundingSphere();
    });
  }, [desks, chairs, monitors, plants, sofas, coffeeTables, lightFixtures]);

  return (
    <group name="instanced-furniture">
      {/* DESKS */}
      {desks.length > 0 && (
        <group name="desks-group">
          {/* Desk Walnut Top */}
          <instancedMesh
            ref={deskTopRef}
            args={[undefined, undefined, desks.length]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.8, 0.08, 0.9]} />
            <primitive object={woodMaterial} attach="material" />
          </instancedMesh>

          {/* Desk Mat Surface */}
          <instancedMesh
            ref={deskPadRef}
            args={[undefined, undefined, desks.length]}
            receiveShadow
          >
            <boxGeometry args={[1.2, 0.005, 0.5]} />
            <primitive object={deskPadMaterial} attach="material" />
          </instancedMesh>

          {/* Desk Graphite Legs */}
          <instancedMesh
            ref={deskLegsRef}
            args={[undefined, undefined, desks.length * 4]}
            castShadow
          >
            <boxGeometry args={[0.06, 0.7, 0.06]} />
            <primitive object={darkMetalMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}

      {/* CHAIRS */}
      {chairs.length > 0 && (
        <group name="chairs-group">
          <instancedMesh
            ref={chairSeatRef}
            args={[undefined, undefined, chairs.length]}
            castShadow
          >
            <boxGeometry args={[0.48, 0.06, 0.48]} />
            <primitive object={chairFabricMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={chairBackRef}
            args={[undefined, undefined, chairs.length]}
            castShadow
          >
            <boxGeometry args={[0.46, 0.48, 0.05]} />
            <primitive object={chairFabricMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={chairBaseRef}
            args={[undefined, undefined, chairs.length]}
          >
            <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
            <primitive object={chairAccentMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}

      {/* MONITORS */}
      {monitors.length > 0 && (
        <group name="monitors-group">
          <instancedMesh
            ref={monitorFrameRef}
            args={[undefined, undefined, monitors.length]}
            castShadow
          >
            <boxGeometry args={[0.65, 0.38, 0.03]} />
            <primitive object={screenBezelMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={monitorScreenRef}
            args={[undefined, undefined, monitors.length]}
          >
            <planeGeometry args={[0.61, 0.34]} />
            <primitive object={screenGlowMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={monitorArmRef}
            args={[undefined, undefined, monitors.length]}
          >
            <boxGeometry args={[0.06, 0.22, 0.06]} />
            <primitive object={darkMetalMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}

      {/* PLANTS */}
      {plants.length > 0 && (
        <group name="plants-group">
          <instancedMesh
            ref={plantPotRef}
            args={[undefined, undefined, plants.length]}
            castShadow
          >
            <cylinderGeometry args={[0.22, 0.18, 0.5, 12]} />
            <primitive object={potMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={plantLeavesRef}
            args={[undefined, undefined, plants.length]}
            castShadow
          >
            <dodecahedronGeometry args={[0.42, 1]} />
            <primitive object={leafMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}

      {/* SOFAS */}
      {sofas.length > 0 && (
        <group name="sofas-group">
          <instancedMesh
            ref={sofaSeatRef}
            args={[undefined, undefined, sofas.length]}
            castShadow
          >
            <boxGeometry args={[1.8, 0.3, 0.8]} />
            <primitive object={sofaFabricMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={sofaBackRef}
            args={[undefined, undefined, sofas.length]}
            castShadow
          >
            <boxGeometry args={[1.8, 0.6, 0.25]} />
            <primitive object={sofaFabricMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}

      {/* COFFEE TABLES */}
      {coffeeTables.length > 0 && (
        <group name="coffee-tables-group">
          <instancedMesh
            ref={coffeeTableRef}
            args={[undefined, undefined, coffeeTables.length]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.2, 0.35, 0.6]} />
            <primitive object={woodMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}

      {/* LIGHT FIXTURES */}
      {lightFixtures.length > 0 && (
        <group name="light-fixtures-group">
          <instancedMesh
            ref={lightBarRef}
            args={[undefined, undefined, lightFixtures.length]}
          >
            <boxGeometry args={[2.5, 0.08, 0.15]} />
            <primitive object={lightBarMaterial} attach="material" />
          </instancedMesh>

          <instancedMesh
            ref={lightStripRef}
            args={[undefined, undefined, lightFixtures.length]}
          >
            <boxGeometry args={[2.4, 0.01, 0.1]} />
            <primitive object={lightEmitterMaterial} attach="material" />
          </instancedMesh>
        </group>
      )}
    </group>
  );
}
