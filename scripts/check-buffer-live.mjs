import { database, MarketingStore, WORKSPACE_ID } from '@nullge/database';
import { execFileSync } from 'node:child_process';

// Read-only live check. Never print credentials, raw provider responses or DB errors.
let db;
let stage = 'read_connection_config';
try {
  const variables = JSON.parse(
    execFileSync(
      'railway',
      [
        'variable',
        'list',
        '--project',
        '3c584db8-6a84-4244-851d-0a4911e42674',
        '--service',
        'Postgres',
        '--environment',
        'production',
        '--json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
  if (!variables.DATABASE_PUBLIC_URL) {
    console.log(
      JSON.stringify({
        availableVariableNames: Object.keys(variables).filter((name) =>
          /DATABASE|POSTGRES|PGHOST|PORT|TCP_PROXY/.test(name),
        ),
      }),
    );
    throw new Error('Public database endpoint unavailable');
  }
  db = database(variables.DATABASE_PUBLIC_URL);
  stage = 'connect_database';
  await db.initialize();
  const store = new MarketingStore(db);
  stage = 'read_settings';
  const settings = await store.settings(WORKSPACE_ID);
  console.log(JSON.stringify({ bufferConfigured: settings.configured.bufferApiKey }));
  stage = 'read_buffer_channels';
  console.log(JSON.stringify({ channels: await store.bufferChannels(WORKSPACE_ID) }));
  stage = 'read_product_connections';
  console.log(JSON.stringify({ connections: await store.connections(WORKSPACE_ID, 'mellow') }));
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      stage,
      errorType: error?.constructor?.name,
      status: error?.status ?? null,
      code: error?.code ?? null,
    }),
  );
  process.exitCode = 1;
} finally {
  if (db?.isInitialized) await db.destroy();
}
