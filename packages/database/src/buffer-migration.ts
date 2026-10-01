import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BufferPublishing1790455200000 implements MigrationInterface {
  name = 'BufferPublishing1790455200000';

  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE channel_connections
        ADD COLUMN provider text NOT NULL DEFAULT 'direct'
        CHECK (provider IN ('direct','buffer'));
    `);
  }

  async down() {
    throw new Error('Use a reviewed migration to remove Buffer connection data.');
  }
}
