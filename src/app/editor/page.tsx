import { WordShell } from '@/components/WordShell';
import { isLanguage, type Language } from '@/exam/types';

/**
 * `/editor?docUrl=...`
 *
 * The page is a thin server component: it reads the address off the query
 * string and hands it to the client shell, which owns loading and editing.
 */
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined): string | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

  const docUrl = first(params.docUrl);
  const languageParam = first(params.lang);
  const language: Language = isLanguage(languageParam) ? languageParam : 'en';

  // The exam panels appear only for an exam. A blank document, or one opened
  // from a URL, is a plain word processor.
  const exam = first(params.mode) === 'exam';

  return <WordShell docUrl={docUrl} exam={exam} language={language} />;
}
