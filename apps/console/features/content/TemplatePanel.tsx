'use client';
import { useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import type { Post, Project } from '@nullge/contracts';
import { settingsPath } from '../../lib/api';
import { type Mutate } from './types';

/** Applies the product's template to a draft. Works the same for every product; the guide supplies the look. */
export function TemplatePanel({
  project,
  post,
  busy,
  mutate,
}: {
  project: Project;
  post: Post;
  busy: boolean;
  mutate: Mutate;
}) {
  const hasPhoto = post.format === 'image';
  const [kind, setKind] = useState<'photo-headline' | 'color-card'>(
    hasPhoto && project.guide.visual.template !== 'color-card' ? 'photo-headline' : 'color-card',
  );
  const [first, setFirst] = useState(''),
    [second, setSecond] = useState(''),
    [subline, setSubline] = useState('');
  const headline = [first, second].map((l) => l.trim()).filter(Boolean);
  return (
    <details className="panel template-panel">
      <summary>
        <LayoutTemplate size={16} />
        템플릿으로 디자인
      </summary>
      <p className="muted">
        제품 가이드의 색·로고·하단 문구로 1080×1350 이미지를 만들어요. 다시 적용하면 같은 사진 위에 새로
        그려요.{' '}
        <a className="text-button" href={settingsPath(project, 'brand')}>
          가이드 설정
        </a>
      </p>
      <div className="segmented">
        <button
          type="button"
          className={kind === 'photo-headline' ? 'selected' : ''}
          disabled={!hasPhoto}
          onClick={() => setKind('photo-headline')}
        >
          사진 + 헤드라인
        </button>
        <button
          type="button"
          className={kind === 'color-card' ? 'selected' : ''}
          onClick={() => setKind('color-card')}
        >
          색 배경 카드
        </button>
      </div>
      <label>
        헤드라인 첫 줄
        <input maxLength={24} value={first} onChange={(e) => setFirst(e.target.value)} />
      </label>
      <label>
        헤드라인 둘째 줄 <span className="field-hint">강조색 · 선택</span>
        <input maxLength={24} value={second} onChange={(e) => setSecond(e.target.value)} />
      </label>
      <label>
        보조 문장 <span className="field-hint">선택</span>
        <input maxLength={60} value={subline} onChange={(e) => setSubline(e.target.value)} />
      </label>
      <button
        type="button"
        className="button"
        disabled={busy || !headline.length}
        onClick={() =>
          void mutate(`projects/${project.slug}/templates/${post.id}`, {
            revision: post.revision,
            kind,
            headline,
            subline: subline.trim(),
          }).catch(() => {})
        }
      >
        템플릿 적용
      </button>
    </details>
  );
}
