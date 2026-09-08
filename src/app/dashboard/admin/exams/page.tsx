import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/auth/cookies';
import { ExamsListScreen } from '@/components/dashboard/admin/ExamsListScreen';
import { db } from '@/db/client';
import { exams } from '@/db/schema';

export default async function ManageExamsPage() {
  await requireAdmin();
  const rows = await db.select().from(exams).orderBy(desc(exams.createdAt));
  return <ExamsListScreen exams={rows} />;
}
