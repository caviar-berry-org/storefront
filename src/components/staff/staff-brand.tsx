import Image from "next/image";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminLink } from "./admin-link";
import { adminPath } from "./navigation";
import styles from "./staff.module.css";

export function StaffBrand({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <AdminLink
      className={styles.brand}
      href={adminPath("")}
      onClick={onNavigate}
      title={staffCopy.sections.overview}
    >
      <span className={styles.brandMark}>
        <Image
          src="/assets/img/logo-emblem.svg"
          alt=""
          width={23}
          height={23}
          unoptimized
        />
      </span>
      <span className={styles.brandText}>
        <strong>{mobile ? staffCopy.panel : staffCopy.brand}</strong>
        {!mobile && <small>{staffCopy.panel}</small>}
      </span>
    </AdminLink>
  );
}
