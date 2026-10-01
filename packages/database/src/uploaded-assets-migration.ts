import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UploadedAssets1790460000000 implements MigrationInterface {
  name = 'UploadedAssets1790460000000';
  async up(q: QueryRunner) {
    // A generated asset retains its unique job; manually uploaded assets have no job.
    await q.query('ALTER TABLE marketing_assets ALTER COLUMN "jobId" DROP NOT NULL');
  }
  async down() {
    throw new Error('Use a reviewed migration to remove uploaded assets.');
  }
}
