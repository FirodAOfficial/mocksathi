import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/auth/cookies';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { deleteAvatar, uploadAvatar } from '@/utils/supabase/admin';

/**
 * Profile picture upload/removal. `requireUser()` first, same as every other
 * `/api/profile/*` route — the target is always the caller's own row
 * (`user.id`), never one taken from the request body, so there's no way to
 * change anyone else's avatar even by tampering with the request.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function badRequest(code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status: 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('INVALID_FORM_DATA', 'Could not read the upload.');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return badRequest('FILE_REQUIRED', 'Choose an image to upload.');
  if (!ALLOWED_TYPES.has(file.type)) {
    return badRequest('UNSUPPORTED_TYPE', 'Only JPEG, PNG, or WebP images are supported.');
  }
  if (file.size > MAX_BYTES) {
    return badRequest('TOO_LARGE', 'Image must be 3MB or smaller.');
  }

  let avatarUrl: string;
  try {
    const uploaded = await uploadAvatar(user.id, file, file.type);
    // Supabase's own CDN caches the object at this URL — a same-path upsert
    // needs a cache-busting query so the browser (and any CDN edge) actually
    // fetches the new bytes instead of serving the old ones back.
    avatarUrl = `${uploaded.publicUrl}?v=${Date.now()}`;
  } catch {
    return NextResponse.json(
      { code: 'UPLOAD_FAILED', detail: 'Could not upload the image. Try again.' },
      { status: 502 },
    );
  }

  await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, user.id));

  return NextResponse.json({ avatarUrl }, { headers: { 'cache-control': 'no-store' } });
}

export async function DELETE(): Promise<NextResponse> {
  const user = await requireUser();

  try {
    await deleteAvatar(user.id);
  } catch {
    // Best-effort: clearing the DB field is what actually removes the photo
    // from the app's point of view. An orphaned Storage object left behind
    // by a failed delete isn't user-visible and isn't worth failing this
    // request over.
  }

  await db.update(users).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
