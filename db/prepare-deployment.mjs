if (process.env.NETONE_MIGRATE === '1') {
  if (process.env.VERCEL !== '1' || process.env.NETONE_DATABASE_SOURCE !== 'vercel-neon') throw new Error('Integration migration must run inside the linked NetOne Vercel deployment.');
  await import('./migrate-netone.mjs');
}
