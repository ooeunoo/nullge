import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://nullge@127.0.0.1:5549/nullge_console',
  CONSOLE_ORIGIN: process.env.CONSOLE_ORIGIN || 'http://127.0.0.1:4310',
  API_INTERNAL_URL: process.env.API_INTERNAL_URL || 'http://127.0.0.1:4311',
  CONSOLE_DEV_LOGIN: process.env.CONSOLE_DEV_LOGIN || '1',
};
const dbUrl = new URL(env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || !dbUrl.pathname.startsWith('/nullge_'))
  throw new Error('pnpm dev requires an isolated local nullge_* database.');
function run(cmd, args) {
  if (spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit' }).status !== 0) process.exit(1);
}
if (env.DATABASE_URL === 'postgres://nullge@127.0.0.1:5549/nullge_console')
  run(process.execPath, ['scripts/local-db.mjs']);
run('pnpm', ['--filter', '@nullge/contracts', 'build']);
run('pnpm', ['--filter', '@nullge/database', 'build']);
run('pnpm', ['--filter', '@nullge/database', 'migrate']);
run('pnpm', ['--filter', '@nullge/database', 'seed']);
run('pnpm', ['--filter', '@nullge/api', 'build']);
run('pnpm', ['--filter', '@nullge/worker', 'build']);
const children = [
  spawn(process.execPath, ['apps/api/dist/main.js'], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, ['apps/worker/dist/main.js'], { cwd: root, env, stdio: 'inherit' }),
  spawn('pnpm', ['--filter', '@nullge/console', 'dev'], { cwd: root, env, stdio: 'inherit' }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children)
  child.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
