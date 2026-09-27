import type { MigrationInterface, QueryRunner } from 'typeorm';
export const WORKSPACE_ID = '6ee516af-fd77-4f85-860b-80a7b4bb8466';
export class ConsoleFoundation1790319600000 implements MigrationInterface {
  name = 'ConsoleFoundation1790319600000';
  async up(q: QueryRunner) {
    await q.query(`
      CREATE TABLE workspaces (id uuid PRIMARY KEY, name text NOT NULL);
      INSERT INTO workspaces VALUES ('${WORKSPACE_ID}', 'Nullge');
      CREATE TABLE operators (
        id uuid PRIMARY KEY, "googleSub" text UNIQUE, email text NOT NULL UNIQUE,
        name text NOT NULL, "isLocal" boolean NOT NULL DEFAULT false
      );
      CREATE TABLE memberships (
        "workspaceId" uuid NOT NULL REFERENCES workspaces(id),
        "operatorId" uuid NOT NULL REFERENCES operators(id),
        role text NOT NULL CHECK (role = 'owner'), PRIMARY KEY ("workspaceId", "operatorId")
      );
      CREATE TABLE sessions (
        hash text PRIMARY KEY, "operatorId" uuid NOT NULL REFERENCES operators(id),
        "expiresAt" timestamptz NOT NULL
      );
      CREATE INDEX sessions_expiry ON sessions ("expiresAt");
      CREATE TABLE oauth_attempts (
        "stateHash" text PRIMARY KEY, "browserHash" text NOT NULL,
        nonce text NOT NULL, verifier text NOT NULL, "expiresAt" timestamptz NOT NULL
      );
      CREATE TABLE projects (
        id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL REFERENCES workspaces(id),
        slug text NOT NULL, name text NOT NULL, color text NOT NULL,
        description text NOT NULL DEFAULT '', audience text NOT NULL DEFAULT '',
        facts text NOT NULL DEFAULT '', tone text NOT NULL DEFAULT '',
        avoid text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '',
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        "profileReviewedAt" timestamptz,
        UNIQUE ("workspaceId", slug), UNIQUE ("workspaceId", id)
      );
      CREATE TABLE profile_versions (
        "workspaceId" uuid NOT NULL, "projectId" uuid NOT NULL,
        revision integer NOT NULL, snapshot jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("workspaceId", "projectId", revision),
        FOREIGN KEY ("workspaceId", "projectId") REFERENCES projects("workspaceId", id)
      );
      CREATE TABLE posts (
        id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL, "projectId" uuid NOT NULL,
        title varchar(120) NOT NULL, caption text NOT NULL DEFAULT '', brief text NOT NULL DEFAULT '',
        channel text NOT NULL CHECK (channel IN ('x', 'threads', 'instagram')),
        language text NOT NULL CHECK (language IN ('ko', 'en')),
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        "profileRevision" integer NOT NULL, "approvedAt" timestamptz,
        "approvedBy" uuid REFERENCES operators(id),
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY ("workspaceId", "projectId") REFERENCES projects("workspaceId", id),
        FOREIGN KEY ("workspaceId", "projectId", "profileRevision") REFERENCES profile_versions("workspaceId", "projectId", revision)
      );
      CREATE INDEX posts_project_updated ON posts ("workspaceId", "projectId", "updatedAt" DESC);
      CREATE TABLE events (
        id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL, "projectId" uuid NOT NULL,
        "actorId" uuid REFERENCES operators(id), action text NOT NULL, title text NOT NULL,
        "postId" uuid REFERENCES posts(id), "createdAt" timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY ("workspaceId", "projectId") REFERENCES projects("workspaceId", id)
      );
      CREATE INDEX events_workspace_created ON events ("workspaceId", "createdAt" DESC);
      CREATE TABLE worker_status (name text PRIMARY KEY, "heartbeatAt" timestamptz NOT NULL);
    `);
  }
  async down() { throw new Error('Use a reviewed migration to remove console data.'); }
}
