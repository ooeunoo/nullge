import type { MigrationInterface, QueryRunner } from 'typeorm';
import { WORKSPACE_ID } from './migration';

/** The operator removed these products from the console on 2026-10-02. Bootstrap no longer inserts them. */
export const retiredProductSlugs = ['minimo', 'movy', 'desk'];

/** Product-scoped tables the 2026-10-02 removal cleared, children before parents. */
const productTables20261002 = [
  'publication_jobs',
  'marketing_assets',
  'generation_jobs',
  'channel_oauth',
  'channel_connections',
  'events',
  'profile_versions',
];

/**
 * Deletes each product with its rows in `tables` (children first); rows in `detach` keep their data but lose the
 * product link. A product that already holds posts is left untouched so nothing an operator wrote is lost.
 */
export async function retireProducts(
  q: QueryRunner,
  slugs: string[],
  tables: string[],
  detach: string[] = [],
) {
  const removed: string[] = [];
  const kept: string[] = [];
  for (const slug of slugs) {
    const [project] = await q.query('SELECT id FROM projects WHERE "workspaceId"=$1 AND slug=$2 FOR UPDATE', [
      WORKSPACE_ID,
      slug,
    ]);
    if (!project) continue;
    const scope = [WORKSPACE_ID, project.id];
    const [{ n }] = await q.query(
      'SELECT count(*)::int n FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2',
      scope,
    );
    if (n) {
      kept.push(slug);
      continue;
    }
    for (const table of detach)
      await q.query(`UPDATE ${table} SET "projectId"=NULL WHERE "workspaceId"=$1 AND "projectId"=$2`, scope);
    for (const table of tables)
      await q.query(`DELETE FROM ${table} WHERE "workspaceId"=$1 AND "projectId"=$2`, scope);
    await q.query('DELETE FROM projects WHERE "workspaceId"=$1 AND id=$2', scope);
    removed.push(slug);
  }
  console.log(
    `Retired products removed: ${removed.join(', ') || 'none'}; kept because they hold content: ${kept.join(', ') || 'none'}.`,
  );
}

/**
 * Deletes each retired product with its profile history, events, channel connections and unposted generation
 * records. A product that already holds content is left untouched so nothing an operator wrote is lost.
 */
export class ProductsRetired1790726400000 implements MigrationInterface {
  name = 'ProductsRetired1790726400000';
  async up(q: QueryRunner) {
    await retireProducts(q, retiredProductSlugs, productTables20261002);
  }
  async down() {
    throw new Error('Retired products are not restored; add a product through the catalog instead.');
  }
}
