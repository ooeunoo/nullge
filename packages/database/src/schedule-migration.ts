import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Scheduled publishing (docs/specs/marketing-workspace.md). A schedule is bound to one post revision. */
export class ScheduledPublishing1791072000000 implements MigrationInterface {
  name = 'ScheduledPublishing1791072000000';
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS "scheduledAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "scheduledBy" uuid REFERENCES operators(id),
      ADD COLUMN IF NOT EXISTS "scheduledRevision" integer,
      ADD COLUMN IF NOT EXISTS "scheduledConnectionRevision" integer`);
    await q.query(
      'CREATE INDEX IF NOT EXISTS posts_scheduled_due ON posts ("scheduledAt") WHERE "scheduledAt" IS NOT NULL',
    );
  }
  async down() {
    throw new Error('Use a reviewed migration to remove scheduled publishing.');
  }
}
