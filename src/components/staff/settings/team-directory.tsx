"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteStaffMember,
  revokeStaffMember,
  updateStaffRole,
} from "@/app/(staff)/admin/settings/actions";
import {
  staffEmail,
  staffRoles,
  type StaffMember,
  type StaffTeamError,
} from "@/domain/staff-team";
import { settingsCopy } from "@/i18n/settings-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { StaffConfirm } from "../staff-confirm";
import { StaffFieldError, StaffNotice } from "../staff-feedback";
import { StaffSelect } from "../staff-select";
import { StatusBadge } from "../status-badge";
import catalog from "../catalog/catalog.module.css";
import styles from "./settings.module.css";

const copy = settingsCopy.team;

type Ask =
  | { kind: "invite"; email: string; role: string }
  | { kind: "role"; email: string; role: string }
  | { kind: "revoke"; email: string };

export function TeamDirectory({
  members,
  canManage,
}: {
  members: StaffMember[];
  canManage: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("manager");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [error, setError] = useState<StaffTeamError | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const validEmail = staffEmail(email) !== null;

  function run(request: Ask) {
    setError(null);
    start(async () => {
      try {
        const result =
          request.kind === "invite"
            ? await inviteStaffMember(request.email, request.role)
            : request.kind === "role"
              ? await updateStaffRole(request.email, request.role)
              : await revokeStaffMember(request.email);
        if ("error" in result) setError(result.error);
        else {
          if (request.kind === "invite") setEmail("");
          router.refresh();
        }
      } catch {
        setError("unavailable");
      }
    });
  }

  return (
    <div className={styles.page}>
      {error && <StaffNotice message={copy.errors[error]} />}

      {canManage && (
        <form
          className={styles.invite}
          onSubmit={(event) => {
            event.preventDefault();
            if (validEmail && !pending) setAsk({ kind: "invite", email, role });
          }}
        >
          <label className={catalog.field}>
            {copy.inviteEmail}
            <input
              type="email"
              value={email}
              maxLength={254}
              autoComplete="off"
              spellCheck={false}
              placeholder="name@gmail.com"
              aria-invalid={Boolean(email) && !validEmail}
              aria-describedby="invite-email-error"
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
            />
          </label>
          <StaffSelect
            label={copy.inviteRole}
            value={role}
            disabled={pending}
            onChange={(event) => setRole(event.target.value)}
          >
            {staffRoles.map((value) => (
              <option key={value} value={value}>
                {staffCopy.roles[value]}
              </option>
            ))}
          </StaffSelect>
          <button className={catalog.primary} disabled={pending || !validEmail}>
            {copy.inviteSubmit}
          </button>
          <StaffFieldError
            id="invite-email-error"
            message={email && !validEmail ? copy.errors.invalid : undefined}
          />
        </form>
      )}

      <section aria-labelledby="team-members">
        <h2 className={styles.membersTitle} id="team-members">
          {copy.members}
        </h2>
        {members.length ? (
          <ul className={styles.members}>
            {members.map((member) => (
              <li key={member.email}>
                <div className={styles.memberIdentity}>
                  <strong>{member.name || member.email}</strong>
                  {member.name && <span>{member.email}</span>}
                </div>
                <div className={styles.memberBadges}>
                  <StatusBadge tone={member.permanent ? "new" : "active"}>
                    {staffCopy.roles[member.role]}
                  </StatusBadge>
                  {member.permanent && (
                    <StatusBadge tone="done">{copy.permanent}</StatusBadge>
                  )}
                  {member.self && (
                    <StatusBadge tone="transit">{copy.self}</StatusBadge>
                  )}
                  {member.pending && (
                    <StatusBadge tone="closed">{copy.pending}</StatusBadge>
                  )}
                </div>
                <span className={styles.memberSignIn}>
                  {copy.lastSignIn}:{" "}
                  {member.lastSignInAt
                    ? new Date(member.lastSignInAt).toLocaleDateString(
                        "uk-UA",
                        {
                          timeZone: "Europe/Kyiv",
                        },
                      )
                    : copy.never}
                </span>
                {canManage && !member.permanent && !member.self && (
                  <div className={styles.memberActions}>
                    <StaffSelect
                      label={copy.changeRole}
                      value={member.role}
                      disabled={pending}
                      onChange={(event) =>
                        setAsk({
                          kind: "role",
                          email: member.email,
                          role: event.target.value,
                        })
                      }
                    >
                      {staffRoles.map((value) => (
                        <option key={value} value={value}>
                          {staffCopy.roles[value]}
                        </option>
                      ))}
                    </StaffSelect>
                    <button
                      type="button"
                      className={catalog.danger}
                      disabled={pending}
                      onClick={() =>
                        setAsk({ kind: "revoke", email: member.email })
                      }
                    >
                      {copy.revoke}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.summary}>{copy.empty}</p>
        )}
      </section>

      <StaffConfirm
        open={ask !== null}
        title={
          ask?.kind === "revoke"
            ? copy.revokeConfirmTitle
            : ask?.kind === "role"
              ? copy.roleConfirmTitle
              : copy.inviteConfirmTitle
        }
        body={
          ask
            ? `${ask.email} — ${
                ask.kind === "revoke"
                  ? copy.revokeConfirmBody
                  : ask.kind === "role"
                    ? copy.roleConfirmBody
                    : copy.inviteConfirmBody
              }`
            : ""
        }
        confirmLabel={
          ask?.kind === "revoke"
            ? copy.revoke
            : ask?.kind === "role"
              ? copy.changeRole
              : copy.inviteSubmit
        }
        danger={ask?.kind === "revoke"}
        busy={pending}
        onConfirm={() => {
          const request = ask;
          setAsk(null);
          if (request) run(request);
        }}
        onDismiss={() => {
          // The role select is controlled by the saved value, so cancelling it
          // snaps back on this re-render without a round trip.
          if (!pending) setAsk(null);
        }}
      />
    </div>
  );
}
