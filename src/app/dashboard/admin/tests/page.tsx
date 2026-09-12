import { requireAdmin } from '@/auth/cookies';
import { TestsListScreen } from '@/components/dashboard/admin/TestsListScreen';
import { listTests } from '@/db/tests';

export const metadata = { title: 'Test Enigma · MockSathi' };

export default async function TestEnigmaPage() {
  await requireAdmin();
  const tests = await listTests();
  return <TestsListScreen tests={tests} />;
}
