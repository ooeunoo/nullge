import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Threads topic tag per post (docs/specs/marketing-workspace.md): sent as topic_tag on the main Threads container. */
export class ThreadsTopicTags1791504000000 implements MigrationInterface {
  name = 'ThreadsTopicTags1791504000000';
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS "topicTag" text`);
  }
  async down() {
    throw new Error('Use a reviewed migration to remove Threads topic tags.');
  }
}
