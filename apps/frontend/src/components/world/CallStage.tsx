import { useEffect, useReducer, useRef, useState } from "react";
import { FiMaximize, FiMic, FiMicOff, FiX } from "react-icons/fi";
import { Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";

function VideoTile({
  room,
  identity,
  label,
  version,
}: {
  room: Room;
  identity: string;
  label: string;
  version: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!videoEl) return;
    const cleanup: Array<() => void> = [];

    const attachLocal = () => {
      const pub = [
        ...room.localParticipant.videoTrackPublications.values(),
      ].find((p) => p.track);
      const track = pub?.track;
      if (track) {
        track.attach(videoEl);
        cleanup.push(() => track.detach(videoEl));
      }
    };
    const attachRemote = (p: RemoteParticipant) => {
      const videoPub = [...p.videoTrackPublications.values()].find(
        (x) => x.track,
      );
      const videoTrack = videoPub?.track;
      if (videoTrack) {
        videoTrack.attach(videoEl);
        cleanup.push(() => videoTrack.detach(videoEl));
      }
      const audioPub = [...p.audioTrackPublications.values()].find(
        (x) => x.track,
      );
      const audioTrack = audioPub?.track;
      if (audioTrack && audioEl) {
        audioTrack.attach(audioEl);
        cleanup.push(() => audioTrack.detach(audioEl));
      }
    };

    if (identity === "__local__") attachLocal();
    else {
      const p = room.getParticipantByIdentity(identity) as
        RemoteParticipant | undefined;
      if (p) attachRemote(p);
    }

    return () => cleanup.forEach((fn) => fn());
  }, [room, identity, version]);

  const status = (() => {
    if (identity === "__local__") {
      const pub = [
        ...room.localParticipant.videoTrackPublications.values(),
      ].find((p) => p.track);
      return pub?.track
        ? "live"
        : room.localParticipant.isCameraEnabled
          ? "reconnecting"
          : "camera off";
    }
    const p = room.getParticipantByIdentity(identity) as
      RemoteParticipant | undefined;
    if (!p) return "joining";
    const videoPub = [...p.videoTrackPublications.values()].find(
      (x) => x.kind === Track.Kind.Video,
    );
    if (videoPub?.isSubscribed) {
      return videoPub.track &&
        videoPub.track.streamState === Track.StreamState.Active
        ? "live"
        : "connecting";
    }
    return videoPub ? "reconnecting" : "no video";
  })();

  const statusText: Record<string, string> = {
    live: "Live",
    joining: "Joining…",
    connecting: "Connecting…",
    reconnecting: "Reconnecting…",
    "camera off": "Camera off",
    "no video": "No video",
  };

  // Remote mic state arrives over the LiveKit signal channel (a WebSocket) as
  // TrackMuted/TrackUnmuted events; `version` bumps re-render this in real time.
  const remoteMicMuted = (() => {
    if (identity === "__local__") return false;
    const p = room.getParticipantByIdentity(identity) as
      RemoteParticipant | undefined;
    const audioPub = p
      ? [...p.audioTrackPublications.values()].find(
          (x) => x.kind === Track.Kind.Audio,
        )
      : undefined;
    return audioPub ? audioPub.isMuted : false;
  })();

  return (
    <div className="relative h-28 w-44 overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-black/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={identity === "__local__"}
        className={`h-full w-full object-cover ${
          identity === "__local__" ? "scale-x-[-1]" : ""
        }`}
      />
      {identity !== "__local__" && <audio ref={audioRef} autoPlay />}
      <span className="absolute bottom-1 left-1.5 max-w-[104px] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {label}
      </span>
      {identity !== "__local__" && (
        <span
          title={remoteMicMuted ? "Microphone muted" : "Microphone on"}
          className={`absolute bottom-1 right-1.5 grid size-5 place-items-center rounded-md ${
            remoteMicMuted
              ? "bg-rose-500/90 text-white"
              : "bg-black/45 text-emerald-300"
          }`}
        >
          {remoteMicMuted ? (
            <FiMicOff className="size-3" />
          ) : (
            <FiMic className="size-3" />
          )}
        </span>
      )}
      <span
        className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${
          status === "live"
            ? "bg-emerald-500/85 text-white ring-emerald-400"
            : status === "joining" || status === "camera off"
              ? "bg-neutral-700/80 text-neutral-200 ring-neutral-500"
              : "bg-amber-500/85 text-white ring-amber-400"
        }`}
      >
        {statusText[status] ?? status}
      </span>
    </div>
  );
}

function ScreenTile({
  participant,
  label,
  version,
  onExpand,
}: {
  participant: RemoteParticipant;
  label: string;
  version: number;
  onExpand: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const pub = participant
      .getTrackPublications()
      .find((x) => x.source === Track.Source.ScreenShare && x.track);
    const track = pub?.track;
    if (!track) return;
    track.attach(videoEl);
    return () => {
      track.detach(videoEl);
    };
  }, [participant, version]);

  return (
    <button
      type="button"
      onClick={onExpand}
      title="Expand screen share"
      aria-label={`Expand screen share from ${label}`}
      className="group relative w-72 overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-black/10 transition-shadow hover:ring-white/40 focus-visible:outline-2 focus-visible:outline-white/60 focus-visible:ring-white/40 sm:w-96"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="aspect-video w-full object-contain"
      />
      <span className="absolute bottom-1.5 left-2 max-w-[70%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-left text-[10px] font-medium text-white">
        Screen — {label}
      </span>
      <span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <FiMaximize className="size-3.5" />
      </span>
    </button>
  );
}

/** Full-window viewer for a remote screen share, with an exit button. */
function ScreenFocusModal({
  participant,
  label,
  version,
  onClose,
}: {
  participant: RemoteParticipant | undefined;
  label: string;
  version: number;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !participant) return;
    const track = participant
      .getTrackPublications()
      .find((x) => x.source === Track.Source.ScreenShare && x.track)?.track;
    if (!track) return;
    track.attach(videoEl);
    return () => {
      track.detach(videoEl);
    };
  }, [participant, version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/95">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="text-[12.5px] font-semibold text-white">
          Screen — {label}
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close screen share viewer"
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          <FiX className="size-4" /> Close
        </button>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export function CallStage({
  room,
  nearIds,
  myUserId,
  nameOf,
}: {
  room: Room | null;
  nearIds: ReadonlySet<string>;
  myUserId: string;
  nameOf?: (id: string) => string;
}) {
  const [version, bump] = useReducer((v: number) => v + 1, 0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    const handler = () => bump();
    room.on(RoomEvent.TrackSubscribed, handler);
    room.on(RoomEvent.TrackUnsubscribed, handler);
    room.on(RoomEvent.TrackStreamStateChanged, handler);
    room.on(RoomEvent.TrackMuted, handler);
    room.on(RoomEvent.TrackUnmuted, handler);
    room.on(RoomEvent.ParticipantConnected, handler);
    room.on(RoomEvent.ParticipantDisconnected, handler);
    room.on(RoomEvent.ConnectionStateChanged, handler);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handler);
      room.off(RoomEvent.TrackUnsubscribed, handler);
      room.off(RoomEvent.TrackStreamStateChanged, handler);
      room.off(RoomEvent.TrackMuted, handler);
      room.off(RoomEvent.TrackUnmuted, handler);
      room.off(RoomEvent.ParticipantConnected, handler);
      room.off(RoomEvent.ParticipantDisconnected, handler);
      room.off(RoomEvent.ConnectionStateChanged, handler);
    };
  }, [room]);

  // Close the full-screen viewer automatically if the share is gone (stopped,
  // unsubscribed, or the participant left).
  useEffect(() => {
    if (!room || !expanded) return;
    const stillSharing = [...room.remoteParticipants.values()].some(
      (p) =>
        p.identity === expanded &&
        p
          .getTrackPublications()
          .some(
            (x) =>
              x.source === Track.Source.ScreenShare &&
              x.track &&
              x.isSubscribed,
          ),
    );
    if (!stillSharing) setExpanded(null);
  }, [room, expanded, version]);

  if (!room) return null;

  const labelFor = (id: string) =>
    id === myUserId ? "You" : (nameOf?.(id) ?? id);
  const ids = [...nearIds];

  // Any remote actively sharing their screen (other than my own video feed).
  const shares = [...room.remoteParticipants.values()].filter((p) =>
    p
      .getTrackPublications()
      .some(
        (x) =>
          x.source === Track.Source.ScreenShare && x.track && x.isSubscribed,
      ),
  );

  return (
    <div className="flex max-w-[calc(100vw-2rem)] flex-col items-center gap-2">
      <div className="flex max-w-full flex-row flex-wrap justify-center gap-2">
        <VideoTile
          room={room}
          identity="__local__"
          label="You"
          version={version}
        />
        {ids
          .filter((id) => !shares.some((p) => p.identity === id))
          .slice(0, 4)
          .map((id) => (
            <VideoTile
              key={id}
              room={room}
              identity={id}
              label={labelFor(id)}
              version={version}
            />
          ))}
        {ids.length > 5 && (
          <span className="flex h-28 items-center rounded-xl bg-black/45 px-3 font-mono text-[11px] tabular-nums text-white/70 ring-1 ring-white/10">
            +{ids.length - 5}
          </span>
        )}
      </div>
      {shares.length > 0 && (
        <div className="flex flex-row gap-2">
          {shares.map((p) => (
            <ScreenTile
              key={p.identity}
              participant={p}
              label={labelFor(p.identity)}
              version={version}
              onExpand={() => setExpanded(p.identity)}
            />
          ))}
        </div>
      )}

      {expanded && (
        <ScreenFocusModal
          key={expanded}
          participant={
            room.getParticipantByIdentity(expanded) as
              RemoteParticipant | undefined
          }
          label={labelFor(expanded)}
          version={version}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
