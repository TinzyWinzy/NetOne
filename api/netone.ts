import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleNetOne } from '../server/service.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const response = await handleNetOne({ method: req.method || 'GET', action: String(req.query.action || 'session'), id: typeof req.query.id === 'string' ? req.query.id : undefined, cookie: req.headers.cookie, origin: req.headers.origin, host: req.headers.host || '', body: req.body });
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(response.headers || {})) res.setHeader(key, value);
  res.status(response.status).json(response.body);
}

