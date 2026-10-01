import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(root, '.local', 'postgres');
const run = (cmd, args, options = {}) => spawnSync(cmd, args, { stdio: 'inherit', ...options });
mkdirSync(path.join(root, '.local'), { recursive: true });
if (!existsSync(path.join(data, 'PG_VERSION'))) {
  const result = run('initdb', ['-D', data, '-U', 'nullge', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  if (result.status !== 0) {
    console.error('Install PostgreSQL 16+ or configure a separate local database.');
    process.exit(1);
  }
}
if (run('pg_ctl', ['-D', data, 'status'], { stdio: 'ignore' }).status !== 0) {
  const result = run('pg_ctl', [
    '-D',
    data,
    '-l',
    path.join(root, '.local', 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p 5549 -k ${path.join(root, '.local')}`,
    '-w',
    'start',
  ]);
  if (result.status !== 0) process.exit(1);
}
const query = run(
  'psql',
  [
    '-h',
    '127.0.0.1',
    '-p',
    '5549',
    '-U',
    'nullge',
    '-d',
    'postgres',
    '-tAc',
    "SELECT 1 FROM pg_database WHERE datname='nullge_console'",
  ],
  { encoding: 'utf8', stdio: 'pipe' },
);
if (query.status !== 0) {
  console.error('Could not verify the local Console database.');
  process.exit(1);
}
if (
  query.stdout.trim() !== '1' &&
  run('createdb', ['-h', '127.0.0.1', '-p', '5549', '-U', 'nullge', 'nullge_console']).status !== 0
)
  process.exit(1);
console.log('Local Console database ready on 127.0.0.1:5549 (persistent .local/postgres).');
