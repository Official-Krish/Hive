import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiSend, FiUsers } from "react-icons/fi";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import type { RealtimeClient } from "@/lib/realtime";
import type { ConversationSummary } from "@hive/types";
import { notifyError } from "@/lib/toast";

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-600",
  away: "bg-amber-500",
  on_call: "bg-sky-500",
  busy: "bg-rose-500",
  offline: "bg-neutral-300",
};

interface ChatPanelProps {
  workspaceId: string;
  myUserId: string;
  client: RealtimeClient | null;
  presence: ReadonlyMap<string, MapAvatar>;
  onClose: () => void;
}

export function ChatPanel({
  workspaceId,
  myUserId,
  client,
  presence,
  onClose,
}: ChatPanelProps) {
  const chat = useChat(workspaceId, myUserId, client, true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(),
  );
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const coarsePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  const active = chat.conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeId ? (chat.threads[activeId] ?? []) : [];
  const typingUsers: Array<{ name: string }> = useMemo(() => {
    if (!activeId) return [];
    const users = chat.typing[activeId] ?? {};
    return Object.entries(users).map(([uid]) => {
      const conv = chat.conversations.find((c) => c.id === activeId);
      const member = conv?.members.find((mm) => mm.userId === uid);
      return { name: member?.name ?? "Someone" };
    });
  }, [chat.typing, chat.conversations, activeId]);

  // Autoscroll to newest (instant on thread switch, smooth on new message).
  const prevLen = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const jump = messages.length < prevLen.current;
    prevLen.current = messages.length;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: jump ? "auto" : "smooth",
    });
  }, [messages.length, activeId]);

  useEffect(() => {
    if (!newGroupOpen || !client) return;
    void chat.refreshMembers();
  }, [newGroupOpen, client, chat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeId) setActiveId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, onClose]);

  function openConversation(id: string) {
    setActiveId(id);
    setFailed(null);
    chat.openThread(id);
  }

  async function openDirect(userId: string) {
    const convo = chat.conversations.find(
      (c) => !c.isGroup && c.members.some((m) => m.userId === userId),
    );
    if (convo) {
      openConversation(convo.id);
      return;
    }
    setOpening(userId);
    setFailed(null);
    try {
      const { http } = await import("@/lib/http");
      const conv = await http.chat.create(workspaceId, {
        memberIds: [userId],
      });
      await chat.refreshList();
      openConversation(conv.id);
    } catch {
      setFailed("Couldn't start that conversation. Try again.");
    } finally {
      setOpening(null);
    }
  }

  function send() {
    if (!activeId) return;
    if (chat.send(activeId, draft)) setDraft("");
  }

  async function createGroup() {
    const memberIds = [...selectedMembers];
    if (!groupName.trim() || memberIds.length === 0) return;
    try {
      const conv = await import("@/lib/http").then((m) =>
        m.http.chat.create(workspaceId, {
          memberIds,
          title: groupName.trim(),
        }),
      );
      await chat.refreshList();
      setActiveId(conv.id);
      chat.openThread(conv.id);
      setNewGroupOpen(false);
      setGroupName("");
      setSelectedMembers(new Set());
    } catch {
      notifyError("Couldn't create the group. Try again.");
    }
  }

  const directory = useMemo(
    () =>
      chat.members
        .filter((m) => m.userId !== myUserId)
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
        })),
    [chat.members, myUserId],
  );

  const byPartner = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const c of chat.conversations)
      if (!c.isGroup) {
        const other = c.members.find((m) => m.userId !== myUserId);
        if (other) map.set(other.userId, c);
      }
    return map;
  }, [chat.conversations, myUserId]);

  const roster = useMemo(() => {
    const rows = directory.map((m) => {
      const conv = byPartner.get(m.userId) ?? null;
      const status = presence.get(m.userId)?.status ?? "offline";
      return { ...m, status, conv };
    });
    rows.sort((a, b) => {
      const aOn = a.status !== "offline" ? 1 : 0;
      const bOn = b.status !== "offline" ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return (b.conv?.updatedAt ?? "").localeCompare(a.conv?.updatedAt ?? "");
    });
    return rows;
  }, [directory, byPartner, presence]);

  const groups = useMemo(
    () => chat.conversations.filter((c) => c.isGroup),
    [chat.conversations],
  );

  return (
    <div className="pointer-events-auto flex h-[520px] max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.08] backdrop-blur-md">
      {/* header */}
      <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        <span className="flex min-w-0 items-center gap-2">
          {activeId && (
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded p-0.5 text-neutral-500 transition-colors hover:text-neutral-950"
              aria-label="Back to conversations"
            >
              <FiArrowLeft className="size-3.5" />
            </button>
          )}
          <span className="truncate">
            {activeId
              ? active?.isGroup
                ? (active.title ?? "Group")
                : (active?.members.find((m) => m.userId !== myUserId)?.name ??
                  "Direct message")
              : "Messages"}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          {!activeId && (
            <button
              type="button"
              onClick={() => setNewGroupOpen((v) => !v)}
              title="New group"
              aria-label="New group"
              aria-expanded={newGroupOpen}
              className="rounded p-0.5 text-neutral-500 transition-colors hover:text-neutral-950"
            >
              <FiUsers className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded p-0.5 text-neutral-500 transition-colors hover:text-neutral-950"
          >
            <X className="size-3.5" />
          </button>
        </span>
      </div>

      {/* new group form */}
      {newGroupOpen && (
        <div className="space-y-2 border-b border-black/[0.07] px-4 py-3">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name…"
            aria-label="Group name"
            className="w-full rounded-lg border border-black/[0.09] bg-white px-2.5 py-1.5 text-[12.5px] text-white outline-none placeholder:text-neutral-400 focus:border-neutral-900/40"
          />
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {directory.map((m) => (
              <label
                key={m.userId}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12.5px] hover:bg-black/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={selectedMembers.has(m.userId)}
                  onChange={(e) => {
                    const next = new Set(selectedMembers);
                    if (e.target.checked) next.add(m.userId);
                    else next.delete(m.userId);
                    setSelectedMembers(next);
                  }}
                  className="accent-neutral-900"
                />
                <span className="truncate text-neutral-700">{m.name}</span>
              </label>
            ))}
            {directory.length === 0 && (
              <p className="px-1 text-[11.5px] text-neutral-500">
                No other members in this workspace yet.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void createGroup()}
            disabled={!groupName.trim() || selectedMembers.size === 0}
            className="w-full rounded-lg bg-white py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            Create group ({selectedMembers.size})
          </button>
        </div>
      )}

      {failed && !activeId && (
        <div className="border-b border-black/[0.07] px-4 py-2 text-[12px] text-rose-700">
          {failed}
        </div>
      )}

      {/* body */}
      {!activeId ? (
        <ul className="flex-1 divide-y divide-black/[0.05] overflow-y-auto">
          {roster.length === 0 && groups.length === 0 && (
            <li className="px-4 py-6 text-center text-[12.5px] text-neutral-500">
              No other members in this workspace yet.
            </li>
          )}
          {roster.map((row) => {
            const typing = row.conv
              ? Object.keys(chat.typing[row.conv.id] ?? {}).length > 0
              : false;
            const busy = opening === row.userId;
            return (
              <ConversationListItem
                key={row.userId}
                name={row.name}
                avatarUrl={row.avatarUrl}
                dotColor={STATUS_DOT[row.status] ?? "bg-neutral-300"}
                time={
                  row.conv?.lastMessage
                    ? timeLabel(row.conv.lastMessage.createdAt)
                    : undefined
                }
                preview={
                  busy
                    ? "Opening…"
                    : typing
                      ? "typing…"
                      : (row.conv?.lastMessage?.body ?? "Say hello")
                }
                unread={row.conv?.unreadCount ?? 0}
                isTyping={typing && !busy}
                onClick={() => void openDirect(row.userId)}
              />
            );
          })}
          {groups.length > 0 && (
            <li className="px-4 pb-1 pt-3 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-400">
              Groups
            </li>
          )}
          {groups.map((c) => {
            const typing = Object.keys(chat.typing[c.id] ?? {}).length > 0;
            return (
              <ConversationListItem
                key={c.id}
                name={c.title ?? "Group"}
                avatarUrl={null}
                group
                time={
                  c.lastMessage ? timeLabel(c.lastMessage.createdAt) : undefined
                }
                preview={
                  typing ? "typing…" : (c.lastMessage?.body ?? "Say hello")
                }
                unread={c.unreadCount}
                isTyping={typing}
                onClick={() => openConversation(c.id)}
              />
            );
          })}
        </ul>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
            aria-live="polite"
          >
            {messages.map((m) => {
              const mine = m.senderId === myUserId;
              const sender = active?.members.find(
                (mm) => mm.userId === m.senderId,
              );
              return (
                <div
                  key={m.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-snug",
                      mine
                        ? "bg-neutral-950 text-white"
                        : "bg-black/[0.04] text-white ring-1 ring-black/[0.08]",
                    )}
                  >
                    {!mine && active?.isGroup && (
                      <div className="mb-0.5 text-[10px] font-semibold text-neutral-500">
                        {sender?.name ?? "Member"}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">
                      {m.body}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-right text-[9.5px] tabular-nums",
                        mine ? "text-neutral-500" : "text-neutral-400",
                      )}
                    >
                      {timeLabel(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUsers.length > 0 && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-black/[0.04] px-3 py-2 text-[11.5px] italic text-neutral-500 ring-1 ring-black/[0.08]">
                  {typingUsers.map((t) => t.name).join(", ")} typing…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-black/[0.07] px-3 py-2.5"
          >
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (activeId) chat.notifyTyping(activeId);
              }}
              placeholder="Type a message…"
              autoFocus={!coarsePointer}
              maxLength={4000}
              aria-label="Type a message"
              className="min-w-0 flex-1 rounded-xl border border-black/[0.09] bg-white px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-400 focus:border-neutral-900/40"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 disabled:opacity-30"
            >
              <FiSend className="size-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConversationListItem({
  name,
  avatarUrl,
  group,
  dotColor,
  time,
  preview,
  unread,
  isTyping,
  onClick,
}: {
  name: string;
  avatarUrl?: string | null;
  group?: boolean;
  dotColor?: string;
  time?: string;
  preview: string;
  unread: number;
  isTyping: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
      >
        <span className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-9 rounded-full object-cover ring-1 ring-black/[0.08]"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-black/[0.04] text-[14px] font-medium text-neutral-700 ring-1 ring-black/[0.08]">
              {group ? "#" : name.charAt(0).toUpperCase()}
            </span>
          )}
          {dotColor && !group && (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0d1017]",
                dotColor,
              )}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-[13px]",
                unread > 0
                  ? "font-bold text-white"
                  : "font-medium text-neutral-800",
              )}
            >
              {name}
            </span>
            {time && (
              <span className="flex-shrink-0 text-[10px] tabular-nums text-neutral-400">
                {time}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-[11.5px]",
                isTyping
                  ? "italic text-emerald-700"
                  : unread > 0
                    ? "font-semibold text-white"
                    : "text-neutral-500",
              )}
            >
              {preview}
            </span>
            {unread > 0 && (
              <span className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
