import { config } from 'dotenv';
import { resolve } from 'node:path';
import { database } from './index';
import { seedDevelopment,seedInitialProducts } from './seed';
config({ path: resolve(__dirname, '../../../.env'), quiet: true });
async function run() {
  const db = await database().initialize();
  try {
    if (process.argv[2] === 'migrate') { await db.runMigrations({ transaction: 'all' }); console.log('Console migrations applied.'); }
    else if (process.argv[2] === 'seed') { await seedDevelopment(db); console.log('Local product profiles ready; all remain unreviewed.'); }
    else if (process.argv[2] === 'bootstrap') { await seedInitialProducts(db); console.log('Initial unreviewed product profiles inserted; existing profiles preserved.'); }
    else throw new Error('Expected migrate, seed, or bootstrap');
  } finally { await db.destroy(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
