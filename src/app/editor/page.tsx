import type { Metadata } from 'next';
import { requireVerifiedUser } from '@/auth/cookies';
import { WordShell } from '@/components/WordShell';
import { paperFor } from '@/db/tests';
import { isLanguage, type Language } from '@/exam/types';

export const metadata: Metadata = {
  title: 'Document Editor',
  // Behind a login; a crawler only ever reaches the redirect to /login.
  robots: { index: false, follow: false },
};

/**
 * `/editor?docUrl=...`
 *
 * The page is a thin server component: it reads the address off the query
 * string and hands it to the client shell, which owns loading and editing.
 *
 * For an exam sitting it also resolves which paper is being sat — the one
 * `?test=<slug>` names, else today's (`paperFor`) — and passes it down already
 * built. Loading it here rather than in the shell is what keeps the clock and
 * the questions in step: the shell starts the timer on mount, and a paper that
 * arrived afterwards would mean the first seconds were spent on a question that
 * then changed underneath the candidate.
 */
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireVerifiedUser();
  const params = await searchParams;
  const first = (value: string | string[] | undefined): string | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const docUrl = first(params.docUrl);
  const languageParam = first(params.lang);
  const language: Language = isLanguage(languageParam) ? languageParam : 'en';

  // The exam panels appear only for an exam. A blank document, or one opened
  // from a URL, is a plain word processor.
  const exam = first(params.mode) === 'exam';

  // Null outside an exam, and null when nothing has been authored yet — the
  // shell then falls back to the sample paper, as it did before any of this.
  const paper = exam ? await paperFor({ slug: first(params.test), subject: 'word' }, user.name) : null;

  return (
    <WordShell
      docUrl={docUrl}
      exam={exam}
      language={language}
      attempt={paper?.attempt ?? null}
      testId={paper?.testId ?? null}
    />
  );
}
