import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiSend, FiUsers } from "react-icons/fi";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  focusing: "bg-violet-500",
  offline: "bg-neutral-300",
};

const EASE = [0.22, 1, 0.36, 1] as const;
/** Consecutive messages merge into one group within this window. */
const GROUP_WINDOW_MS = 5 * 60_000;
const COMPOSER_LIMIT = 4000;
const COMPOSER_WARN_AT = 3600;

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
  const reduce = useReducedMotion();

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

  // Autoscroll to newest (instant on thread switch, smooth on new message)
  // — but never yank the user away from history they're reading. A "new
  // messages" pill appears instead; tapping it jumps to the bottom.
  const prevLen = useRef(0);
  const stuckToBottomRef = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const jump = messages.length < prevLen.current;
    prevLen.current = messages.length;
    if (jump) {
      stuckToBottomRef.current = true;
      setHasNewBelow(false);
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      stuckToBottomRef.current = true;
      setHasNewBelow(false);
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reduce ? "auto" : "smooth",
      });
    } else {
      stuckToBottomRef.current = false;
      setHasNewBelow(true);
    }
  }, [messages.length, activeId, reduce]);

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stuckToBottomRef.current = true;
    setHasNewBelow(false);
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  };

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
      setFailed("Couldn't start that conversation — try again.");
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

  const threadTitle = active
    ? active.isGroup
      ? (active.title ?? "Group")
      : (active.members.find((m) => m.userId !== myUserId)?.name ??
        "Direct message")
    : "Messages";

  return (
    <motion.div
      className="pointer-events-auto flex h-[520px] max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.08] backdrop-blur-md shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 380, damping: 34 }
      }
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {activeId && (
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-950"
              aria-label="Back to conversations"
            >
              <FiArrowLeft className="size-3.5" />
            </button>
          )}
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            {threadTitle}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1.5">
          {!activeId && (
            <button
              type="button"
              onClick={() => setNewGroupOpen((v) => !v)}
              title="New group"
              aria-label="New group"
              aria-expanded={newGroupOpen}
              className={cn(
                "rounded-md p-1 transition-colors",
                newGroupOpen
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-950",
              )}
            >
              <FiUsers className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-950"
          >
            <X className="size-3.5" />
          </button>
        </span>
      </div>

      {/* new group form */}
      <AnimatePresence initial={false}>
        {newGroupOpen && !activeId && (
          <motion.div
            key="new-group"
            className="space-y-2 overflow-hidden border-b border-black/[0.07] px-4 py-3"
            initial={
              reduce
                ? { opacity: 1, height: "auto" }
                : { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }
            }
            animate={{
              opacity: 1,
              height: "auto",
              paddingTop: 12,
              paddingBottom: 12,
            }}
            exit={
              reduce
                ? { opacity: 1, height: "auto" }
                : { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }
            }
            transition={
              reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }
            }
          >
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name…"
              aria-label="Group name"
              className="w-full rounded-lg border border-black/[0.09] bg-white px-2.5 py-1.5 text-[12.5px] text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-neutral-900/40"
            />
            <div className="max-h-32 space-y-0.5 overflow-y-auto">
              {directory.map((m) => (
                <label
                  key={m.userId}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12.5px] transition-colors hover:bg-black/[0.04]"
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
              className="w-full rounded-lg bg-neutral-950 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
            >
              Create group ({selectedMembers.size})
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {failed && !activeId && (
        <div className="flex items-center justify-between gap-2 border-b border-black/[0.07] bg-rose-50/70 px-4 py-2 text-[12px] font-medium text-rose-700">
          <span>{failed}</span>
          <button
            type="button"
            onClick={() => setFailed(null)}
            className="shrink-0 font-semibold underline underline-offset-2 hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* body — list ↔ thread slide */}
      <AnimatePresence mode="wait" initial={false}>
        {!activeId ? (
          <motion.ul
            key="list"
            className="flex-1 divide-y divide-black/[0.05] overflow-y-auto"
            initial={reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
            }
          >
            {roster.length === 0 && groups.length === 0 && (
              <li className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-black/[0.04] text-neutral-400 ring-1 ring-black/[0.06]">
                  <FiUsers className="size-5" />
                </span>
                <p className="mt-3 text-[13px] font-semibold text-neutral-800">
                  No conversations yet
                </p>
                <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-neutral-500">
                  When teammates join this workspace they will show up here —
                  say hello.
                </p>
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
                Groups · {groups.length}
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
            })}
          </motion.ul>
        ) : (
          <motion.div
            key={activeId}
            className="flex min-h-0 flex-1 flex-col"
            initial={reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
            }
          >
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                    <p className="text-[13px] font-semibold text-neutral-800">
                      Start the conversation
                    </p>
                    <p className="mt-1 max-w-[230px] text-[12px] leading-relaxed text-neutral-500">
                      Nothing here yet — your message lands instantly for
                      everyone online.
                    </p>
                  </div>
                ) : (
                  <MessageGroups
                    messages={messages}
                    myUserId={myUserId}
                    isGroup={active?.isGroup ?? false}
                    members={active?.members ?? []}
                  />
                )}
                <AnimatePresence initial={false}>
                  {typingUsers.length > 0 && (
                    <motion.div
                      key="typing"
                      className="flex justify-start"
                      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 1 } : { opacity: 0 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                    >
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 ring-1 ring-black/[0.08]">
                        <TypingDots />
                        <span className="text-[11.5px] font-medium italic text-neutral-500">
                          {typingUsers.map((t) => t.name).join(", ")}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {hasNewBelow && (
                  <motion.button
                    key="new-below"
                    type="button"
                    onClick={jumpToLatest}
                    className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-neutral-950 py-1.5 pl-3.5 pr-4 text-[11.5px] font-semibold tabular-nums text-white shadow-lg"
                    initial={
                      reduce
                        ? { opacity: 1 }
                        : { opacity: 0, y: 8, scale: 0.95 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reduce
                        ? { opacity: 1 }
                        : { opacity: 0, y: 4, scale: 0.97 }
                    }
                    transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                  >
                    ↓ New messages
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <ChatComposer
              draft={draft}
              setDraft={setDraft}
              onSend={send}
              onTyping={() => {
                if (activeId) chat.notifyTyping(activeId);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Message grouping: consecutive same-sender messages within the window
   merge — one name, one timestamp per group, day dividers between dates. ── */
interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

function MessageGroups({
  messages,
  myUserId,
  isGroup,
  members,
}: {
  messages: ThreadMessage[];
  myUserId: string;
  isGroup: boolean;
  members: Array<{ userId: string; name: string }>;
}) {
  const reduce = useReducedMotion();
  const blocks: Array<{ day: string } | { group: ThreadMessage[] }> = [];
  let lastDay = "";
  let current: ThreadMessage[] = [];
  const flush = () => {
    if (current.length) blocks.push({ group: current });
    current = [];
  };
  for (const m of messages) {
    const day = dayLabel(m.createdAt);
    if (day !== lastDay) {
      flush();
      blocks.push({ day });
      lastDay = day;
    }
    const prev = current[current.length - 1];
    if (
      prev &&
      prev.senderId === m.senderId &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
        GROUP_WINDOW_MS
    ) {
      current.push(m);
    } else {
      flush();
      current = [m];
    }
  }
  flush();

  return (
    <>
      {blocks.map((b, i) => {
        if ("day" in b) {
          return (
            <div key={`day-${i}`} className="flex items-center gap-2 pt-1">
              <span className="h-px flex-1 bg-black/[0.07]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {b.day}
              </span>
              <span className="h-px flex-1 bg-black/[0.07]" />
            </div>
          );
        }
        const first = b.group[0]!;
        const mine = first.senderId === myUserId;
        const sender = members.find((mm) => mm.userId === first.senderId);
        return (
          <motion.div
            key={first.id}
            className={cn("group flex", mine ? "justify-end" : "justify-start")}
            initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }
            }
          >
            <div
              className={cn("max-w-[78%]", mine ? "items-end" : "items-start")}
            >
              {!mine && isGroup && (
                <div className="mb-1 ml-1 text-[10.5px] font-semibold text-neutral-500">
                  {sender?.name ?? "Member"}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {b.group.map((m, gi) => {
                  const lastInGroup = gi === b.group.length - 1;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "w-fit max-w-full px-3 py-2 text-[13px] leading-snug",
                        mine
                          ? cn(
                              "ml-auto bg-neutral-950 text-white",
                              gi === 0 && "rounded-2xl rounded-br-md",
                              gi > 0 &&
                                !lastInGroup &&
                                "rounded-2xl rounded-br-md rounded-tr-md",
                              lastInGroup &&
                                gi > 0 &&
                                "rounded-2xl rounded-tr-md",
                              b.group.length === 1 &&
                                "rounded-2xl rounded-br-md",
                            )
                          : cn(
                              "bg-white text-neutral-700 ring-1 ring-black/[0.08]",
                              gi === 0 && "rounded-2xl rounded-bl-md",
                              gi > 0 &&
                                !lastInGroup &&
                                "rounded-2xl rounded-bl-md rounded-tl-md",
                              lastInGroup &&
                                gi > 0 &&
                                "rounded-2xl rounded-tl-md",
                              b.group.length === 1 &&
                                "rounded-2xl rounded-bl-md",
                            ),
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {m.body}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                className={cn(
                  "mt-1 text-[9.5px] tabular-nums",
                  mine
                    ? "text-right text-neutral-400"
                    : "ml-1 text-neutral-400",
                )}
              >
                {timeLabel(b.group[b.group.length - 1]!.createdAt)}
              </div>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

function TypingDots() {
  const reduce = useReducedMotion();
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((d) => (
        <motion.span
          key={d}
          className="size-1.5 rounded-full bg-neutral-400"
          animate={
            reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }
          }
          transition={
            reduce
              ? undefined
              : {
                  duration: 1.1,
                  repeat: Infinity,
                  delay: d * 0.18,
                  ease: "easeInOut",
                }
          }
        />
      ))}
    </span>
  );
}

function ChatComposer({
  draft,
  setDraft,
  onSend,
  onTyping,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onTyping: () => void;
}) {
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  const nearLimit = draft.length > COMPOSER_WARN_AT;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="border-t border-black/[0.07] px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onTyping();
          }}
          placeholder="Type a message…"
          autoFocus={!coarse}
          maxLength={COMPOSER_LIMIT}
          aria-label="Type a message"
          className="min-w-0 flex-1 rounded-full border border-black/[0.09] bg-white px-4 py-2 text-[13px] text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-neutral-900/40"
        />
        <motion.button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white transition-colors hover:bg-neutral-800 disabled:opacity-30"
          whileTap={draft.trim() ? { scale: 0.88 } : undefined}
        >
          <FiSend className="size-4" />
        </motion.button>
      </div>
      {nearLimit && (
        <div className="mt-1 text-right text-[10px] tabular-nums text-neutral-400">
          {draft.length.toLocaleString()} / {COMPOSER_LIMIT.toLocaleString()}
        </div>
      )}
    </form>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ConversationListItem({
  name,
  avatarUrl,
  dotColor,
  time,
  preview,
  unread = 0,
  isTyping = false,
  group = false,
  onClick,
}: {
  name: string;
  avatarUrl: string | null;
  dotColor?: string;
  time?: string;
  preview: string;
  unread?: number;
  isTyping?: boolean;
  group?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]"
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
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#f4f2ed]",
                dotColor,
              )}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
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
              <span
                className={cn(
                  "flex-shrink-0 tabular-nums",
                  unread > 0
                    ? "text-[10px] font-bold text-emerald-700"
                    : "text-[10px] text-neutral-400",
                )}
              >
                {time}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={cn(
                "flex min-w-0 items-center gap-1 truncate text-[11.5px]",
                isTyping
                  ? "italic text-emerald-700"
                  : unread > 0
                    ? "font-semibold text-neutral-900"
                    : "text-neutral-500",
              )}
            >
              {isTyping && <TypingDots />}
              <span className="truncate">{preview}</span>
            </span>
            {unread > 0 && (
              <motion.span
                key={unread}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold tabular-nums text-white"
              >
                {unread > 99 ? "99+" : unread}
              </motion.span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
