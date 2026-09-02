import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import { ROOM_KIND } from "@/components/world/office/layout";

interface UseFocusRoomOptions {
  myUserId: string;
  /** My current room name (`roomAt` result) — drives entry/exit. */
  currentRoom: string;
  client: RealtimeClient | null;
  avatars: ReadonlyMap<string, MapAvatar>;
}

interface UseFocusRoomResult {
  /** True while I am standing inside a focus pod. */
  inFocus: boolean;
  /** The person muted-focusing with me (accepted invite), else null. */
  partnerId: string | null;
  /** Dev ids whose remote audio stays audible while I focus. */
  allowedPeers: ReadonlySet<string>;
  /** Someone else in my focus pod I could invite (null once paired). */
  suggestPartnerId: string | null;
  /** An incoming invite I haven't answered yet. */
  pendingInvite: { id: string; name: string } | null;
  /** The person I invited but who hasn't accepted/enough yet. */
  invitedId: string | null;
  invite: (targetId: string) => void;
  accept: (fromId: string) => void;
  decline: (fromId: string) => void;
  endPartner: () => void;
}

/**
 * Focus-pod behaviour: entering a focus room auto-sets the `focusing`
 * presence (restored on exit unless manually overridden), and pairs users who
 * explicitly invite each other so spatial audio flows only between them.
 */
export function useFocusRoom({
  myUserId,
  currentRoom,
  client,
  avatars,
}: UseFocusRoomOptions): UseFocusRoomResult {
  const inFocus = ROOM_KIND[currentRoom] === "focus";
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [invitedId, setInvitedId] = useState<string | null>(null);

  // One-shot auto-presence per entry.
  const autoSetRef = useRef(false);
  const priorStatusRef = useRef<"online" | "away" | "on_call" | "busy">(
    "online",
  );
  const meRef = useRef<MapAvatar | undefined>(undefined);
  meRef.current = avatars.get(myUserId);

  const clearPair = useCallback(() => {
    setPartnerId(null);
    setPendingInvite(null);
    setInvitedId(null);
  }, []);

  // Enter/exit a focus pod.
  useEffect(() => {
    if (!client) return;
    if (inFocus) {
      if (!autoSetRef.current) {
        autoSetRef.current = true;
        const me = meRef.current;
        if (me?.status && me.status !== "focusing") {
          priorStatusRef.current =
            me.status === "offline" ? "online" : me.status;
        }
        if (meRef.current?.status !== "focusing") {
          client.sendPresence("focusing");
        }
      }
    } else {
      if (autoSetRef.current) {
        autoSetRef.current = false;
        clearPair();
        const me = meRef.current;
        if (me?.status === "focusing") {
          client.sendPresence(priorStatusRef.current);
        }
      }
    }
  }, [inFocus, client]);

  // Focus invite state machine (events relayed to the whole workspace).
  useEffect(() => {
    if (!client) return;
    const nameOf = (id: string) => avatars.get(id)?.name ?? "Someone";
    return client.on("focus.invite", (e) => {
      const involved = e.fromId === myUserId || e.toId === myUserId;
      if (!involved) return;
      if (e.action === "accept") {
        const partner = e.fromId === myUserId ? e.toId : e.fromId;
        if (partner !== myUserId) setPartnerId(partner);
        setInvitedId(null);
        setPendingInvite(null);
      } else if (e.action === "decline") {
        if (e.toId === myUserId && e.fromId === invitedIdRef.current) {
          setInvitedId(null);
        }
      } else if (e.action === "end") {
        setPartnerId((prev) => (prev === e.fromId ? null : prev));
        if (e.toId === myUserId && e.fromId === invitedIdRef.current) {
          setInvitedId(null);
        }
      } else if (e.action === "invite") {
        if (e.toId === myUserId && !partnerIdRef.current) {
          setPendingInvite({ id: e.fromId, name: nameOf(e.fromId) });
        }
      }
    });
  }, [client, myUserId, avatars]);

  const partnerIdRef = useRef(partnerId);
  partnerIdRef.current = partnerId;
  const invitedIdRef = useRef(invitedId);
  invitedIdRef.current = invitedId;

  const invite = useCallback(
    (targetId: string) => {
      if (targetId === myUserId || partnerIdRef.current) return;
      setInvitedId(targetId);
      client?.sendFocusInvite(targetId, "invite");
    },
    [client, myUserId],
  );

  const accept = useCallback(
    (fromId: string) => {
      setPendingInvite(null);
      const prior = partnerIdRef.current;
      if (!prior) setPartnerId(fromId);
      client?.sendFocusInvite(fromId, "accept");
    },
    [client],
  );

  const decline = useCallback(
    (fromId: string) => {
      setPendingInvite(null);
      if (invitedIdRef.current === fromId) setInvitedId(null);
      client?.sendFocusInvite(fromId, "decline");
    },
    [client],
  );

  const endPartner = useCallback(() => {
    const partner = partnerIdRef.current;
    clearPair();
    if (partner) client?.sendFocusInvite(partner, "end");
  }, [client, clearPair]);

  const suggestPartnerId = useMemo(() => {
    if (!inFocus || partnerId) return null;
    for (const [id, a] of avatars) {
      if (id === myUserId || id === partnerId) continue;
      if (a.roomId === currentRoom && a.status === "focusing") return id;
    }
    return null;
  }, [inFocus, partnerId, avatars, myUserId, currentRoom]);

  const allowedPeers = useMemo(
    () => (partnerId ? new Set([partnerId]) : new Set<string>()),
    [partnerId],
  );

  return {
    inFocus,
    partnerId,
    allowedPeers,
    suggestPartnerId,
    pendingInvite,
    invitedId,
    invite,
    accept,
    decline,
    endPartner,
  };
}
