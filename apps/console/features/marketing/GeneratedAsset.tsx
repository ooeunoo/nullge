'use client';
import { type Post } from '@nullge/contracts';

export function GeneratedAsset({ post }: { post: Post }) {
  if (!post.assetId) return null;
  return (
    <section className="panel generated-asset">
      <div className="section-title">
        <h2>완성된 {post.format === 'video' ? '영상' : '이미지'}</h2>
        <a className="button" href={`/api/assets/${post.assetId}`} target="_blank" rel="noreferrer">
          원본 열기
        </a>
      </div>
      {post.format === 'video' ? (
        <video controls preload="metadata" src={`/api/assets/${post.assetId}`} />
      ) : (
        <img src={`/api/assets/${post.assetId}`} alt={post.title} />
      )}
      <p className="muted">이미지·문구가 브랜드에 맞는지 확인해 주세요.</p>
    </section>
  );
}
