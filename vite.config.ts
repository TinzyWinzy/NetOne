import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleNetOne } from './server/service';
export default defineConfig({
  cacheDir: process.env.NETONE_LOCAL_DATA_DIR ? 'node_modules/.vite-netone-test' : 'node_modules/.vite-netone',
  optimizeDeps: { exclude: ['maplibre-gl'] },
  plugins: [react(), {
    name: 'netone-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        if (url.pathname !== '/api/netone') { res.statusCode = 410; res.end(JSON.stringify({ error: 'Legacy Econet API is retired in the NetOne application.' })); return; }
        try {
          let raw = '';
          for await (const chunk of req) {
            raw += chunk.toString();
            if (raw.length > 100000) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Request too large.' })); return; }
          }
          const response = await handleNetOne({ method: req.method || 'GET', action: url.searchParams.get('action') || 'session', id: url.searchParams.get('id') || undefined, cookie: req.headers.cookie, origin: req.headers.origin, host: req.headers.host || '', body: raw ? JSON.parse(raw) : undefined });
          res.statusCode = response.status;
          for (const [key, value] of Object.entries(response.headers || {})) res.setHeader(key, value);
          res.end(JSON.stringify(response.body));
        } catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid request body.' })); }
      });
    }
  }],
  server: { host: '127.0.0.1', port: 5174 }
});
