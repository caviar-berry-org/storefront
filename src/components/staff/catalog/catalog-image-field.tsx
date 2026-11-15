"use client";

import { useContext, useId, useState } from "react";
import { Photo } from "@/components/ui/photo";
import {
  catalogImageLimit,
  catalogImageTypes,
  type CatalogKind,
} from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { StaffIcon } from "../staff-icon";
import { ShowImagePreview } from "./catalog-group";
import styles from "./catalog.module.css";

export function CatalogImageField({
  name,
  label,
  initial = "",
  error,
  clearable,
  kind = "caviar",
  active = true,
  fallbackSrc,
  fallbackLabel,
  onImageChange,
}: {
  name: string;
  label: string;
  initial?: string;
  error?: string;
  clearable?: boolean;
  kind?: CatalogKind;
  active?: boolean;
  fallbackSrc?: string;
  fallbackLabel?: string;
  onImageChange?: (image: string) => void;
}) {
  const showPreview = useContext(ShowImagePreview);
  const [image, setImage] = useState(initial);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [failedSource, setFailedSource] = useState<string>();
  const preview = image || fallbackSrc;
  const failed = Boolean(preview && failedSource === preview);
  const id = useId();
  const feedback =
    message ||
    error ||
    (uploading
      ? copy.uploading
      : image && image !== initial
        ? copy.imageReady
        : "");
  return (
    <div className={styles.imageRow} data-uploading={uploading || undefined}>
      <div className={styles.thumbnail}>
        {preview && !failed && showPreview && active ? (
          <Photo
            src={preview}
            alt=""
            sizes="(max-width: 420px) 64px, 104px"
            onError={() => setFailedSource(preview)}
          />
        ) : (
          <StaffIcon name="image" />
        )}
      </div>
      <div className={styles.imageControls}>
        <span id={`${id}-title`} className={styles.imageTitle}>
          {label}
        </span>
        <input type="hidden" name={name} value={image} />
        <div className={styles.uploadActions}>
          <label className={styles.fileButton}>
            <StaffIcon name="add" />
            <span id={`${id}-action`}>
              {image ? copy.replaceImage : copy.chooseImage}
            </span>
            <input
              id={id}
              type="file"
              accept={catalogImageTypes.join(",")}
              disabled={uploading}
              aria-labelledby={`${id}-action ${id}-title`}
              aria-describedby={feedback ? `${id}-message` : undefined}
              aria-invalid={Boolean(message || error)}
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                setMessage("");
                if (file.size > catalogImageLimit)
                  return setMessage(copy.uploadErrors.size);
                if (!catalogImageTypes.includes(file.type))
                  return setMessage(copy.uploadErrors.format);
                setUploading(true);
                try {
                  const response = await fetch("/api/admin/catalog-image", {
                    method: "POST",
                    headers: {
                      "Content-Type": file.type,
                      "X-Catalog-Kind": kind,
                    },
                    body: file,
                  });
                  if (response.status === 413)
                    setMessage(copy.uploadErrors.size);
                  else if (response.status === 415)
                    setMessage(copy.uploadErrors.format);
                  else if (!response.ok) setMessage(copy.uploadErrors.upload);
                  else {
                    const nextImage = (await response.json()).image;
                    setImage(nextImage);
                    onImageChange?.(nextImage);
                    setFailedSource(undefined);
                  }
                } catch {
                  setMessage(copy.uploadErrors.upload);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {clearable && image && (
            <button
              type="button"
              className={styles.button}
              disabled={uploading}
              onClick={() => {
                setImage("");
                onImageChange?.("");
                setFailedSource(undefined);
                setMessage("");
              }}
            >
              {copy.remove}
            </button>
          )}
        </div>
        {!image && fallbackSrc && (
          <small className={styles.muted}>{fallbackLabel}</small>
        )}
        {failed && (
          <small className={styles.error} role="status">
            {copy.previewUnavailable}{" "}
            <button
              type="button"
              className={styles.button}
              onClick={() => setFailedSource(undefined)}
            >
              {copy.retry}
            </button>
          </small>
        )}
        {feedback && (
          <small
            id={`${id}-message`}
            role="status"
            className={message || error ? styles.error : styles.muted}
          >
            {feedback}
          </small>
        )}
      </div>
    </div>
  );
}
