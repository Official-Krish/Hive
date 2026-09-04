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
  Btn,
  Card,
  CardHead,
  ConfirmBtn,
  Field,
  Note,
  PageHead,
  SkeletonRows,
  Spinner,
  inputClass,
} from "@/components/dashboard/kit";
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
      <div className="max-w-2xl space-y-4">
        <IdentityCard />
        <Avatar3DRow hasAvatar={!!user.mapAvatarModel} />
        <OrganizationsCard organizations={organizations} />
        <PasswordCard />
        <MachinesCard />
        <SessionsCard />
      </div>
    </div>
  );
}

/* ── Identity ──────────────────────────────────────────────── */
function IdentityCard() {
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
    <Card>
      <CardHead title="Identity" />
      <div className="space-y-4 px-5 py-5">
        <div className="flex items-center gap-4">
          <Avatar
            name={name.trim() || user.name}
            src={user.avatarUrl}
            size={52}
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-neutral-900">
              {user.name}
            </p>
            <p className="truncate text-[13px] text-neutral-500">
              {user.email}
            </p>
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

        <Field label="Display name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoComplete="name"
          />
        </Field>

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
    </Card>
  );
}

/* ── 3D avatar ─────────────────────────────────────────────── */
function Avatar3DRow({ hasAvatar }: { hasAvatar: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
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
            <p className="text-[13px] font-medium text-neutral-900">
              Spatial office avatar
            </p>
            <p className="font-mono text-[11px] text-neutral-500">
              {hasAvatar
                ? "Set — teammates see it in the world"
                : "Not set yet"}
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/avatar"
          className="flex-shrink-0 rounded-full border border-neutral-900/15 px-4 py-2 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-900/30 hover:text-neutral-900"
        >
          {hasAvatar ? "Change" : "Pick one"}
        </Link>
      </div>
    </Card>
  );
}

/* ── Organizations ─────────────────────────────────────────── */
function OrganizationsCard({
  organizations,
}: {
  organizations: { id: string; name: string; plan: string }[];
}) {
  return (
    <Card>
      <CardHead title="Organizations" hint={`${organizations.length} total`} />
      {organizations.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-neutral-500">
          You don&apos;t belong to any organizations yet.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-900/[0.06]">
          {organizations.map((o) => (
            <li key={o.id}>
              <Link
                to={`/dashboard/o/${o.id}`}
                className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-neutral-900/[0.02]"
              >
                <span className="truncate text-sm font-medium text-neutral-800">
                  {o.name}
                </span>
                <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                  {o.plan}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Password ──────────────────────────────────────────────── */
function PasswordCard() {
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
    <Card>
      <CardHead
        title="Password"
        hint="Changing it signs out all other sessions."
      />
      <div className="space-y-4 px-5 py-5">
        <Field label="Current password">
          <input
            type="password"
            className={inputClass}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New password"
            hint={
              next && !strongEnough
                ? "At least 8 characters."
                : "Upper + lower + digit, 8–128 chars."
            }
          >
            <input
              type="password"
              className={inputClass}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field
            label="Confirm new password"
            hint={
              confirm && !matches ? "Passwords don't match yet." : undefined
            }
          >
            <input
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Btn disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner />}
            Change password
          </Btn>
        </div>
      </div>
    </Card>
  );
}

/* ── Machines ──────────────────────────────────────────────── */
function MachinesCard() {
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
    <Card>
      <CardHead
        title="Machines"
        hint="Collectors registered to your account."
      />
      {devices.isLoading && (
        <div className="space-y-3 px-5 py-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-lg bg-neutral-900/[0.05]"
            />
          ))}
        </div>
      )}
      {devices.isError && (
        <p className="px-5 py-4 text-[13px] text-neutral-500">
          Couldn&apos;t load machines right now.
        </p>
      )}
      {devices.isSuccess && devices.data.length === 0 && (
        <p className="px-5 py-4 text-[13px] text-neutral-500">
          No machines registered. Install the collector and run{" "}
          <code className="rounded bg-neutral-900/[0.06] px-1 py-px font-mono text-[11px]">
            hive start
          </code>{" "}
          to add this one.
        </p>
      )}
      {devices.isSuccess && devices.data.length > 0 && (
        <ul className="divide-y divide-neutral-900/[0.06]">
          {devices.data.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
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
                <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">
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
    </Card>
  );
}

/* ── Sessions ──────────────────────────────────────────────── */
function SessionsCard() {
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
    <Card>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[13px] font-medium text-neutral-900">
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
    </Card>
  );
}

export default ProfilePage;
