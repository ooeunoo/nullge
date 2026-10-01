import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(process.env.SITE_DIRECTORY || 'public');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
    }
    if (req.headers.host?.split(':')[0] === 'nullge.com') {
      res.writeHead(308, { Location: `https://www.nullge.com${url.pathname}${url.search}` });
      return res.end();
    }
    const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    if (
      !['index.html', 'styles.css', 'robots.txt', 'sitemap.xml', '.nojekyll'].includes(name) &&
      !/^assets\/[a-zA-Z0-9_.-]+$/.test(name)
    ) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const body = await readFile(resolve(root, name));
    res.writeHead(200, {
      'Content-Type': types[extname(name)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': name === 'index.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(Number(process.env.PORT || 4320), '::', () => console.log('Nullge public site ready.'));
process.on('SIGTERM', () => server.close());
