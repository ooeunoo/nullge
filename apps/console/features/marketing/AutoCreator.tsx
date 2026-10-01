'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import {
  CHANNEL_LABELS,
  type Project,
  type Channel,
  type ContentFormat,
  type GenerationJob,
  type GenerationQuote,
} from '@nullge/contracts';
import { call, jobLabels, message, money } from './shared';

export function AutoCreator({ project, manual }: { project: Project; manual: React.ReactNode }) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto'),
    [prompt, setPrompt] = useState(''),
    [format, setFormat] = useState<ContentFormat>('text'),
    [channel, setChannel] = useState<Channel | 'auto'>('auto'),
    [language, setLanguage] = useState('ko'),
    [reference, setReference] = useState<string>(),
    [referenceName, setReferenceName] = useState(''),
    [referenceLoading, setReferenceLoading] = useState(false),
    [quote, setQuote] = useState<GenerationQuote | null>(null),
    [estimating, setEstimating] = useState(true),
    [quoteError, setQuoteError] = useState(''),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [jobId, setJobId] = useState<string>(),
    [job, setJob] = useState<GenerationJob>(),
    [error, setError] = useState('');
  const path = `projects/${project.slug}/generations`;
  const editVersion = useRef(0),
    submitting = useRef(false),
    referenceVersion = useRef(0);
  const locked = busy || !!jobId;
  const inputKey = JSON.stringify({
    prompt,
    format,
    language,
    ...(channel === 'auto' ? {} : { channel }),
    ...(reference ? { reference } : {}),
  });
  function change() {
    editVersion.current++;
    setQuote(null);
    setQuoteError('');
    setError('');
    setEstimating(true);
  }
  useEffect(() => {
    if (mode !== 'auto' || jobId || referenceLoading) return;
    let active = true;
    const version = editVersion.current;
    setQuote(null);
    setEstimating(true);
    setQuoteError('');
    const timer = setTimeout(() => {
      void call<GenerationQuote>(`${path}/quote`, JSON.parse(inputKey))
        .then((next) => {
          if (active && version === editVersion.current) setQuote(next);
        })
        .catch((e) => {
          if (active && version === editVersion.current) setQuoteError(message(e));
        })
        .finally(() => {
          if (active && version === editVersion.current) setEstimating(false);
        });
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inputKey, path, mode, refresh, jobId, referenceLoading]);
  useEffect(() => {
    if (!quote || locked) return;
    const timer = setTimeout(
      () => {
        change();
        setRefresh((n) => n + 1);
      },
      Math.max(1000, Date.parse(quote.expiresAt) - Date.now() - 5000),
    );
    return () => clearTimeout(timer);
  }, [quote, locked]);
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const jobs = await call<GenerationJob[]>(path);
        if (!active) return;
        const current = jobs.find((item) => item.id === jobId);
        if (current) {
          setJob(current);
          setError('');
          if (current.status === 'completed' && current.postId) {
            location.assign(`/projects/${project.slug}/marketing/${current.postId}`);
            return;
          }
          if (['failed', 'uncertain'].includes(current.status)) return;
        }
      } catch (e) {
        if (active) setError(message(e));
      }
      if (active) timer = setTimeout(() => void load(), 3000);
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, path, project.slug]);
  async function generate() {
    if (!quote || submitting.current || locked || referenceLoading) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) {
      change();
      setRefresh((n) => n + 1);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const created = await call<{ id: string }>(`${path}/confirm`, { quoteId: quote.id, confirmed: true });
      setJobId(created.id);
    } catch (e) {
      setError(message(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="creator-mode">
        <a className="back-link" href={`/projects/${project.slug}/marketing`}>
          콘텐츠 목록
        </a>
        <button
          className="text-button"
          disabled={locked}
          onClick={() => setMode(mode === 'auto' ? 'manual' : 'auto')}
        >
          {mode === 'auto' ? '직접 작성' : '자동으로 만들기'}
        </button>
      </div>
      {mode === 'manual' ? (
        manual
      ) : (
        <div className="creator-grid">
          <form
            className="panel editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <p className="eyebrow">CREATE FOR {project.name.toUpperCase()}</p>
            <h2>무엇을 만들까요?</h2>
            <p className="muted">타입만 골라 주세요. {project.name}에 맞는 소재부터 완성까지 준비할게요.</p>
            <fieldset className="format-options" disabled={locked}>
              <legend>1. 콘텐츠 타입</legend>
              {(
                [
                  ['text', '글', '바로 쓸 수 있는 문구'],
                  ['image', '이미지', '이미지 1장 + 문구'],
                  ['video', '영상', '5초 세로 영상 + 문구'],
                ] as const
              ).map(([value, label, description]) => (
                <label className={format === value ? 'selected' : ''} key={value}>
                  <input
                    type="radio"
                    name="format"
                    value={value}
                    checked={format === value}
                    onChange={() => {
                      setFormat(value);
                      if (value === 'text' && channel === 'instagram') setChannel('auto');
                      change();
                    }}
                  />
                  <strong>{label}</strong>
                  <span>{description}</span>
                </label>
              ))}
            </fieldset>
            <label>
              2. 프롬프트 <span className="field-hint">선택 · 비워두면 소재도 알아서 골라요</span>
              <textarea
                maxLength={1200}
                rows={3}
                disabled={locked}
                placeholder="예: 오늘은 퇴근 후 가볍게 시작하는 느낌으로"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  change();
                }}
              />
            </label>
            <details className="creator-options">
              <summary>세부 설정 · 채널 형식, 언어, 참고 이미지</summary>
              <div className="field-pair">
                <label>
                  채널 형식
                  <select
                    disabled={locked}
                    value={channel}
                    onChange={(e) => {
                      setChannel(e.target.value as Channel | 'auto');
                      change();
                    }}
                  >
                    <option value="auto">자동 · {format === 'text' ? 'Threads' : 'Instagram'}</option>
                    {Object.entries(CHANNEL_LABELS)
                      .filter(([key]) => !(format === 'text' && key === 'instagram'))
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  언어
                  <select
                    disabled={locked}
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      change();
                    }}
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <label>
                참고 이미지 <span className="field-hint">선택 · JPEG/PNG 2 MB 이하 · 분위기 참고용</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={locked}
                  onChange={(e) => {
                    const version = ++referenceVersion.current;
                    change();
                    setReference(undefined);
                    setReferenceName('');
                    setReferenceLoading(false);
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2 * 1024 * 1024) {
                      setError('2 MB 이하 JPEG 또는 PNG를 선택해 주세요.');
                      e.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    setReferenceLoading(true);
                    reader.onload = () => {
                      if (referenceVersion.current === version) {
                        change();
                        setReference(String(reader.result));
                        setReferenceName(file.name);
                        setReferenceLoading(false);
                      }
                    };
                    reader.onerror = () => {
                      if (referenceVersion.current === version) {
                        setError('이미지를 읽지 못했어요.');
                        setReferenceLoading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {reference && (
                <div className="reference-preview">
                  <img src={reference} alt="참고 이미지" />
                  <span>{referenceName}</span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={locked}
                    onClick={() => {
                      referenceVersion.current++;
                      setReference(undefined);
                      setReferenceName('');
                      change();
                    }}
                  >
                    제거
                  </button>
                </div>
              )}
            </details>
            {jobId ? (
              <section className="generation-progress" aria-live="polite">
                <Sparkles size={22} />
                <h3>{job ? jobLabels[job.status] : '생성을 준비하고 있어요'}</h3>
                <p>
                  {job?.error || '제품 정보와 최근 콘텐츠를 살펴보고 있어요. 완성되면 결과를 열어드릴게요.'}
                </p>
                <a className="button" href={`/projects/${project.slug}/marketing`}>
                  콘텐츠 목록에서 확인
                </a>
              </section>
            ) : (
              <div className="creator-submit">
                <div aria-live="polite">
                  {estimating ? (
                    <p className="muted">예상 비용 확인 중…</p>
                  ) : quoteError ? (
                    <p className="notice error" role="alert">
                      {quoteError} <a href="/settings">공통 설정 확인</a>
                    </p>
                  ) : (
                    quote && (
                      <>
                        <p className="cost-total">
                          이번 생성 예상 비용 <strong>{money(quote.totalUsd)}</strong>
                        </p>
                        <details className="cost-details">
                          <summary>비용 상세</summary>
                          {quote.lines.map((line, i) => (
                            <p className="cost-line" key={i}>
                              <span>{line.label}</span>
                              <strong>{money(line.usd)}</strong>
                            </p>
                          ))}
                          <p className="field-hint">
                            이력 입력 여유분을 포함한 예상치예요. 실제 청구액은 달라질 수 있고, 실패한
                            요청에도 비용이 발생할 수 있어요.
                          </p>
                        </details>
                      </>
                    )
                  )}
                </div>
                <button
                  className="button primary generate-button"
                  disabled={locked || estimating || referenceLoading || !quote}
                >
                  <Sparkles size={17} />
                  {busy ? '생성 요청 중…' : '콘텐츠 생성'}
                </button>
                <p className="field-hint">
                  버튼을 누르면 표시된 예상 비용으로 생성해요. 완성한 콘텐츠는 검토 대기에 저장돼요.
                </p>
                {(quoteError || error) && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      change();
                      setRefresh((n) => n + 1);
                    }}
                  >
                    예상 비용 다시 확인
                  </button>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
          </form>
          <aside>
            <section className="panel review-panel creator-context">
              <span className="project-dot" style={{ background: project.color }} />
              <p className="eyebrow">{project.name}</p>
              <h3>이 제품을 알고 만들어요</h3>
              <p>{project.description || '브랜드 설정에 등록된 정보를 참고해요.'}</p>
              <ul className="workflow-list">
                <li>제품의 기능·대상·말투 반영</li>
                <li>최근 게시물과 생성 이력 참고</li>
                <li>겹치는 소재·문구·장면 비교</li>
                <li>완성 후 검토 대기에 저장</li>
              </ul>
              <p className="field-hint">
                이 콘솔에 저장된 제품별 이력을 참고해요. 최종 내용과 중복 여부를 검토한 뒤 게시할 수 있어요.
              </p>
              <a className="text-button" href={`/projects/${project.slug}/settings#brand`}>
                브랜드 설정 확인
                <ArrowUpRight size={14} />
              </a>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
