import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiSend, FiUsers } from "react-icons/fi";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import type { RealtimeClient } from "@/lib/realtime";
import type { ConversationSummary } from "@hive/types";

const PANEL =
  "overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.09] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_48px_-20px_rgba(28,25,18,0.45)] backdrop-blur-sm";
const HEADER =
  "flex items-center justify-between border-b border-black/[0.07] px-4 py-2.5 " +
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500";

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-500",
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  // Autoscroll to newest.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, activeId]);

  // Workspace members directory for group creation.
  useEffect(() => {
    if (!newGroupOpen || !client) return;
    void chat.refreshMembers();
  }, [newGroupOpen, client, chat]);

  function openConversation(id: string) {
    setActiveId(id);
    chat.openThread(id);
  }

  async function openDirect(userId: string) {
    const existing = byPartner.get(userId);
    if (existing) {
      openConversation(existing.id);
      return;
    }
    const { http } = await import("@/lib/http");
    const conv = await http.chat.create(workspaceId, { memberIds: [userId] });
    await chat.refreshList();
    openConversation(conv.id);
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
      /* surfaced by refresh */
    }
  }

  // All workspace members (server roster) — used for the DM list and the
  // group-composer member picker, so everyone is reachable from the start.
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

  // DM conversations indexed by the other party, so roster rows can show the
  // matching thread (preview, time, unread badge) or a "start a chat" state.
  const byPartner = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const c of chat.conversations)
      if (!c.isGroup) {
        const other = c.members.find((m) => m.userId !== myUserId);
        if (other) map.set(other.userId, c);
      }
    return map;
  }, [chat.conversations, myUserId]);

  // Roster rows merged with live presence + their DM thread; online first,
  // then most-recently active.
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
    <div
      className={`pointer-events-auto flex h-[520px] max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col ${PANEL}`}
    >
      {/* header */}
      <div className={HEADER}>
        <span className="flex items-center gap-2">
          {activeId && (
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded p-0.5 text-neutral-400 transition-colors hover:text-neutral-900"
              aria-label="Back to conversations"
            >
              <FiArrowLeft className="size-3.5" />
            </button>
          )}
          {activeId
            ? active?.isGroup
              ? (active.title ?? "Group")
              : (active?.members.find((m) => m.userId !== myUserId)?.name ??
                "Direct message")
            : "Messages"}
        </span>
        <span className="flex items-center gap-2">
          {!activeId && (
            <button
              type="button"
              onClick={() => setNewGroupOpen((v) => !v)}
              title="New group"
              className="rounded p-0.5 text-neutral-400 transition-colors hover:text-neutral-900"
            >
              <FiUsers className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded p-0.5 text-neutral-400 transition-colors hover:text-neutral-900"
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
            className="w-full rounded-lg border border-black/[0.09] text-neutral-700 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-neutral-900/40"
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
                <span className="truncate text-neutral-800">{m.name}</span>
              </label>
            ))}
            {directory.length === 0 && (
              <p className="px-1 text-[11.5px] italic text-neutral-500">
                No other members in this workspace yet.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void createGroup()}
            disabled={!groupName.trim() || selectedMembers.size === 0}
            className="w-full rounded-lg bg-neutral-950 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            Create group ({selectedMembers.size})
          </button>
        </div>
      )}

      {/* body */}
      {!activeId ? (
        <ul
          ref={listRef}
          className="flex-1 divide-y divide-black/[0.05] overflow-y-auto"
        >
          {roster.length === 0 && (
            <li className="px-4 py-6 text-center text-[12.5px] italic text-neutral-500">
              No other members in this workspace yet.
            </li>
          )}
          {roster.map((row) => {
            const typing = row.conv
              ? Object.keys(chat.typing[row.conv.id] ?? {}).length > 0
              : false;
            return (
              <ConversationListItem
                key={row.userId}
                initial={row.name.charAt(0).toUpperCase()}
                name={row.name}
                dotColor={STATUS_DOT[row.status] ?? "bg-neutral-300"}
                time={
                  row.conv?.lastMessage
                    ? timeLabel(row.conv.lastMessage.createdAt)
                    : undefined
                }
                preview={
                  typing
                    ? "typing…"
                    : (row.conv?.lastMessage?.body ?? "Say hello")
                }
                unread={row.conv?.unreadCount ?? 0}
                isTyping={typing}
                onClick={() => void openDirect(row.userId)}
              />
            );
          })}
          {groups.length > 0 && [
            <li
              key="groups-hdr"
              className="px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400"
            >
              Groups
            </li>,
            ...groups.map((c) => {
              const typing = Object.keys(chat.typing[c.id] ?? {}).length > 0;
              return (
                <ConversationListItem
                  key={c.id}
                  initial={(c.title ?? "#").charAt(0).toUpperCase()}
                  name={c.title ?? "Group"}
                  time={
                    c.lastMessage
                      ? timeLabel(c.lastMessage.createdAt)
                      : undefined
                  }
                  preview={
                    typing ? "typing…" : (c.lastMessage?.body ?? "Say hello")
                  }
                  unread={c.unreadCount}
                  isTyping={typing}
                  onClick={() => openConversation(c.id)}
                />
              );
            }),
          ]}
        </ul>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
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
                        : "bg-white text-neutral-900 ring-1 ring-black/[0.07]",
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
                        mine ? "text-white/60" : "text-neutral-400",
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
                <div className="rounded-2xl bg-white px-3 py-2 text-[11.5px] italic text-neutral-500 ring-1 ring-black/[0.07]">
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
                chat.notifyTyping(activeId!);
              }}
              placeholder="Type a message…"
              autoFocus
              maxLength={4000}
              className="min-w-0 flex-1 rounded-xl border border-black/[0.09] bg-white px-3 py-2 text-[13px] text-neutral-700 outline-none transition-colors focus:border-neutral-900/40"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send"
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

/** WhatsApp-style row: avatar + status dot, name/time, preview + unread badge. */
function ConversationListItem({
  initial,
  name,
  dotColor,
  time,
  preview,
  unread,
  isTyping,
  onClick,
}: {
  initial: string;
  name: string;
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
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.035]"
      >
        <span className="relative">
          <span className="flex size-9 items-center justify-center rounded-full bg-neutral-900/[0.06] font-serif text-[14px] text-neutral-700 ring-1 ring-black/[0.07]">
            {initial}
          </span>
          {dotColor && (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#f4f2ed]",
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
                  ? "font-bold text-neutral-900"
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
                    ? "font-semibold text-neutral-900"
                    : "text-neutral-500",
              )}
            >
              {preview}
            </span>
            {unread > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
