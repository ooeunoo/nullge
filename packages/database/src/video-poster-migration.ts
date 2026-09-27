import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoPosters1790560000000 implements MigrationInterface {
  name = 'VideoPosters1790560000000';
  async up(q: QueryRunner) {
    // A manually uploaded video may carry a first-frame poster captured in the browser; feeds use it as the thumbnail.
    await q.query('ALTER TABLE posts ADD COLUMN "posterAssetId" uuid REFERENCES marketing_assets(id)');
  }
  async down() { throw new Error('Use a reviewed migration to remove video posters.'); }
}
