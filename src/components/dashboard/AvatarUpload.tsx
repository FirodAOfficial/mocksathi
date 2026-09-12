'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { DashboardIcon } from './icons/DashboardIcon';
import styles from './AvatarUpload.module.css';

export interface AvatarUploadProps {
  initials: string;
  avatarUrl: string | null;
}

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * The Account card's avatar circle, editable in place. Client-side type/size
 * checks here are just a fast first pass for a better error message — the
 * API route re-validates both server-side regardless, since nothing about a
 * client check is trustworthy on its own.
 *
 * `router.refresh()` after a successful change, not local-only state: the
 * same `avatarUrl` also shows in `PortalShell`'s topbar user chip, a
 * different component fed by the server-rendered layout, not this one.
 */
export function AvatarUpload({ initials, avatarUrl }: AvatarUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Only JPEG, PNG, or WebP images are supported.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 3MB or smaller.');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setBusy(true);

    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'Could not upload the image. Try again.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/profile/avatar', { method: 'DELETE' });
      if (!response.ok) {
        setError('Could not remove the photo. Try again.');
        return;
      }
      setPreview(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? avatarUrl;

  return (
    <div className={styles.wrap}>
      <div className={styles.avatarButton}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- a per-user Supabase Storage URL, not one `next/image` can optimize meaningfully.
          <img src={shown} alt="" className={styles.avatarImage} />
        ) : (
          <div className={styles.avatarInitials}>{initials}</div>
        )}

        <button
          type="button"
          className={styles.editButton}
          aria-label="Change profile photo"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <DashboardIcon name="camera" size={13} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.actionLink} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Uploading…' : shown ? 'Change photo' : 'Upload photo'}
        </button>
        {shown && (
          <button type="button" className={styles.actionLinkMuted} disabled={busy} onClick={handleRemove}>
            Remove
          </button>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
