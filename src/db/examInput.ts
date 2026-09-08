import { EXAM_STATUSES, type ExamStatus } from './schema';

/** The shape both the create and update exam routes accept — same fields as the `ExamForm`. */
export interface ExamInput {
  name?: string;
  category?: string;
  organiserName?: string;
  organiserWebsite?: string;
  description?: string;
  notificationUrl?: string;
  registrationUrl?: string;
  formSubmissionStartDate?: string;
  registrationStartDate?: string;
  registrationLastDate?: string;
  examDate?: string;
  examEndDate?: string;
  admitCardDate?: string;
  resultDate?: string;
  qualificationRequirement?: string;
  ageLimitMin?: string;
  ageLimitMax?: string;
  applicationFee?: string;
  totalVacancies?: string;
  examMode?: string;
  status?: string;
}

export interface ParsedExamFields {
  name: string;
  organiserName: string;
  category: string | null;
  organiserWebsite: string | null;
  description: string | null;
  notificationUrl: string | null;
  registrationUrl: string | null;
  formSubmissionStartDate: string | null;
  registrationStartDate: string | null;
  registrationLastDate: string | null;
  examDate: string | null;
  examEndDate: string | null;
  admitCardDate: string | null;
  resultDate: string | null;
  qualificationRequirement: string | null;
  ageLimitMin: number | null;
  ageLimitMax: number | null;
  applicationFee: string | null;
  totalVacancies: number | null;
  examMode: string | null;
  status: ExamStatus;
}

export type ParseExamInputResult =
  | { ok: true; fields: ParsedExamFields }
  | { ok: false; code: string; detail: string };

/** `""` and `undefined` both mean "not provided" for these optional fields. */
function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function intOrNull(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isExamStatus(value: string): value is ExamStatus {
  return (EXAM_STATUSES as readonly string[]).includes(value);
}

/** Shared by `POST /api/admin/exams` and `PATCH /api/admin/exams/[id]` — same fields, same rules either way. */
export function parseExamInput(body: ExamInput): ParseExamInputResult {
  const name = body.name?.trim() ?? '';
  const organiserName = body.organiserName?.trim() ?? '';
  if (!name) return { ok: false, code: 'NAME_REQUIRED', detail: 'Enter the exam name.' };
  if (!organiserName) return { ok: false, code: 'ORGANISER_REQUIRED', detail: "Enter the organiser's name." };

  return {
    ok: true,
    fields: {
      name,
      organiserName,
      category: orNull(body.category),
      organiserWebsite: orNull(body.organiserWebsite),
      description: orNull(body.description),
      notificationUrl: orNull(body.notificationUrl),
      registrationUrl: orNull(body.registrationUrl),
      formSubmissionStartDate: orNull(body.formSubmissionStartDate),
      registrationStartDate: orNull(body.registrationStartDate),
      registrationLastDate: orNull(body.registrationLastDate),
      examDate: orNull(body.examDate),
      examEndDate: orNull(body.examEndDate),
      admitCardDate: orNull(body.admitCardDate),
      resultDate: orNull(body.resultDate),
      qualificationRequirement: orNull(body.qualificationRequirement),
      ageLimitMin: intOrNull(body.ageLimitMin),
      ageLimitMax: intOrNull(body.ageLimitMax),
      applicationFee: orNull(body.applicationFee),
      totalVacancies: intOrNull(body.totalVacancies),
      examMode: orNull(body.examMode),
      status: body.status && isExamStatus(body.status) ? body.status : 'draft',
    },
  };
}

export function isUniqueSlugViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '23505';
}
