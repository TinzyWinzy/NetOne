import type { VercelRequest, VercelResponse } from '@vercel/node';
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(410).json({ error: 'Legacy Econet endpoint retired. Use the authenticated NetOne API.' });
}
