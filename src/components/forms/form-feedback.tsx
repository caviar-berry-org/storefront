"use client";

import { useState, type ComponentProps } from "react";
import styles from "./form-feedback.module.css";

type Props = ComponentProps<"div"> & { wrapperClassName?: string };

export function FormFeedback({
  children,
  role,
  wrapperClassName = "",
  ...props
}: Props) {
  const visible = Boolean(children);
  const [last, setLast] = useState(children);
  if (visible && last !== children) setLast(children);

  return (
    <div
      className={`form-feedback ${styles.feedback} ${wrapperClassName}`}
      data-visible={visible}
      role={role === "status" ? role : undefined}
    >
      <div className={styles.clip} inert={!visible} aria-hidden={!visible}>
        <div {...props} role={role === "status" ? undefined : role}>
          {visible ? children : last}
        </div>
      </div>
    </div>
  );
}
