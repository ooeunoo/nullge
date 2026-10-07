import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { Desk } from '@nullge/contracts';
import { Store, StoreError } from './store';

const seoulMonth = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 7);

/** Operator desk: tasks only the operator can do, dated moments, spend and the monthly cap. */
export class DeskStore {
  private store: Store;
  constructor(readonly db: DataSource) {
    this.store = new Store(db);
  }
  private async projectId(w: string, slug: string | null) {
    return slug ? (await this.store.project(w, slug)).id : null;
  }
  async desk(w: string, now = Date.now()): Promise<Desk> {
    const month = seoulMonth(now);
    const [tasks, spend, [gen], [budget]] = await Promise.all([
      this.db.query(
        `SELECT id,"projectId",title,detail,link,kind,to_char("dueOn",'YYYY-MM-DD') "dueOn",status,"createdAt","doneAt"
         FROM operator_tasks WHERE "workspaceId"=$1 AND (status='open' OR "doneAt">now()-interval '14 days')
         ORDER BY status, "dueOn" NULLS LAST, "createdAt"`,
        [w],
      ),
      this.db.query(
        `SELECT id,"projectId",to_char("spentOn",'YYYY-MM-DD') "spentOn",category,"amountKrw",note FROM marketing_spend
         WHERE "workspaceId"=$1 AND to_char("spentOn",'YYYY-MM')=$2 ORDER BY "spentOn" DESC, "createdAt" DESC`,
        [w, month],
      ),
      this.db.query(
        `SELECT coalesce(sum("estimatedUsd"),0)::float usd FROM generation_jobs
         WHERE "workspaceId"=$1 AND status<>'quoted' AND "confirmedAt" IS NOT NULL
         AND to_char("confirmedAt" AT TIME ZONE 'Asia/Seoul','YYYY-MM')=$2`,
        [w, month],
      ),
      this.db.query('SELECT "monthlyCapKrw" FROM marketing_budget WHERE "workspaceId"=$1', [w]),
    ]);
    return JSON.parse(
      JSON.stringify({
        tasks,
        month,
        spend,
        generationUsd: Math.round(Number(gen.usd) * 100) / 100,
        monthlyCapKrw: budget?.monthlyCapKrw ?? null,
      }),
    );
  }
  async addTask(
    w: string,
    actor: string,
    input: {
      title: string;
      detail: string;
      link: string | null;
      kind: 'todo' | 'deadline' | 'season';
      dueOn: string | null;
      projectSlug: string | null;
    },
  ) {
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO operator_tasks (id,"workspaceId","projectId",title,detail,link,kind,"dueOn","createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        w,
        await this.projectId(w, input.projectSlug),
        input.title,
        input.detail,
        input.link,
        input.kind,
        input.dueOn,
        actor,
      ],
    );
    return { id };
  }
  async setTask(w: string, id: string, action: 'done' | 'reopen' | 'delete') {
    const [row] =
      action === 'delete'
        ? await this.db.query(
            'WITH gone AS (DELETE FROM operator_tasks WHERE id=$1 AND "workspaceId"=$2 RETURNING id) SELECT * FROM gone',
            [id, w],
          )
        : await this.db.query(
            `WITH changed AS (UPDATE operator_tasks SET status=$3,"doneAt"=CASE WHEN $3='done' THEN now() ELSE NULL END
             WHERE id=$1 AND "workspaceId"=$2 RETURNING id) SELECT * FROM changed`,
            [id, w, action === 'done' ? 'done' : 'open'],
          );
    if (!row) throw new StoreError(404, '할 일을 찾을 수 없어요.');
    return { ok: true };
  }
  async addSpend(
    w: string,
    actor: string,
    input: { spentOn: string; category: string; amountKrw: number; note: string; projectSlug: string | null },
  ) {
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO marketing_spend (id,"workspaceId","projectId","spentOn",category,"amountKrw",note,"createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        id,
        w,
        await this.projectId(w, input.projectSlug),
        input.spentOn,
        input.category,
        input.amountKrw,
        input.note,
        actor,
      ],
    );
    return { id };
  }
  async deleteSpend(w: string, id: string) {
    const [row] = await this.db.query(
      'WITH gone AS (DELETE FROM marketing_spend WHERE id=$1 AND "workspaceId"=$2 RETURNING id) SELECT * FROM gone',
      [id, w],
    );
    if (!row) throw new StoreError(404, '비용 기록을 찾을 수 없어요.');
    return { ok: true };
  }
  async setBudget(w: string, monthlyCapKrw: number | null) {
    await this.db.query(
      `INSERT INTO marketing_budget ("workspaceId","monthlyCapKrw") VALUES ($1,$2)
       ON CONFLICT ("workspaceId") DO UPDATE SET "monthlyCapKrw"=$2,"updatedAt"=now()`,
      [w, monthlyCapKrw],
    );
    return { ok: true };
  }
}
