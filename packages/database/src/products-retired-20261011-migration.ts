import type { MigrationInterface, QueryRunner } from 'typeorm';
import { retireProducts } from './products-retired-migration';

/** The operator removed these products from the console on 2026-10-11. Bootstrap no longer inserts them. */
export const retiredProductSlugs20261011 = ['kept', 'dotori'];

/**
 * Same rule as ProductsRetired1790726400000, covering the product tables added since: channel tests, messages
 * and operator tasks go with the product; spend rows stay (without the product) so monthly totals do not change.
 */
export class ProductsRetired1791590400000 implements MigrationInterface {
  name = 'ProductsRetired1791590400000';
  async up(q: QueryRunner) {
    await retireProducts(
      q,
      retiredProductSlugs20261011,
      [
        'publication_jobs',
        'marketing_assets',
        'generation_jobs',
        'channel_oauth',
        'channel_connections',
        'channel_tests',
        'content_messages',
        'operator_tasks',
        'events',
        'profile_versions',
      ],
      ['marketing_spend'],
    );
  }
  async down() {
    throw new Error('Retired products are not restored; add a product through the catalog instead.');
  }
}
