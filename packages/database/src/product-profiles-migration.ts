import { randomUUID } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { WORKSPACE_ID } from './migration';
import { legacyInitialProducts } from './seed';
import { productCatalog20260925 } from './product-catalog-20260925';

/** Only enrich untouched bootstrap profiles. All prior snapshots and user data survive. */
export class ProductProfiles1790352000000 implements MigrationInterface {
  name = 'ProductProfiles1790352000000';
  async up(q: QueryRunner) {
    for (const old of legacyInitialProducts) {
      const [current] = await q.query(
        'SELECT * FROM projects WHERE "workspaceId"=$1 AND slug=$2 FOR UPDATE',
        [WORKSPACE_ID, old.slug],
      );
      if (!current || current.revision !== 1 || current.profileReviewedAt !== null) continue;
      if (!Object.entries(old).every(([key, value]) => current[key] === value)) continue;
      // Even untouched profiles with existing content are left alone for manual review.
      const [used] = await q.query('SELECT 1 FROM posts WHERE "workspaceId"=$1 AND "projectId"=$2 LIMIT 1', [
        WORKSPACE_ID,
        current.id,
      ]);
      if (used) continue;
      const p = productCatalog20260925.find((p) => p.slug === old.slug)!;
      const [next] = await q.query(
        `WITH changed AS (UPDATE projects SET color=$2,description=$3,audience=$4,facts=$5,tone=$6,avoid=$7,website=$8,revision=revision+1 WHERE id=$1 RETURNING *) SELECT * FROM changed`,
        [current.id, p.color, p.description, p.audience, p.facts, p.tone, p.avoid, p.website],
      );
      await q.query(
        'INSERT INTO profile_versions ("workspaceId","projectId",revision,snapshot) VALUES ($1,$2,$3,$4)',
        [WORKSPACE_ID, current.id, next.revision, JSON.stringify(next)],
      );
      await q.query(
        'INSERT INTO events (id,"workspaceId","projectId",action,title) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), WORKSPACE_ID, current.id, 'profile_imported', p.name],
      );
    }
  }
  async down() {
    throw new Error(
      'Profile history is retained. Restore a selected snapshot with a reviewed forward migration.',
    );
  }
}
