import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface OfficeAvatarData {
  id: string;
  name: string;
  role: string;
  status: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  isSeated?: boolean;
}

const DEFAULT_AVATARS: OfficeAvatarData[] = [
  {
    id: "avatar-1",
    name: "Elena Rostova",
    role: "Lead Architect",
    status: "Reviewing Spatial Graph",
    position: [-9.5, 0, -0.4],
    rotation: [0, 0, 0],
    color: "#38bdf8", // Sky blue shirt
    isSeated: true,
  },
  {
    id: "avatar-2",
    name: "Marcus Vance",
    role: "AI Systems Engineer",
    status: "Deploying Neural Agent",
    position: [-8, 0, -11.4],
    rotation: [0, 0, 0],
    color: "#818cf8", // Indigo shirt
    isSeated: false,
  },
  {
    id: "avatar-3",
    name: "Sophia Chen",
    role: "Product Designer",
    status: "In Executive Sync",
    position: [9.0, 0, -11.4],
    rotation: [0, Math.PI, 0],
    color: "#f472b6", // Rose pink shirt
    isSeated: true,
  },
  {
    id: "avatar-4",
    name: "David Kim",
    role: "DevOps Engineer",
    status: "Monitoring Server Cluster",
    position: [14.2, 0, 0.8],
    rotation: [0, -Math.PI / 2, 0],
    color: "#34d399", // Emerald shirt
    isSeated: false,
  },
  {
    id: "avatar-5",
    name: "Claire Moreau",
    role: "Head of AI",
    status: "Lounge Break",
    position: [10, 0, 10.2],
    rotation: [0, Math.PI / 4, 0],
    color: "#fbbf24", // Amber shirt
    isSeated: true,
  },
];

/**
 * Stylized Architectural 3D Figure with delicate idle animation
 */
function ArchitecturalAvatar({ data }: { data: OfficeAvatarData }) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + parseInt(data.id.slice(-1) || "0") * 2;
    if (groupRef.current) {
      // Subtle natural breathing height oscillation (2-3mm)
      groupRef.current.position.y =
        (data.isSeated ? 0.0 : 0.0) + Math.sin(t * 1.5) * 0.005;
    }
    if (headRef.current) {
      // Occasional delicate head turn
      headRef.current.rotation.y = Math.sin(t * 0.4) * 0.12;
    }
  });

  return (
    <group
      ref={groupRef}
      position={data.position}
      rotation={data.rotation || [0, 0, 0]}
    >
      {/* SEATED VS STANDING BODY OFFSET */}
      <group position={[0, data.isSeated ? 0.45 : 0.75, 0]}>
        {/* Torso / Upper Body Jacket */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.16, 0.38, 8, 16]} />
          <meshStandardMaterial
            color={data.color}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>

        {/* Head */}
        <mesh ref={headRef} position={[0, 0.65, 0]} castShadow>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#fcd34d" roughness={0.3} />
        </mesh>

        {/* Legs */}
        {data.isSeated ? (
          // Seated bent legs
          <group position={[0, 0, 0.1]}>
            <mesh
              position={[-0.08, -0.1, 0.12]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.06, 0.05, 0.3, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
            <mesh
              position={[0.08, -0.1, 0.12]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.06, 0.05, 0.3, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
          </group>
        ) : (
          // Standing legs
          <group position={[0, -0.28, 0]}>
            <mesh position={[-0.08, -0.15, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.05, 0.45, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
            <mesh position={[0.08, -0.15, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.05, 0.45, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

/**
 * Avatar Manager Rendering Team Figures Across Office Zones
 */
export function AvatarManager() {
  return (
    <group name="avatar-manager">
      {DEFAULT_AVATARS.map((avatar) => (
        <ArchitecturalAvatar key={avatar.id} data={avatar} />
      ))}
    </group>
  );
}
