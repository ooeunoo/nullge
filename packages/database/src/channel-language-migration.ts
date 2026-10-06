import type { MigrationInterface, QueryRunner } from 'typeorm';
import { LANGUAGES } from '@nullge/contracts';

/** One account per channel and language (see docs/specs/multilingual-channels.md). Existing accounts stay Korean. */
export class ChannelLanguages1790985600000 implements MigrationInterface {
  name = 'ChannelLanguages1790985600000';
  async up(q: QueryRunner) {
    const allowed = LANGUAGES.map((l) => `'${l}'`).join(',');
    await q.query(`ALTER TABLE channel_connections ADD COLUMN language text NOT NULL DEFAULT 'ko'`);
    await q.query(
      `ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_language_check CHECK (language IN (${allowed}))`,
    );
    await q.query('ALTER TABLE channel_connections DROP CONSTRAINT channel_connections_pkey');
    await q.query(
      'ALTER TABLE channel_connections ADD PRIMARY KEY ("workspaceId","projectId",channel,language)',
    );
    await q.query('ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_language_check');
    await q.query(`ALTER TABLE posts ADD CONSTRAINT posts_language_check CHECK (language IN (${allowed}))`);
  }
  async down() {
    throw new Error('Use a reviewed migration to merge language accounts.');
  }
}
