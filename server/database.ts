// Explicit local connections take priority. Integration credentials are accepted
// only on Vercel when this NetOne project opts in; never from a local .env file.
export function databaseUrl(): string | undefined {
  if (process.env.NETONE_DATABASE_URL) return process.env.NETONE_DATABASE_URL;
  if (process.env.VERCEL === '1' && process.env.NETONE_DATABASE_SOURCE === 'vercel-neon') return process.env.DATABASE_URL;
  return undefined;
}
