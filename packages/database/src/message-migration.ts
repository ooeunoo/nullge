import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Message experiments and post results (docs/specs/marketing-workspace.md, step 2). */
export class MessageExperiments1791158400000 implements MigrationInterface {
  name = 'MessageExperiments1791158400000';
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE IF NOT EXISTS content_messages (
      id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL, "projectId" uuid NOT NULL,
      label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
      description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
      status text NOT NULL DEFAULT 'testing' CHECK (status IN ('testing','winner','dropped')),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY ("workspaceId","projectId") REFERENCES projects("workspaceId",id)
    )`);
    await q.query(
      'ALTER TABLE posts ADD COLUMN IF NOT EXISTS "messageId" uuid REFERENCES content_messages(id) ON DELETE SET NULL',
    );
    await q.query(`CREATE TABLE IF NOT EXISTS post_metrics (
      "postId" uuid PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
      reach integer NOT NULL DEFAULT 0 CHECK (reach >= 0),
      saves integer NOT NULL DEFAULT 0 CHECK (saves >= 0),
      shares integer NOT NULL DEFAULT 0 CHECK (shares >= 0),
      likes integer NOT NULL DEFAULT 0 CHECK (likes >= 0),
      comments integer NOT NULL DEFAULT 0 CHECK (comments >= 0),
      "profileVisits" integer NOT NULL DEFAULT 0 CHECK ("profileVisits" >= 0),
      "linkClicks" integer NOT NULL DEFAULT 0 CHECK ("linkClicks" >= 0),
      "recordedAt" timestamptz NOT NULL DEFAULT now(),
      "recordedBy" uuid REFERENCES operators(id)
    )`);
  }
  async down() {
    throw new Error('Use a reviewed migration to remove message experiments.');
  }
}
