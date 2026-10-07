import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Operator desk: tasks only the operator can do, dated marketing moments, and monthly spend against a cap. */
export class OperatorDesk1791244800000 implements MigrationInterface {
  name = 'OperatorDesk1791244800000';
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE IF NOT EXISTS operator_tasks (
      id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL REFERENCES workspaces(id), "projectId" uuid REFERENCES projects(id),
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
      detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 1000),
      link text CHECK (link IS NULL OR (char_length(link) <= 500 AND link ~ '^https://')),
      kind text NOT NULL DEFAULT 'todo' CHECK (kind IN ('todo','deadline','season')),
      "dueOn" date, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
      "createdBy" uuid REFERENCES operators(id), "createdAt" timestamptz NOT NULL DEFAULT now(), "doneAt" timestamptz
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS marketing_spend (
      id uuid PRIMARY KEY, "workspaceId" uuid NOT NULL REFERENCES workspaces(id), "projectId" uuid REFERENCES projects(id),
      "spentOn" date NOT NULL,
      category text NOT NULL CHECK (category IN ('ads','creator','generation','tool','other')),
      "amountKrw" integer NOT NULL CHECK ("amountKrw" BETWEEN 0 AND 100000000),
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 200),
      "createdBy" uuid REFERENCES operators(id), "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS marketing_budget (
      "workspaceId" uuid PRIMARY KEY REFERENCES workspaces(id),
      "monthlyCapKrw" integer CHECK ("monthlyCapKrw" BETWEEN 0 AND 1000000000),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
  }
  async down() {
    throw new Error('Use a reviewed migration to remove the operator desk.');
  }
}
