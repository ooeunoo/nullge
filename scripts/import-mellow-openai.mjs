// Operator-authorized one-time reuse. Secret values stay in memory and stdin, never argv/logs/files.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const source = '/Users/eun/projects/eun/mellow';
const target = '/Users/eun/projects/eun/nullge';
const project = '3c584db8-6a84-4244-851d-0a4911e42674';
function variables(cwd, service) {
  const r = spawnSync(
    'railway',
    ['variables', '--service', service, '--environment', 'production', '--json'],
    { cwd, encoding: 'utf8' },
  );
  if (r.status !== 0) throw Error('Could not read Railway variables (details withheld).');
  return JSON.parse(r.stdout);
}
const mellow = variables(source, 'worker'),
  api = variables(target, 'api'),
  worker = variables(target, 'worker');
if (!mellow.OPENAI_API_KEY) throw Error('Mellow OpenAI API key is not configured.');
if (
  api.MARKETING_SECRET_KEY &&
  worker.MARKETING_SECRET_KEY &&
  api.MARKETING_SECRET_KEY !== worker.MARKETING_SECRET_KEY
)
  throw Error('Existing encryption keys differ; manual review required.');
const encryption = api.MARKETING_SECRET_KEY || worker.MARKETING_SECRET_KEY || randomBytes(32).toString('hex');
for (const service of ['api', 'worker']) {
  const current = service === 'api' ? api : worker;
  const values = {
    MARKETING_SECRET_KEY: encryption,
    OPENAI_API_KEY: current.OPENAI_API_KEY || mellow.OPENAI_API_KEY,
    OPENAI_MODEL: current.OPENAI_MODEL || mellow.OPENAI_MODEL || 'gpt-4o-mini',
  };
  for (const [key, value] of Object.entries(values)) {
    if (current[key] === value) {
      console.log(`${service}: ${key} unchanged`);
      continue;
    }
    const r = spawnSync(
      'railway',
      [
        'variables',
        'set',
        key,
        '--stdin',
        '--skip-deploys',
        '--project',
        project,
        '--service',
        service,
        '--environment',
        'production',
      ],
      { cwd: target, input: value, encoding: 'utf8' },
    );
    if (r.status !== 0) throw Error(`Could not configure ${service}/${key} (details withheld).`);
    console.log(`${service}: ${key} configured`);
  }
}
console.log('No paid generation, account connection, or publication was performed.');
