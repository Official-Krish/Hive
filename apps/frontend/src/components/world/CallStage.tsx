import { useEffect, useReducer, useRef } from "react";
import { FiMic, FiMicOff } from "react-icons/fi";
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
      if (pub?.track) {
        pub.track.attach(videoEl);
        cleanup.push(() => pub.track!.detach(videoEl));
      }
    };
    const attachRemote = (p: RemoteParticipant) => {
      const videoPub = [...p.videoTrackPublications.values()].find(
        (p) => p.track,
      );
      if (videoPub?.track) {
        videoPub.track.attach(videoEl);
        cleanup.push(() => videoPub.track!.detach(videoEl));
      }
      const audioPub = [...p.audioTrackPublications.values()].find(
        (p) => p.track,
      );
      if (audioPub?.track && audioEl) {
        audioPub.track.attach(audioEl);
        cleanup.push(() => audioPub.track!.detach(audioEl));
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
          ? "no signal"
          : "camera off";
    }
    const p = room.getParticipantByIdentity(identity) as
      RemoteParticipant | undefined;
    if (!p) return "waiting";
    const videoPub = [...p.videoTrackPublications.values()].find(
      (x) => x.kind === Track.Kind.Video,
    );
    if (videoPub?.isSubscribed) {
      return videoPub.track &&
        videoPub.track.streamState === Track.StreamState.Active
        ? "live"
        : "connecting media";
    }
    return videoPub ? "no signal" : "no video track";
  })();

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
      <span className="absolute bottom-1 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
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
            : status === "waiting" || status === "camera off"
              ? "bg-neutral-700/80 text-neutral-200 ring-neutral-500"
              : "bg-amber-500/85 text-white ring-amber-400"
        }`}
      >
        {status}
      </span>
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

  if (!room) return null;

  const labelFor = (id: string) =>
    id === myUserId ? "You" : (nameOf?.(id) ?? id);
  const ids = [...nearIds];

  return (
    <div className="flex flex-col gap-2">
      <VideoTile
        room={room}
        identity="__local__"
        label="You"
        version={version}
      />
      {ids.map((id) => (
        <VideoTile
          key={id}
          room={room}
          identity={id}
          label={labelFor(id)}
          version={version}
        />
      ))}
    </div>
  );
}
