import { FloorPlan } from "./architecture/FloorPlan";
import { WallsAndPartitions } from "./architecture/WallsAndPartitions";
import { CentralWorkspace } from "./zones/CentralWorkspace";
import { GlassConferenceRoom } from "./zones/GlassConferenceRoom";
import { CommandCenter } from "./zones/CommandCenter";
import { ServerRoom } from "./zones/ServerRoom";
import { LoungeArea } from "./zones/LoungeArea";
import { KitchenArea } from "./zones/KitchenArea";
import { LightingRig } from "./environment/LightingRig";
import { OfficeDecor } from "./environment/OfficeDecor";
import {
  CameraController,
  type RoomZoneId,
} from "./interaction/CameraController";
import { ZoneInteractive } from "./interaction/ZoneInteractive";
import { AvatarManager } from "./avatars/AvatarManager";

interface OfficeProps {
  activeZone: RoomZoneId;
  onSelectZone: (zone: RoomZoneId) => void;
  lightingMode: "day" | "evening";
}

/**
 * Master Architectural 3D Office Environment Assembly
 */
export function Office({
  activeZone,
  onSelectZone,
  lightingMode,
}: OfficeProps) {
  return (
    <group name="3d-office-environment">
      {/* LIGHTING & ENVIRONMENT RIG */}
      <LightingRig mode={lightingMode} />

      {/* ARCHITECTURAL STRUCTURE */}
      <FloorPlan />
      <WallsAndPartitions />

      {/* ZONES & FURNITURE */}
      <CentralWorkspace />
      <GlassConferenceRoom />
      <CommandCenter />
      <ServerRoom />
      <LoungeArea />
      <KitchenArea />

      {/* ENVIRONMENT DECORATION & ACCENTS */}
      <OfficeDecor />

      {/* TEAM AVATARS */}
      <AvatarManager />

      {/* CAMERA CHOREOGRAPHY & INTERACTIVE HIGHLIGHTS */}
      <CameraController activeZone={activeZone} />
      <ZoneInteractive activeZone={activeZone} onSelectZone={onSelectZone} />
    </group>
  );
}
