import { useState } from "react";
import { Html } from "@react-three/drei";
import { type RoomZoneId } from "./CameraController";

interface ZoneInteractiveProps {
  activeZone: RoomZoneId;
  onSelectZone: (zoneId: RoomZoneId) => void;
}

interface ZoneHotspot {
  id: RoomZoneId;
  name: string;
  subtitle: string;
  center: [number, number, number];
  size: [number, number, number];
}

const ZONE_HOTSPOTS: ZoneHotspot[] = [
  {
    id: "workspace",
    name: "Central Workspace",
    subtitle: "9 Workstations • Engineering Core",
    center: [-8, 0.05, 4],
    size: [18, 0.02, 22],
  },
  {
    id: "conference",
    name: "Glass Conference Room",
    subtitle: "Executive Boardroom • 10 Seats",
    center: [10, 0.05, -10.5],
    size: [14, 0.02, 13],
  },
  {
    id: "command",
    name: "AI & Command Center",
    subtitle: "Intelligence Wall • Live Analytics",
    center: [-8, 0.05, -12],
    size: [18, 0.02, 10],
  },
  {
    id: "server",
    name: "Server Infrastructure",
    subtitle: "4x Racks • Network Core",
    center: [15, 0.05, 0],
    size: [5.5, 0.02, 5.5],
  },
  {
    id: "lounge",
    name: "Executive Lounge",
    subtitle: "Warm Sectional • Coffee & Books",
    center: [10, 0.05, 10.5],
    size: [14, 0.02, 13],
  },
  {
    id: "kitchen",
    name: "Kitchen & Espresso Bar",
    subtitle: "Coffee Station • Bar Stools",
    center: [-14, 0.05, 14],
    size: [7, 0.02, 7],
  },
];

/**
 * Interactive Zone Overlays with subtle highlight rings and elegant floating HTML tooltips
 */
export function ZoneInteractive({
  activeZone,
  onSelectZone,
}: ZoneInteractiveProps) {
  const [hoveredZone, setHoveredZone] = useState<RoomZoneId | null>(null);

  return (
    <group name="zone-interactive">
      {ZONE_HOTSPOTS.map((zone) => {
        const isHovered = hoveredZone === zone.id;
        const isActive = activeZone === zone.id;

        return (
          <group key={zone.id} position={zone.center}>
            {/* Interactive Invisible / Highlight Floor Plane */}
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredZone(zone.id);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoveredZone(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectZone(zone.id);
              }}
            >
              <boxGeometry args={zone.size} />
              <meshBasicMaterial
                color={isActive ? "#0284c7" : isHovered ? "#38bdf8" : "#ffffff"}
                transparent
                opacity={isActive ? 0.12 : isHovered ? 0.08 : 0.0}
              />
            </mesh>

            {/* Subtle Active / Hovered Boundary Ring Indicator */}
            {(isHovered || isActive) && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry
                  args={[zone.size[0] / 2 - 0.2, zone.size[0] / 2, 32]}
                />
                <meshBasicMaterial
                  color={isActive ? "#0284c7" : "#38bdf8"}
                  transparent
                  opacity={isActive ? 0.6 : 0.35}
                />
              </mesh>
            )}

            {/* Elegant Floating HTML Tooltip */}
            {(isHovered || isActive) && (
              <Html position={[0, 1.8, 0]} center distanceFactor={25}>
                <div
                  onClick={() => onSelectZone(zone.id)}
                  className={`cursor-pointer backdrop-blur-md px-3.5 py-2 rounded-xl border transition-all duration-200 shadow-2xl flex flex-col items-center pointer-events-auto select-none ${
                    isActive
                      ? "bg-slate-900/90 border-sky-500/80 text-white scale-105"
                      : "bg-slate-950/80 border-slate-700/60 text-slate-200 hover:border-sky-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isActive ? "bg-sky-400 animate-pulse" : "bg-slate-400"
                      }`}
                    />
                    <span className="text-xs font-bold tracking-wide">
                      {zone.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {zone.subtitle}
                  </span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
