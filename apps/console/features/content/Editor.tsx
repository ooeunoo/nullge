'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  CHANNEL_LABELS,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_VIDEO_BYTES,
  type Post,
  type PostInput,
  type Project,
} from '@nullge/contracts';
import { Badge } from '../../components/ui/Badge';
import { Mark } from '../../components/ui/Mark';
import { capturePoster } from './capture-poster';
import { type Mutate } from './types';
import { api, projectPath, settingsPath } from '../../lib/api';
import { TemplatePanel } from './TemplatePanel';

export function Editor({
  project,
  post,
  busy,
  dirty,
  setDirty,
  mutate,
  notify,
}: {
  project: Project;
  post?: Post;
  busy: boolean;
  dirty: boolean;
  setDirty: (v: boolean) => void;
  mutate: Mutate;
  notify: (v: string) => void;
}) {
  const [form, setForm] = useState<PostInput>({
    title: post?.title || '',
    caption: post?.caption || '',
    brief: post?.brief || '',
    channel: post?.channel || 'x',
    language: post?.language || 'ko',
  });
  const [imageName, setImageName] = useState(''),
    [imageError, setImageError] = useState(''),
    [reading, setReading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false),
    [deleting, setDeleting] = useState(false);
  const reader = useRef<FileReader | null>(null),
    imageInput = useRef<HTMLInputElement | null>(null);
  useEffect(
    () => () => {
      if (reader.current) {
        reader.current.onload = null;
        reader.current.onerror = null;
        reader.current.abort();
      }
    },
    [],
  );
  function chooseImage(file?: File) {
    if (!file) return;
    setImageError('');
    const video = file.type === 'video/mp4';
    if (
      !['image/png', 'image/jpeg', 'video/mp4'].includes(file.type) ||
      file.size > (video ? MAX_POST_VIDEO_BYTES : MAX_POST_IMAGE_BYTES) ||
      !file.size
    ) {
      setImageError('5 MB 이하의 PNG·JPEG 이미지 또는 15 MB 이하의 MP4 영상을 선택해 주세요.');
      if (imageInput.current) imageInput.current.value = '';
      return;
    }
    setReading(true);
    setDirty(true);
    const next = new FileReader();
    reader.current = next;
    next.onload = () => {
      const data = String(next.result);
      if (video) {
        void capturePoster(data).then((poster) => {
          setForm((p) => ({ ...p, image: data, ...(poster ? { poster } : {}) }));
          setImageName(file.name);
          setReading(false);
        });
      } else {
        setForm((p) => {
          const { poster: _, ...rest } = p;
          return { ...rest, image: data };
        });
        setImageName(file.name);
        setReading(false);
      }
    };
    next.onerror = () => {
      setImageError('이미지를 읽지 못했어요. 다시 선택해 주세요.');
      setReading(false);
    };
    next.readAsDataURL(file);
  }
  const update = (key: keyof PostInput, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || reading) return;
    try {
      const result = await mutate<Post>(
        `projects/${project.slug}/posts${post ? `/${post.id}` : ''}`,
        { ...form, ...(post ? { revision: post.revision } : {}) },
        post ? 'PATCH' : 'POST',
      );
      if (!post) window.location.assign(`${projectPath(project)}/${result.id}`);
    } catch {}
  }
  const [externalUrl, setExternalUrl] = useState('');
  async function action(action: string) {
    if (!post) return;
    try {
      await mutate(`projects/${project.slug}/posts/${post.id}/${action}`, { revision: post.revision });
    } catch {}
  }
  async function remove() {
    if (!post || deleting) return;
    setDeleting(true);
    try {
      await api(`projects/${project.slug}/posts/${post.id}/delete`, { revision: post.revision });
      setDirty(false);
      window.location.assign(projectPath(project));
    } catch (e) {
      notify(e instanceof Error ? e.message : '삭제하지 못했어요.');
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }
  return (
    <>
      <a className="back-link" href={projectPath(project)}>
        <ArrowLeft size={15} />
        콘텐츠 목록
      </a>
      <div className="editor-grid">
        <form className="panel editor-form" onSubmit={save}>
          <div className="section-title">
            <h2>{post ? '콘텐츠 편집' : '새 콘텐츠'}</h2>
            {post ? <Badge status={post.status} /> : <span className="muted">아직 저장되지 않았어요</span>}
          </div>
          <fieldset className="editor-fields" disabled={busy || reading}>
            <label>
              제목
              <input
                autoFocus={!post}
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="이 콘텐츠를 알아볼 수 있는 제목"
              />
            </label>
            <div className="field-pair">
              <label>
                채널
                <select value={form.channel} onChange={(e) => update('channel', e.target.value)}>
                  {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                언어
                <select value={form.language} onChange={(e) => update('language', e.target.value)}>
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <label>
              이야기할 내용<span className="field-hint">소개할 기능이나 전달할 메시지</span>
              <input
                value={form.brief}
                maxLength={1200}
                onChange={(e) => update('brief', e.target.value)}
                placeholder="예: 짧은 통화로 하루의 이야기를 꺼내기"
              />
            </label>
            <label>
              게시 문구
              <textarea
                rows={10}
                maxLength={5000}
                value={form.caption}
                onChange={(e) => update('caption', e.target.value)}
                placeholder="독자에게 전하고 싶은 이야기를 작성해 주세요."
              />
            </label>
            <div className="caption-tools">
              <span>{Array.from(form.caption).length}자</span>
              <button
                type="button"
                className="text-button"
                disabled={!form.caption}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(form.caption)
                    .then(() => notify('문구를 복사했어요.'))
                    .catch(() => notify('복사하지 못했어요. 본문을 선택해 복사해 주세요.'));
                }}
              >
                <Copy size={14} />
                문구 복사
              </button>
            </div>
            <label>
              {post?.assetId ? '미디어 교체' : '미디어 첨부'}
              <span className="field-hint">
                PNG · JPEG 최대 5 MB / MP4 최대 15 MB (영상 게시는 Instagram만)
              </span>
              <input
                ref={imageInput}
                type="file"
                accept="image/png,image/jpeg,video/mp4"
                onChange={(e) => chooseImage(e.target.files?.[0])}
              />
            </label>
            {(form.image?.startsWith('data:video/') || (!form.image && post?.format === 'video')) && (
              <label>
                썸네일 이미지
                <span className="field-hint">
                  선택 · PNG·JPEG 최대 1 MB · 피드와 미리보기의 첫 화면으로 쓰여요
                  {form.poster ? ' · 선택됨' : post?.posterAssetId ? ' · 등록됨' : ''}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!['image/png', 'image/jpeg'].includes(f.type) || f.size > 1024 * 1024) {
                      setImageError('1 MB 이하의 PNG 또는 JPEG 썸네일을 선택해 주세요.');
                      return;
                    }
                    const fr = new FileReader();
                    fr.onload = () => {
                      setForm((p) => ({ ...p, poster: String(fr.result) }));
                      setDirty(true);
                    };
                    fr.readAsDataURL(f);
                  }}
                />
              </label>
            )}
            {form.image && (
              <div className="upload-selection">
                <span>{imageName}</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setForm(({ image, poster, ...rest }) => rest);
                    setImageName('');
                    if (imageInput.current) imageInput.current.value = '';
                  }}
                >
                  선택 취소
                </button>
              </div>
            )}
          </fieldset>
          {imageError && (
            <p className="error" role="alert">
              {imageError}
            </p>
          )}
          <div className="editor-actions">
            <span className="muted">
              {reading
                ? '이미지를 읽는 중…'
                : dirty
                  ? '저장하지 않은 변경이 있어요.'
                  : post
                    ? '모든 변경사항이 저장됐어요.'
                    : '초안으로 저장돼요.'}
            </span>
            <button className="button primary" type="submit" disabled={busy || reading || (!dirty && !!post)}>
              {busy ? '저장 중…' : '초안 저장'}
            </button>
          </div>
        </form>
        <aside className="editor-aside">
          <section className={`panel preview-panel post-preview ${form.channel}`}>
            <div className="preview-head">
              <p className="eyebrow">PREVIEW · {CHANNEL_LABELS[form.channel]}</p>
              {post?.assetId && !form.image && (
                <a
                  className="text-button"
                  href={`/api/assets/${post.assetId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  원본 열기
                  <ArrowUpRight size={13} />
                </a>
              )}
            </div>
            <div className="phone-post">
              <div className="phone-post-head">
                <Mark project={project} />
                <div>
                  <strong>{project.name}</strong>
                  <span>
                    {form.channel === 'instagram'
                      ? 'Instagram · 피드'
                      : form.channel === 'threads'
                        ? 'Threads'
                        : 'X'}
                  </span>
                </div>
              </div>
              {form.image?.startsWith('data:video/') ? (
                <video
                  className="phone-post-media"
                  controls
                  preload="metadata"
                  poster={form.poster}
                  src={form.image}
                />
              ) : form.image || (post?.format === 'image' && post.assetId) ? (
                <img
                  className="phone-post-media"
                  src={form.image || `/api/assets/${post!.assetId}`}
                  alt="첨부 이미지 미리보기"
                />
              ) : post?.format === 'video' && post.assetId ? (
                <video
                  className="phone-post-media"
                  controls
                  preload="metadata"
                  poster={post.posterAssetId ? `/api/assets/${post.posterAssetId}?w=720` : undefined}
                  src={`/api/assets/${post.assetId}`}
                />
              ) : form.channel === 'instagram' ? (
                <div className="phone-post-media placeholder">
                  <FileText size={22} />
                  <span>Instagram 발행에는 이미지나 영상이 필요해요.</span>
                </div>
              ) : null}
              <p className={`phone-post-caption ${!form.caption ? 'muted' : ''}`}>
                {form.channel === 'instagram' && form.caption && (
                  <strong>{project.name.toLowerCase()} </strong>
                )}
                {form.caption || '작성한 문구가 여기에 표시돼요.'}
              </p>
            </div>
            {(form.image?.startsWith('data:video/') || (!form.image && post?.format === 'video')) &&
              form.channel !== 'instagram' && (
                <div className="preview-media">
                  <FileText size={22} />
                  <span>
                    영상 직접 게시는 Instagram만 지원해요. 다른 채널은 원본을 내려받아 게시해 주세요.
                  </span>
                </div>
              )}
          </section>
          <section className="panel review-panel">
            <div className="section-title">
              <h3>승인</h3>
              <ShieldCheck size={18} />
            </div>
            <p>
              {project.profileReviewedAt
                ? '제품 정보가 확인되어 있어요. 이미지와 문구를 보고 승인하면 바로 게시할 수 있어요.'
                : '브랜드 설정의 기능과 설명을 먼저 확인해 주세요.'}
            </p>
            <a className="text-button" href={settingsPath(project, 'brand')}>
              브랜드 설정 확인
              <ArrowUpRight size={14} />
            </a>
            <div className="review-actions">
              {!post ? (
                <p className="muted">초안을 저장하면 승인할 수 있어요.</p>
              ) : post.status === 'draft' ? (
                <button
                  className="button primary"
                  disabled={busy || reading || dirty || !form.caption.trim() || !project.profileReviewedAt}
                  onClick={() => void action('approve')}
                >
                  <Check size={16} />
                  승인
                </button>
              ) : (
                <>
                  <p className="ready-label">
                    <Check size={15} />
                    승인된 콘텐츠예요.
                  </p>
                  <button
                    className="button"
                    disabled={busy || reading || dirty}
                    onClick={() => void action('reopen')}
                  >
                    초안으로 되돌리기
                  </button>
                </>
              )}
            </div>
          </section>
          {post && (!post.publishStatus || post.publishStatus === 'failed') && (
            <details className="panel external-panel">
              <summary>다른 곳에서 직접 게시했다면</summary>
              <p className="muted">
                앱이나 웹에서 직접 올린 게시물의 주소를 남기면 게시됨으로 잠기고, 피드에서 게시물을 바로 열 수
                있어요.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(`projects/${project.slug}/posts/${post.id}/published`, {
                    revision: post.revision,
                    url: externalUrl.trim(),
                  }).catch(() => {});
                }}
              >
                <input
                  type="url"
                  required
                  placeholder="https://www.instagram.com/p/…"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
                <button type="submit" className="button small" disabled={busy || !externalUrl.trim()}>
                  게시됨으로 기록
                </button>
              </form>
            </details>
          )}
          {post && !post.publishStatus && post.format !== 'video' && !dirty && (
            <TemplatePanel project={project} post={post} busy={busy} mutate={mutate} />
          )}
          <div className="publishing-note">
            <SlidersHorizontal size={17} />
            <p>
              문구와 미디어를 검토한 후 아래에서 게시할 계정을 확인해 주세요. 자동·예약 게시는 실행하지
              않아요.
            </p>
          </div>
          {post && !post.publishStatus && (
            <section className="panel danger-panel" aria-label="콘텐츠 삭제">
              {confirmingDelete ? (
                <>
                  <p>
                    <strong>{post.title}</strong>을(를) 삭제할까요? 첨부한 이미지도 함께 지워지고 되돌릴 수
                    없어요.
                  </p>
                  <div className="danger-actions">
                    <button
                      type="button"
                      className="button danger"
                      disabled={deleting}
                      onClick={() => void remove()}
                    >
                      <Trash2 size={15} />
                      {deleting ? '삭제 중…' : '삭제 확정'}
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="muted">
                    게시 요청 전의 콘텐츠만 삭제할 수 있어요. 삭제 기록은 최근 작업에 남아요.
                  </p>
                  <button
                    type="button"
                    className="text-button danger-text"
                    disabled={busy || reading}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 size={14} />이 콘텐츠 삭제
                  </button>
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
