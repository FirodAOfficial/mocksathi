/**
 * The Supabase project's public credentials.
 *
 * Read through helpers rather than inline `process.env.X!` so a missing value
 * fails with a sentence that says what to do, instead of the SDK throwing
 * something opaque about an invalid URL — the same reason `src/db/client.ts`
 * checks `DATABASE_URL` by hand.
 *
 * Both are `NEXT_PUBLIC_`, so both are inlined into the browser bundle. That is
 * correct for these two: the publishable key is designed to be public and is
 * governed by row-level security. A `SUPABASE_SECRET_KEY` must never be given
 * that prefix — it bypasses row-level security entirely.
 */

/**
 * The credentials, or null when the project is not configured.
 *
 * Anything that runs on every request has to use this rather than the throwing
 * accessors below. `.env` and `.env.local` are gitignored, so a deployment that
 * has not had these set in its own environment has neither — and a throw in
 * that path takes down every route at once.
 */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
