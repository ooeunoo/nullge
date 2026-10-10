import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Self-reply threads (docs/specs/marketing-workspace.md): follow-up texts and the ids of the replies posted. */
export class ReplyThreads1791417600000 implements MigrationInterface {
  name = 'ReplyThreads1791417600000';
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS replies jsonb NOT NULL DEFAULT '[]'`);
    await q.query(
      `ALTER TABLE publication_jobs ADD COLUMN IF NOT EXISTS "replyIds" jsonb NOT NULL DEFAULT '[]'`,
    );
  }
  async down() {
    throw new Error('Use a reviewed migration to remove reply threads.');
  }
}
