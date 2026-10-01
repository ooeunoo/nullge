import { randomUUID } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { WORKSPACE_ID } from './migration';
import { productCatalog20260925 } from './product-catalog-20260925';
import { minimoDesktopPet as p } from './minimo-desktop-pet';

export class MinimoRepositoryCorrection1790352300000 implements MigrationInterface {
  name = 'MinimoRepositoryCorrection1790352300000';
  async up(q: QueryRunner) {
    const [current] = await q.query('SELECT * FROM projects WHERE "workspaceId"=$1 AND slug=$2 FOR UPDATE', [
      WORKSPACE_ID,
      'minimo',
    ]);
    if (!current || current.profileReviewedAt !== null || ![1, 2].includes(current.revision)) return;
    const previous = productCatalog20260925.find((p) => p.slug === 'minimo')!;
    if (!Object.entries(previous).every(([key, value]) => current[key] === value)) return;
    const [used] = await q.query('SELECT 1 FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 LIMIT 1', [
      WORKSPACE_ID,
      current.id,
    ]);
    if (used) return;
    const [next] = await q.query(
      `WITH changed AS (UPDATE projects SET color=$2,description=$3,audience=$4,facts=$5,tone=$6,avoid=$7,website=$8,revision=revision+1 WHERE id=$1 RETURNING *) SELECT * FROM changed`,
      [current.id, p.color, p.description, p.audience, p.facts, p.tone, p.avoid, p.website],
    );
    await q.query(
      'INSERT INTO profile_versions ("workspaceId","projectId",revision,snapshot) VALUES ($1,$2,$3,$4)',
      [WORKSPACE_ID, current.id, next.revision, JSON.stringify(next)],
    );
    await q.query('INSERT INTO events (id,"workspaceId","projectId",action,title) VALUES ($1,$2,$3,$4,$5)', [
      randomUUID(),
      WORKSPACE_ID,
      current.id,
      'profile_corrected',
      'minimo · desktop_pet 기준으로 정정',
    ]);
  }
  async down() {
    throw new Error('Use a reviewed forward migration; do not restore the wrong product identity.');
  }
}
