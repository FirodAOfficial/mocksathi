import { requireUser } from '@/auth/cookies';
import { SpreadsheetShell } from '@/components/spreadsheet/SpreadsheetShell';
import { isLanguage, type Language } from '@/exam/types';

export const metadata = {
  // Bare: the root layout's title template appends the site name.
  title: 'Spreadsheet Editor',
  robots: { index: false, follow: false },
};

/**
 * `/spreadsheet`
 *
 * A thin server component, matching `/editor`: it reads the mode off the query
 * string and hands off to the client shell, which owns the workbook.
 *
 * There is no `docUrl` yet. Opening a real `.xlsx` needs the parser that is the
 * next phase of this work, and accepting the parameter now would mean either
 * ignoring it silently or failing in a way that looked like a bug.
 */
export default async function SpreadsheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const first = (value: string | string[] | undefined): string | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const languageParam = first(params.lang);
  const language: Language = isLanguage(languageParam) ? languageParam : 'en';

  // The exam panels appear only for an exam. Without the flag this is a plain
  // spreadsheet, which is what the dashboard's practice entry opens.
  const exam = first(params.mode) === 'exam';

  return <SpreadsheetShell exam={exam} language={language} />;
}
