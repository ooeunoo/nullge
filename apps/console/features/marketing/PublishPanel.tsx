'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CHANNEL_LABELS, type Post, type Project, type Connection } from '@nullge/contracts';
import { call, message } from './shared';

export function PublishPanel({
  project,
  post,
}: {
  project: Project;
  post: Post;
}) {
  const [connection, setConnection] = useState<Connection>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false);
  useEffect(() => {
    call<Connection[]>(`projects/${project.slug}/channels`)
      .then((rows) =>
        setConnection(rows.find((c) => c.channel === post.channel)),
      )
      .catch((e) => setError(message(e)));
  }, [project.slug, post.channel]);
  const states = {
    queued: "게시 대기",
    creating: "미디어 준비 중",
    processing: "SNS 처리 중",
    submitting: "게시 요청 중",
    published: "게시 완료",
    failed: "게시 중단",
    uncertain: "게시 여부를 SNS에서 직접 확인해 주세요",
  };
  return (
    <section className="panel review-panel publish-panel">
      <div className="section-title">
        <h3>내가 확인하고 게시</h3>
        <span>{CHANNEL_LABELS[post.channel]}</span>
      </div>
      {post.publishStatus ? (
        <>
          <p className="ready-label">{states[post.publishStatus]}</p>
          {post.publishError && <p role="alert">{post.publishError}</p>}
          {post.publishedUrl && (
            <a
              href={post.publishedUrl}
              target="_blank"
              rel="noreferrer"
              className="button"
            >
              게시물 열기
              <ArrowUpRight size={14} />
            </a>
          )}
          <p className="muted">
            게시 요청 이후에는 이 콘텐츠를 수정하거나 다시 게시하지 않아요.
            상태를 확인하려면 새로고침해 주세요.
          </p>
        </>
      ) : (
        <>
          <p>
            {connection?.connected
              ? `게시 계정: @${connection.username}`
              : "이 제품에 연결된 계정이 없어요."}
          </p>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {!connection?.connected ? (
            <a href={`/projects/${project.slug}/settings#channels`} className="button">
              채널 연결
            </a>
          ) : post.status !== "approved" ? (
            <p className="muted">
              본문과 미디어를 확인한 후 문구 검토를 완료해 주세요. 저장하지 않은
              변경은 게시되지 않아요.
            </p>
          ) : confirming ? (
            <div className="publish-confirm">
              <p>
                <strong>
                  {project.name} → {CHANNEL_LABELS[post.channel]} @
                  {connection.username}
                </strong>
              </p>
              <p className="preview-copy">{post.caption}</p>
              <p className="field-hint">
                현재 저장·승인된 문구와 미디어를 공개 게시합니다. SNS API
                이용료가 별도로 발생할 수 있어요.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await call(
                      `projects/${project.slug}/posts/${post.id}/publish`,
                      {
                        revision: post.revision,
                        connectionRevision: connection.revision,
                        confirmed: true,
                      },
                    );
                    location.reload();
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                이 계정에 지금 게시
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              className="button primary"
              onClick={() => setConfirming(true)}
            >
              게시 내용·계정 확인
            </button>
          )}
        </>
      )}
    </section>
  );
}
