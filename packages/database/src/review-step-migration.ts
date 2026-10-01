import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The separate "검토 대기" step was dropped: a draft is approved directly, then published. Pending reviews return to draft. */
export class ReviewStepRemoved1790640000000 implements MigrationInterface {
  name = 'ReviewStepRemoved1790640000000';
  async up(q: QueryRunner) {
    await q.query(`UPDATE posts SET status='draft' WHERE status='review'`);
    await q.query('ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check');
    await q.query(
      `ALTER TABLE posts ADD CONSTRAINT posts_status_check CHECK (status IN ('draft','approved'))`,
    );
  }
  async down() {
    throw new Error('Use a reviewed migration to reintroduce the review step.');
  }
}
