import { Shell } from "./Shell";
import { Furnishings } from "./Furnishings";
import { Fittings } from "./Fittings";
import { Courtyard } from "./Courtyard";

/**
 * Full explorable environment, layered:
 *   Shell      — slab, floors, walls, columns, ceiling, roof
 *   Fittings   — ceiling luminaires, baffles, feature walls, displays, signage
 *   Furnishings— desks, seating, counters, racks, storage, focus pods
 *   Courtyard  — plaza, planting, street edge and the distant skyline
 * The lobby's reflective floor lives in Shell so there is exactly one plane
 * there (no z-fighting) and reflection stays capped to a single room.
 */
export function OfficeBuilding() {
  return (
    <group name="office-building">
      <Shell />
      <Fittings />
      <Furnishings />
      <Courtyard />
    </group>
  );
}
