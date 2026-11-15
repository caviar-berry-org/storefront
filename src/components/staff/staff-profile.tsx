"use client";

import Image from "next/image";
import { useState } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminLink } from "./admin-link";
import { adminPath } from "./navigation";
import { StaffIcon } from "./staff-icon";
import styles from "./staff.module.css";

export type StaffProfileData = {
  name: string;
  role: keyof typeof staffCopy.roles;
  avatar?: string;
};

export function StaffProfile({
  name,
  role,
  avatar,
  onNavigate,
}: StaffProfileData & { onNavigate?: () => void }) {
  const [failedAvatar, setFailedAvatar] = useState<string>();
  return (
    <AdminLink
      className={styles.profile}
      href={adminPath("settings")}
      onClick={onNavigate}
      title={staffCopy.sections.settings}
    >
      <span className={styles.profileAvatar}>
        <StaffIcon name="person" />
        {avatar && avatar !== failedAvatar && (
          <Image
            src={avatar}
            alt=""
            width={36}
            height={36}
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => setFailedAvatar(avatar)}
          />
        )}
      </span>
      <span className={styles.profileText}>
        <strong>{name}</strong>
        <small>{staffCopy.roles[role]}</small>
      </span>
    </AdminLink>
  );
}
