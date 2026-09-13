/* ─────────────────────────────────────────────────────────────
   PROFILE — identity, avatar, password, machines, sessions.
   Everything the auth/devices API supports, one quiet page.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCheck } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  Avatar,
  Badge,
  BaselineField,
  Btn,
  ConfirmBtn,
  Note,
  PageHead,
  SkeletonRows,
  Spinner,
  baselineInputClass,
} from "@/components/dashboard/kit";
import { AvatarPicker } from "@/components/dashboard/AvatarPicker";
import { timeAgo } from "@/components/dashboard/primitives";

export function ProfilePage() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  if (me.isLoading) {
    return (
      <div>
        <PageHead eyebrow="Account" title="Profile" />
        <SkeletonRows rows={3} />
      </div>
    );
  }

  if (me.isError || !me.data?.user) {
    return (
      <div>
        <PageHead eyebrow="Account" title="Profile" />
        <Note tone="error">
          We couldn&apos;t load your profile. Refresh to try again.
        </Note>
      </div>
    );
  }

  const { user, organizations } = me.data;

  return (
    <div>
      <PageHead
        eyebrow="Account"
        title="Profile"
        sub="Who you are across Hive — identity, security, and your machines."
      />
      <div className="max-w-2xl">
        <IdentitySection />
        <AvatarSection
          hasAvatar={!!user.mapAvatarModel}
          currentModel={user.mapAvatarModel ?? null}
        />
        <OrganizationsSection organizations={organizations} />
        <PasswordSection />
        <MachinesSection />
        <SessionsSection />
      </div>
    </div>
  );
}

/* ── Identity ──────────────────────────────────────────────── */
function IdentitySection() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });
  const user = me.data!.user;

  const [name, setName] = useState(user.name);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!synced && me.data) {
      setName(me.data.user.name);
      setSynced(true);
    }
  }, [me.data, synced]);

  const mutation = useMutation({
    mutationFn: () =>
      http.auth.updateProfile({
        name: name.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      notifySuccess("Profile saved");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't save profile.",
      ),
  });

  const dirty = name.trim() !== user.name;

  return (
    <section aria-label="Identity">
      <div className="flex items-center gap-4">
        <Avatar
          name={name.trim() || user.name}
          src={user.avatarUrl}
          size={52}
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight text-neutral-900">
            {user.name}
          </p>
          <p className="truncate text-[13px] text-neutral-500">{user.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {user.emailVerified ? (
              <Badge tone="live">Verified</Badge>
            ) : (
              <Badge tone="warn">Unverified</Badge>
            )}
            <Badge>
              Joined{" "}
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-6 max-w-md space-y-7">
        <BaselineField label="Display name">
          <input
            className={baselineInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoComplete="name"
          />
        </BaselineField>

        <div className="flex justify-end">
          <Btn
            disabled={!dirty || !name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Spinner />}
            Save changes
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* ── 3D avatar ─────────────────────────────────────────────── */
function AvatarSection({
  hasAvatar,
  currentModel,
}: {
  hasAvatar: boolean;
  currentModel: string | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (modelUrl: string) =>
      http.auth.updateProfile({ mapAvatarModel: modelUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      notifySuccess("Avatar updated");
      setOpen(false);
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't save your avatar. Try again.",
      ),
  });

  const toggle = (): void => {
    setSelected(currentModel);
    setOpen((v) => !v);
  };

  return (
    <section
      aria-label="Spatial office avatar"
      className="mt-12 border-t border-neutral-900/10 pt-6"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={
              hasAvatar
                ? "flex size-6 items-center justify-center rounded-full border border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
                : "flex size-6 items-center justify-center rounded-full border border-neutral-900/10 bg-neutral-900/[0.03] text-neutral-400"
            }
          >
            {hasAvatar && <FiCheck className="size-3" aria-hidden />}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-neutral-900">
              Spatial office avatar
            </p>
            <p className="data-mono text-[11px] uppercase tracking-[0.08em] text-neutral-500">
              {hasAvatar
                ? "Set — teammates see it in the world"
                : "Not set yet"}
            </p>
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full border border-neutral-900/15 px-4 py-2 text-[13px] font-medium text-neutral-700">
          {open ? "Close" : hasAvatar ? "Change" : "Pick one"}
        </span>
      </button>
      {open && (
        <div className="pt-4">
          <AvatarPicker selected={selected} onSelect={setSelected} />
          <div className="mt-4 flex items-center gap-3">
            <Btn
              disabled={!selected || mutation.isPending}
              onClick={() => selected && mutation.mutate(selected)}
            >
              {mutation.isPending && <Spinner />}
              {mutation.isPending ? "Saving…" : "Save avatar"}
            </Btn>
            <Link
              to="/dashboard/avatar"
              className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900"
            >
              Full-screen picker
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Organizations ─────────────────────────────────────────── */
function OrganizationsSection({
  organizations,
}: {
  organizations: { id: string; name: string; plan: string }[];
}) {
  return (
    <section
      aria-label="Organizations"
      className="mt-12 border-t border-neutral-900/10 pt-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
        Organizations · {organizations.length}
      </p>
      {organizations.length === 0 ? (
        <p className="py-3 text-[13px] text-neutral-500">
          You don&apos;t belong to any organizations yet.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-neutral-900/[0.07]">
          {organizations.map((o) => (
            <li key={o.id}>
              <Link
                to={`/dashboard/o/${o.id}`}
                className="group flex items-center justify-between gap-3 py-3 transition-colors"
              >
                <span className="truncate text-sm font-medium text-neutral-800 group-hover:text-neutral-950">
                  {o.name}
                </span>
                <span className="data-mono flex-shrink-0 text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                  {o.plan}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Password ──────────────────────────────────────────────── */
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      http.auth.changePassword({
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      notifySuccess("Password changed — other sessions signed out");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't change password.",
      ),
  });

  const strongEnough = next.length >= 8;
  const matches = next === confirm && confirm.length > 0;
  const canSubmit =
    current.length > 0 && strongEnough && matches && !mutation.isPending;

  return (
    <section
      aria-label="Password"
      className="mt-12 border-t border-neutral-900/10 pt-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
        Password
      </p>
      <p className="mt-2 text-[13px] text-neutral-500">
        Changing it signs out all other sessions.
      </p>
      <div className="mt-5 max-w-md space-y-7">
        <BaselineField label="Current password">
          <input
            type="password"
            className={baselineInputClass}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </BaselineField>
        <div className="grid gap-7 sm:grid-cols-2">
          <BaselineField
            label="New password"
            hint={
              next && !strongEnough
                ? "At least 8 characters."
                : "Upper + lower + digit, 8–128 chars."
            }
          >
            <input
              type="password"
              className={baselineInputClass}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </BaselineField>
          <BaselineField
            label="Confirm new password"
            hint={
              confirm && !matches ? "Passwords don't match yet." : undefined
            }
          >
            <input
              type="password"
              className={baselineInputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </BaselineField>
        </div>
        <div className="flex justify-end">
          <Btn disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner />}
            Change password
          </Btn>
        </div>
      </div>
    </section>
  );
}

/* ── Machines ──────────────────────────────────────────────── */
function MachinesSection() {
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: http.devices.list,
    retry: false,
  });

  const stop = useMutation({
    mutationFn: (id: string) => http.devices.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["devices", "me", "status"] });
      notifySuccess("Shutdown signal sent");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't stop the collector.",
      ),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => http.devices.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["devices", "me", "status"] });
      notifySuccess("Device revoked");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't revoke the device.",
      ),
  });

  return (
    <section
      aria-label="Machines"
      className="mt-12 border-t border-neutral-900/10 pt-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
        Machines
      </p>
      <p className="mt-2 text-[13px] text-neutral-500">
        Collectors registered to your account.
      </p>
      <div className="mt-3">
        {devices.isLoading && (
          <div className="space-y-3 py-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-neutral-900/[0.05]"
              />
            ))}
          </div>
        )}
        {devices.isError && (
          <p className="py-3 text-[13px] text-neutral-500">
            Couldn&apos;t load machines right now.
          </p>
        )}
        {devices.isSuccess && devices.data.length === 0 && (
          <p className="py-3 text-[13px] text-neutral-500">
            No machines registered. Install the collector and run{" "}
            <code className="rounded bg-neutral-900/[0.06] px-1 py-px font-mono text-[11px]">
              hive start
            </code>{" "}
            to add this one.
          </p>
        )}
        {devices.isSuccess && devices.data.length > 0 && (
          <ul className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
            {devices.data.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-neutral-800">
                    <span
                      className={
                        d.online
                          ? "size-1.5 flex-shrink-0 rounded-full bg-emerald-500"
                          : "size-1.5 flex-shrink-0 rounded-full bg-neutral-300"
                      }
                    />
                    {d.name}
                  </p>
                  <p className="data-mono mt-0.5 truncate text-[11px] text-neutral-500">
                    {[d.type, d.os, d.arch].filter(Boolean).join(" · ")}
                    {d.lastSeenAt ? ` · seen ${timeAgo(d.lastSeenAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {d.online ? (
                    <ConfirmBtn
                      variant="ghost"
                      confirmLabel="Shut down"
                      pending={stop.isPending}
                      onConfirm={() => stop.mutate(d.id)}
                    >
                      Stop
                    </ConfirmBtn>
                  ) : (
                    <ConfirmBtn
                      variant="ghost"
                      confirmLabel="Revoke key"
                      pending={revoke.isPending}
                      onConfirm={() => revoke.mutate(d.id)}
                    >
                      Revoke
                    </ConfirmBtn>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── Sessions ──────────────────────────────────────────────── */
function SessionsSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logoutAll = useMutation({
    mutationFn: http.auth.logoutAll,
    onSuccess: () => {
      queryClient.clear();
      navigate("/auth", { replace: true });
      notifySuccess("Signed out everywhere");
    },
    onError: (err) =>
      notifyError(err instanceof ApiError ? err.message : "Couldn't sign out."),
  });

  return (
    <section
      aria-label="Sessions"
      className="mt-12 border-t border-neutral-900/10 pt-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-neutral-900">
            Sign out everywhere
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Ends this session and all others, on all devices.
          </p>
        </div>
        <ConfirmBtn
          variant="danger"
          confirmLabel="Sign out all"
          pending={logoutAll.isPending}
          onConfirm={() => logoutAll.mutate()}
        >
          Sign out
        </ConfirmBtn>
      </div>
    </section>
  );
}

export default ProfilePage;
