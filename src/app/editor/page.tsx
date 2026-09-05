import { WordShell } from '@/components/WordShell';

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
  const raw = params.docUrl;
  const docUrl = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);

  return <WordShell docUrl={docUrl} />;
}
