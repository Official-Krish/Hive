import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";
import {
  L2_Y,
  PODIUM_MIC,
  PODIUM_STAGE,
  ROOM_KIND,
} from "@/components/world/office/layout";

interface UsePodiumOptions {
  myUserId: string;
  /** My current room name (`roomAt` result) — drives entry/exit. */
  currentRoom: string;
  client: RealtimeClient | null;
  /** My feet position (x, y, z) — the mic claim circle is on the stage. */
  playerPos: [number, number, number];
}

interface UsePodiumResult {
  /** True while I am standing inside the Podium Room. */
  inPodiumRoom: boolean;
  /** True while I stand in the mic claim circle on the stage. */
  onMic: boolean;
  /** Whoever currently holds the mic (null = free). */
  holderId: string | null;
  /** True when I hold the mic. */
  isSpeaker: boolean;
  /** Claim the mic (hub rejects when held). */
  claim: () => void;
  /** Release the mic. */
  release: () => void;
}

/**
 * Podium Room behaviour: stand on the stage mic circle and press E to claim
 * the single mic. The holder's voice carries room-wide while audience mics
 * stay local; leaving the room releases the mic automatically.
 */
export function usePodium({
  myUserId,
  currentRoom,
  client,
  playerPos,
}: UsePodiumOptions): UsePodiumResult {
  const inPodiumRoom = ROOM_KIND[currentRoom] === "podium";
  const [holderId, setHolderId] = useState<string | null>(null);

  const onMic =
    inPodiumRoom &&
    playerPos[1] > L2_Y &&
    Math.hypot(playerPos[0] - PODIUM_MIC.x, playerPos[2] - PODIUM_MIC.z) <=
      PODIUM_MIC.r &&
    playerPos[0] >= PODIUM_STAGE.x0 &&
    playerPos[0] <= PODIUM_STAGE.x1 &&
    playerPos[2] >= PODIUM_STAGE.z0 &&
    playerPos[2] <= PODIUM_STAGE.z1;

  // Holder sync: full state on connect, deltas after.
  useEffect(() => {
    if (!client) return;
    client.requestPodiumState();
    return client.on("podium.state", (e) => {
      setHolderId(e.holderId);
    });
  }, [client]);

  const claim = useCallback(() => {
    client?.sendPodiumClaim();
  }, [client]);

  const release = useCallback(() => {
    client?.sendPodiumRelease();
  }, [client]);

  // Leaving the room releases my claim automatically.
  const holderRef = useRef(holderId);
  holderRef.current = holderId;
  const releaseRef = useRef(release);
  releaseRef.current = release;
  const meRef = useRef(myUserId);
  meRef.current = myUserId;
  useEffect(() => {
    if (!inPodiumRoom && holderRef.current === meRef.current) {
      releaseRef.current();
    }
  }, [inPodiumRoom]);

  return {
    inPodiumRoom,
    onMic,
    holderId,
    isSpeaker: holderId === myUserId,
    claim,
    release,
  };
}
