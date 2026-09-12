import 'server-only';
import { Resend } from 'resend';

/**
 * The Resend client, and the one place the API key is read.
 *
 * `import 'server-only'` on line 1 is the point of this module: the key is a
 * send-on-your-behalf credential, so a build must fail rather than let a client
 * component import its way to it. It is deliberately not `NEXT_PUBLIC_`, and
 * `serverSafety.test.ts` walks the import graph below this file to prove no
 * client module is reachable from it.
 *
 * The key is read through a named accessor that throws a sentence saying what
 * to do, the same shape `src/utils/supabase/env.ts` and `src/auth/google.ts`
 * use, rather than `process.env.X!` failing later inside the SDK.
 */

function resendApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set. Copy .env.example to .env and fill it in.');
  }
  return key;
}

let client: Resend | undefined;

/**
 * Built on first use, not at import.
 *
 * `next build` imports every route module to read its config, so constructing
 * the client at module scope would make a build fail on any machine without the
 * key — the same reason `src/db/client.ts` defers its pool.
 */
export function resend(): Resend {
  client ??= new Resend(resendApiKey());
  return client;
}

/**
 * Who verification mail comes from.
 *
 * `mocksathi.com` is verified in Resend, and this mailbox is the one the domain
 * was set up for. Defined here so no route can invent its own sender: the
 * From address is part of what makes the mail deliverable, not a per-call
 * decision.
 */
export const VERIFY_FROM = 'Mocksathi <verify@mocksathi.com>';
