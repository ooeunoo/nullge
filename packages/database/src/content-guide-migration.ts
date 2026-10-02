import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-product content guide (see docs/specs/content-quality.md). Empty means the previous behavior. */
export class ContentGuide1790812800000 implements MigrationInterface {
  name = 'ContentGuide1790812800000';
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS guide jsonb NOT NULL DEFAULT '{}'::jsonb`);
    // The photo a template was composed from, so a template can be re-applied without stacking overlays.
    await q.query(
      'ALTER TABLE posts ADD COLUMN IF NOT EXISTS "sourceAssetId" uuid REFERENCES marketing_assets(id)',
    );
  }
  async down() {
    throw new Error('Use a reviewed migration to remove content guides.');
  }
}
