import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { ChannelTest } from '@nullge/contracts';
import { Store, StoreError } from './store';

type Fields = Partial<Omit<ChannelTest, 'id'>>;
const COLUMNS = `id,name,status,to_char("startedOn",'YYYY-MM-DD') "startedOn",to_char("endsOn",'YYYY-MM-DD') "endsOn",goal,result`;

/** Bullseye channel board: try a few channels cheaply, keep one, stop the rest. */
export class ChannelBoardStore {
  private store: Store;
  constructor(readonly db: DataSource) {
    this.store = new Store(db);
  }
  async list(w: string, slug: string): Promise<ChannelTest[]> {
    const p = await this.store.project(w, slug);
    return this.db.query(
      `SELECT ${COLUMNS} FROM channel_tests WHERE "workspaceId"=$1 AND "projectId"=$2
       ORDER BY array_position(ARRAY['keep','testing','idea','stopped'], status), "createdAt"`,
      [w, p.id],
    );
  }
  async create(w: string, slug: string, input: Required<Fields>) {
    const p = await this.store.project(w, slug);
    const [{ n }] = await this.db.query(
      'SELECT count(*)::int n FROM channel_tests WHERE "workspaceId"=$1 AND "projectId"=$2',
      [w, p.id],
    );
    if (n >= 20) throw new StoreError(400, '채널은 제품마다 20개까지 적을 수 있어요.');
    this.checkWindow(input.startedOn, input.endsOn);
    const id = randomUUID();
    await this.db.query(
      'INSERT INTO channel_tests (id,"workspaceId","projectId",name,status,"startedOn","endsOn",goal,result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, w, p.id, input.name, input.status, input.startedOn, input.endsOn, input.goal, input.result],
    );
    return { id };
  }
  async update(w: string, slug: string, id: string, input: Fields) {
    const p = await this.store.project(w, slug);
    const [current] = await this.db.query(
      `SELECT ${COLUMNS} FROM channel_tests WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3`,
      [id, w, p.id],
    );
    if (!current) throw new StoreError(404, '채널을 찾을 수 없어요.');
    const next = { ...current, ...input };
    this.checkWindow(next.startedOn, next.endsOn);
    await this.db.query(
      `UPDATE channel_tests SET name=$4,status=$5,"startedOn"=$6,"endsOn"=$7,goal=$8,result=$9,"updatedAt"=now()
       WHERE id=$1 AND "workspaceId"=$2 AND "projectId"=$3`,
      [id, w, p.id, next.name, next.status, next.startedOn, next.endsOn, next.goal, next.result],
    );
    return { ok: true };
  }
  private checkWindow(start?: string | null, end?: string | null) {
    if (start && end && end < start) throw new StoreError(400, '끝나는 날이 시작한 날보다 빨라요.');
  }
}
