import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/cookies';
import { documentQuestionsFor, savePassage } from '@/db/documentPapers';
import { parsePassage } from '@/db/documentPaperInput';
import { getTestById, questionsForTest } from '@/db/tests';

/**
 * Saves the passage of a single-document Word paper.
 *
 * Admin-only, checked here as well as on the page, because the route is
 * reachable directly. Refused once the paper has questions: every question is
 * stored as character offsets into this passage, so changing a word of it
 * would silently move what every question is about.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function refuse(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json({ code, detail }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;

  const test = await getTestById(id);
  if (!test) return refuse(404, 'NOT_FOUND', 'No such test.');
  if (test.subject !== 'word') return refuse(400, 'NOT_A_WORD_PAPER', 'Only a Word paper is written on one document.');

  const [legacy, questions] = await Promise.all([questionsForTest(id), documentQuestionsFor(id)]);
  if (legacy.length > 0) {
    return refuse(409, 'PER_QUESTION_PAPER', 'This paper already has per-question passages, so it cannot also have a single document.');
  }
  if (questions.length > 0) {
    return refuse(
      409,
      'PASSAGE_LOCKED',
      'The passage is fixed once questions have been recorded on it. Delete every question to change it.',
    );
  }

  let body: { document?: unknown };
  try {
    body = (await request.json()) as { document?: unknown };
  } catch {
    return refuse(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = parsePassage(body.document);
  if (!parsed.ok) return refuse(400, parsed.code, parsed.detail);

  await savePassage(id, parsed.fields);
  return NextResponse.json({ document: parsed.fields }, { headers: { 'cache-control': 'no-store' } });
}
