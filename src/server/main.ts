import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { createApi } from '../foundation/server/createApi';
import { SERVER_APPS } from './apps';

const PORT = Number(process.env.PORT ?? 5173);
const root = path.resolve(import.meta.dirname, '../..');

async function main() {
  const app = express();
  const http = createHttpServer(app);
  const { router } = createApi({ apps: SERVER_APPS });
  app.use('/api', router);

  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(root, 'dist');
    app.use(express.static(dist));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
  } else {
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({
      root,
      appType: 'custom',
      server: { middlewareMode: true, hmr: { server: http } },
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== 'GET') return next();
      try {
        const html = await readFile(path.join(root, 'index.html'), 'utf8');
        res.status(200).set('Content-Type', 'text/html').end(await vite.transformIndexHtml(req.originalUrl, html));
      } catch (err) {
        next(err);
      }
    });
  }

  http.listen(PORT, () => {
    console.log(`\n  Keel is running → http://localhost:${PORT}\n  Data is in memory and resets when you stop the server.\n`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
