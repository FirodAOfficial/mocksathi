import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/auth/cookies';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/**
 * Renames the signed-in account. `requireUser()` first, same as every other
 * `/api/profile/*` route — the target is always the caller's own row.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RenameBody {
  name?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireUser();

  let body: RenameBody;
  try {
    body = (await request.json()) as RenameBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', detail: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const name = body.name?.trim() ?? '';
  if (!name) return NextResponse.json({ code: 'NAME_REQUIRED', detail: 'Enter your name.' }, { status: 400 });

  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));

  return NextResponse.json({ name }, { headers: { 'cache-control': 'no-store' } });
}
