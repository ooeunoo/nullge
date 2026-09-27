import type { MigrationInterface, QueryRunner } from "typeorm";
export class MarketingWorkspace1790366400000 implements MigrationInterface {
  name = "MarketingWorkspace1790366400000";
  async up(q: QueryRunner) {
    await q.query(`
    CREATE TABLE integrations (
      "workspaceId" uuid PRIMARY KEY REFERENCES workspaces(id), revision integer NOT NULL DEFAULT 0,
      ciphertext text, "openaiModel" text NOT NULL DEFAULT 'gpt-4.1-mini',
      "openaiInputUsd" numeric, "openaiOutputUsd" numeric, "imageUsd" numeric, "videoUsd" numeric,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE integration_events (id uuid PRIMARY KEY,"workspaceId" uuid NOT NULL REFERENCES workspaces(id),"actorId" uuid NOT NULL REFERENCES operators(id),action text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now());
    CREATE TABLE channel_connections (
      "workspaceId" uuid NOT NULL,"projectId" uuid NOT NULL,channel text NOT NULL CHECK(channel IN ('x','threads','instagram')),
      revision integer NOT NULL DEFAULT 0,ciphertext text,"userId" text,username text,"verifiedAt" timestamptz,"expiresAt" timestamptz,
      PRIMARY KEY("workspaceId","projectId",channel),
      FOREIGN KEY("workspaceId","projectId") REFERENCES projects("workspaceId",id)
    );
    CREATE TABLE channel_oauth (
      hash text PRIMARY KEY,"workspaceId" uuid NOT NULL,"projectId" uuid NOT NULL,"actorId" uuid NOT NULL REFERENCES operators(id),
      revision integer NOT NULL,"settingsRevision" integer NOT NULL,ciphertext text NOT NULL,"expiresAt" timestamptz NOT NULL,
      FOREIGN KEY("workspaceId","projectId") REFERENCES projects("workspaceId",id)
    );
    CREATE TABLE generation_jobs (
      id uuid PRIMARY KEY,"workspaceId" uuid NOT NULL,"projectId" uuid NOT NULL,"actorId" uuid NOT NULL REFERENCES operators(id),
      prompt text NOT NULL,format text NOT NULL CHECK(format IN ('text','image','video')),channel text NOT NULL,language text NOT NULL,
      reference text,"profileRevision" integer NOT NULL,"settingsRevision" integer NOT NULL,
      snapshot jsonb NOT NULL,"estimatedUsd" numeric NOT NULL,"quoteExpiresAt" timestamptz NOT NULL,
      status text NOT NULL CHECK(status IN ('quoted','queued','planning','submitting','rendering','completed','failed','uncertain')),
      error text,"providerId" text,"postId" uuid REFERENCES posts(id),result jsonb,
      "confirmedAt" timestamptz,"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY("workspaceId","projectId","profileRevision") REFERENCES profile_versions("workspaceId","projectId",revision)
    );
    CREATE INDEX generation_pending ON generation_jobs(status,"updatedAt");
    CREATE TABLE marketing_assets (
      id uuid PRIMARY KEY,"workspaceId" uuid NOT NULL,"projectId" uuid NOT NULL,"jobId" uuid NOT NULL UNIQUE REFERENCES generation_jobs(id),
      mime text NOT NULL,content bytea NOT NULL CHECK(octet_length(content)<=26214400),"createdAt" timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY("workspaceId","projectId") REFERENCES projects("workspaceId",id)
    );
    ALTER TABLE posts ADD COLUMN format text NOT NULL DEFAULT 'text' CHECK(format IN ('text','image','video'));
    ALTER TABLE posts ADD COLUMN "assetId" uuid REFERENCES marketing_assets(id);
    ALTER TABLE posts ADD COLUMN "publishStatus" text CHECK("publishStatus" IN ('queued','creating','processing','submitting','published','failed','uncertain'));
    ALTER TABLE posts ADD COLUMN "publishError" text;
    ALTER TABLE posts ADD COLUMN "publishedUrl" text;
    CREATE TABLE publication_jobs (
      id uuid PRIMARY KEY,"workspaceId" uuid NOT NULL,"projectId" uuid NOT NULL,"postId" uuid NOT NULL UNIQUE REFERENCES posts(id),
      "actorId" uuid NOT NULL REFERENCES operators(id),"connectionRevision" integer NOT NULL,snapshot jsonb NOT NULL,
      status text NOT NULL,"containerId" text,"remoteId" text,"updatedAt" timestamptz NOT NULL DEFAULT now(),"createdAt" timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY("workspaceId","projectId") REFERENCES projects("workspaceId",id)
    );
  `);
  }
  async down() {
    throw new Error("Use a reviewed migration to remove marketing data.");
  }
}
