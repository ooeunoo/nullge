import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Channel board (Bullseye): channels under test per product, with a window and a pass rule. */
export class ChannelBoard1791331200000 implements MigrationInterface {
  name = 'ChannelBoard1791331200000';
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE IF NOT EXISTS channel_tests (
      id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL, "projectId" uuid NOT NULL,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
      status text NOT NULL DEFAULT 'testing' CHECK (status IN ('idea','testing','keep','stopped')),
      "startedOn" date, "endsOn" date,
      goal text NOT NULL DEFAULT '' CHECK (char_length(goal) <= 300),
      result text NOT NULL DEFAULT '' CHECK (char_length(result) <= 500),
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY ("workspaceId","projectId") REFERENCES projects("workspaceId",id)
    )`);
  }
  async down() {
    throw new Error('Use a reviewed migration to remove the channel board.');
  }
}
