/** The shape both the create and update plan routes accept — same fields as `PlanForm`. */
export interface PlanInput {
  name?: string;
  priceInInr?: string;
  durationDays?: string;
  mockLimit?: string;
  /** One feature bullet per line. */
  features?: string;
  isDefault?: boolean;
  isPopular?: boolean;
  isActive?: boolean;
  sortOrder?: string;
}

export interface ParsedPlanFields {
  name: string;
  priceInInr: number;
  durationDays: number | null;
  mockLimit: number | null;
  features: string[];
  isDefault: boolean;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

export type ParsePlanInputResult = { ok: true; fields: ParsedPlanFields } | { ok: false; code: string; detail: string };

function intOrNull(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePlanInput(body: PlanInput): ParsePlanInputResult {
  const name = body.name?.trim() ?? '';
  if (!name) return { ok: false, code: 'NAME_REQUIRED', detail: 'Enter the plan name.' };

  const priceInInr = intOrNull(body.priceInInr) ?? 0;
  if (priceInInr < 0) return { ok: false, code: 'INVALID_PRICE', detail: 'Price cannot be negative.' };

  const durationDays = intOrNull(body.durationDays);
  if (durationDays !== null && durationDays <= 0) {
    return { ok: false, code: 'INVALID_DURATION', detail: 'Duration must be a positive number of days, or left blank for no expiry.' };
  }

  const mockLimit = intOrNull(body.mockLimit);
  if (mockLimit !== null && mockLimit < 0) {
    return { ok: false, code: 'INVALID_MOCK_LIMIT', detail: 'Mock limit cannot be negative, or left blank for unlimited.' };
  }

  const features = (body.features ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    ok: true,
    fields: {
      name,
      priceInInr,
      durationDays,
      mockLimit,
      features,
      isDefault: Boolean(body.isDefault),
      isPopular: Boolean(body.isPopular),
      isActive: body.isActive ?? true,
      sortOrder: intOrNull(body.sortOrder) ?? 0,
    },
  };
}
