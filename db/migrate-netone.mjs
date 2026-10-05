import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
const url = process.env.NETONE_DATABASE_URL || (process.env.VERCEL === '1' && process.env.NETONE_DATABASE_SOURCE === 'vercel-neon' ? process.env.DATABASE_URL : undefined);
if (!url) throw new Error('Provide a dedicated NETONE_DATABASE_URL or explicitly enable the Neon integration on Vercel. Local DATABASE_URL is never used.');
const sql = neon(url);
// Split only outside dollar-quoted PostgreSQL function bodies.
for (const name of fs.readdirSync(new URL('./migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
  const source = fs.readFileSync(new URL('./migrations/' + name, import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
  const statements = []; let start = 0; let quoted = false;
  for (let i = 0; i < source.length; i++) { if (source.slice(i, i + 2) === '$$') { quoted = !quoted; i++; } else if (source[i] === ';' && !quoted) { const statement = source.slice(start, i).trim(); if (statement && !['BEGIN', 'COMMIT'].includes(statement)) statements.push(statement); start = i + 1; } }
  await sql.transaction(statements.map(statement => sql.query(statement)));
}
console.log('NetOne evidence migration completed.');
