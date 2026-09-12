import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl } from './env';

/**
 * A Supabase client authenticated as the `service_role`, not the
 * publishable/anon key `src/utils/supabase/client.ts` and `server.ts` use —
 * those two exist for a future Supabase Auth integration this app doesn't
 * use yet; this one exists specifically for server-side Storage writes.
 *
 * This app authenticates its own users via `src/auth/` (DB-backed sessions,
 * nothing to do with Supabase Auth), so Supabase Storage's usual RLS model —
 * policies keyed on `auth.uid()` — can't apply here at all; there's no
 * Supabase-side session for `auth.uid()` to resolve from. The service role
 * key bypasses RLS entirely, which is safe *only* because every caller of
 * this module already ran `requireUser()` first — this client trusts the
 * route it's called from, not the network. It must never be imported by
 * anything that reaches a client component, and never given a `NEXT_PUBLIC_`
 * prefix (`src/utils/supabase/env.ts`'s warning on that applies doubly here).
 */

const AVATARS_BUCKET = 'avatars';

function serviceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Copy .env.example to .env and fill it in.');
  return value;
}

let cached: SupabaseClient | undefined;

function supabaseAdmin(): SupabaseClient {
  cached ??= createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export interface UploadedAvatar {
  publicUrl: string;
}

/**
 * Uploads to a *fixed* path per user (`<userId>`, no extension, no
 * timestamp) with `upsert: true` — a re-upload replaces the same object
 * instead of accumulating a new file (and a stale one) per change. The
 * correct image type is served via the object's stored content-type, not the
 * path, so the fixed extension-less key doesn't affect how it renders.
 */
export async function uploadAvatar(userId: string, file: Blob, contentType: string): Promise<UploadedAvatar> {
  const client = supabaseAdmin();
  const { error } = await client.storage
    .from(AVATARS_BUCKET)
    .upload(userId, file, { contentType, upsert: true, cacheControl: '3600' });
  if (error) throw error;

  const { data } = client.storage.from(AVATARS_BUCKET).getPublicUrl(userId);
  return { publicUrl: data.publicUrl };
}

export async function deleteAvatar(userId: string): Promise<void> {
  const client = supabaseAdmin();
  const { error } = await client.storage.from(AVATARS_BUCKET).remove([userId]);
  if (error) throw error;
}
