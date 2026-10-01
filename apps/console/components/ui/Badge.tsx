'use client';
import { STATUS_LABELS, type Post } from '@nullge/contracts';

export function Badge({ status }: { status: Post['status'] }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status]}</span>;
}
