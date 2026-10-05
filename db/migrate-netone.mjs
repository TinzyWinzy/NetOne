import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
const url = process.env.NETONE_DATABASE_URL || (process.env.VERCEL === '1' && process.env.NETONE_DATABASE_SOURCE === 'vercel-neon' ? process.env.DATABASE_URL : undefined);
if (!url) throw new Error('Provide a dedicated NETONE_DATABASE_URL or explicitly enable the Neon integration on Vercel. Local DATABASE_URL is never used.');
const sql = neon(url);
const source = fs.readFileSync(new URL('./migrations/001-netone-evidence.sql', import.meta.url), 'utf8');
const statements = source.replace(/--[^\n]*/g, '').split(';').map(value => value.trim()).filter(value => value && !['BEGIN', 'COMMIT'].includes(value));
await sql.transaction(statements.map(statement => sql.query(statement)));
console.log('NetOne evidence migration completed.');
