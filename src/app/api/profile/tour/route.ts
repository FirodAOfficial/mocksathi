import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/auth/cookies';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/**
 * Marks the student product tour seen — called on both finishing it and
 * skipping it, since either way it must not auto-start again. Idempotent:
 * a second call (replaying the tour via "Take a tour" and closing it again)
 * doesn't move the timestamp forward, so it still reads as "when this
 * candidate first got through the gate", not "most recently closed it".
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const user = await requireUser();

  if (!user.tourCompletedAt) {
    await db.update(users).set({ tourCompletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  }

  return NextResponse.json({ completed: true }, { headers: { 'cache-control': 'no-store' } });
}
