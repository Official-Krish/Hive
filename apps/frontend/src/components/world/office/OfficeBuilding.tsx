import { Shell } from "./Shell";
import { Furnishings } from "./Furnishings";
import { Fittings } from "./Fittings";
import { Courtyard } from "./Courtyard";
import { Stairs } from "./Stairs";
import { Level2 } from "./Level2";

/**
 * Full explorable environment, layered:
 *   Shell      — slab, floors, walls, columns, ceilings, upper slab, roof
 *   Fittings   — ceiling luminaires, baffles, feature walls, displays, signage
 *   Furnishings— level 1 desks, seating, counters, racks, storage, focus pods
 *   Stairs     — the lobby feature stair up to the arrival balcony
 *   Level2     — leadership floor: pods, boardroom, mezzanine, open plan
 *   Courtyard  — plaza, planting, streets, neighbouring city block
 * The lobby's reflective floor lives in Shell so there is exactly one plane
 * there (no z-fighting) and reflection stays capped to a single room.
 */
export function OfficeBuilding() {
  return (
    <group name="office-building">
      <Shell />
      <Fittings />
      <Furnishings />
      <Stairs />
      <Level2 />
      <Courtyard />
    </group>
  );
}
