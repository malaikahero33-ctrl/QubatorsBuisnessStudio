/**
 * Runtime configuration checks.
 *
 * The app must degrade sensibly before Supabase is configured, otherwise
 * `npm run dev` crashes on a fresh clone and the failure looks like a bug
 * rather than a missing setup step.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function missingSupabaseVars(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.ZEPTOMAIL_API_TOKEN);
}
