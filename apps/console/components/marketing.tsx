"use client";
import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, Check, ChevronDown, Settings, Sparkles } from "lucide-react";
import {
  CHANNEL_LABELS,
  type Channel,
  type BufferChannel,
  type Connection,
  type ContentFormat,
  type GenerationJob,
  type GenerationQuote,
  type IntegrationInput,
  type Integrations,
  type Post,
  type Project,
  type SecretField,
} from "@nullge/contracts";
async function call<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : method,
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "요청을 완료하지 못했어요.");
  return data;
}
const message = (e: unknown) =>
  e instanceof Error ? e.message : "요청을 완료하지 못했어요.";
const secretLabels: Record<SecretField, string> = {
  openaiKey: "OpenAI API Key",
  higgsfieldKey: "Higgsfield Key ID",
  higgsfieldSecret: "Higgsfield Key Secret",
  bufferApiKey: "Buffer API Key",
  xClientId: "X OAuth Client ID",
  xClientSecret: "X OAuth Client Secret",
  instagramClientId: "Instagram App ID",
  instagramClientSecret: "Instagram App Secret",
  threadsClientId: "Threads App ID",
  threadsClientSecret: "Threads App Secret",
};
const money = (v: number) => `US$ ${v.toFixed(4)}`;
export function SharedSettings() {
  const [data, setData] = useState<Integrations | null>(null),
    [form, setForm] = useState<IntegrationInput | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = (d: Integrations) => {
    setData(d);
    setForm({
      revision: d.revision,
      openaiModel: d.openaiModel,
      openaiInputUsd: d.openaiInputUsd,
      openaiOutputUsd: d.openaiOutputUsd,
      imageUsd: d.imageUsd,
      videoUsd: d.videoUsd,
      secrets: {},
      clear: [],
    });
  };
  useEffect(() => {
    call<Integrations>("settings/integrations").then(load).catch(e => setError(message(e)));
    if (new URLSearchParams(location.search).has("connection_error"))
      setError("SNS 연결에 실패했습니다. 설정을 확인해 주세요.");
  }, []);
  async function save() {
    if (!form || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      load(await call<Integrations>("settings/integrations", form, "PATCH"));
      setNotice("저장했습니다.");
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setError(""); setNotice("");
    try {
      await call("settings/integrations/verify", {});
      setNotice("OpenAI 연결을 확인했습니다.");
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  function keyField(key: SecretField) {
    if (!form || !data) return null;
    const removing = form.clear.includes(key);
    return <div className="integration-field" key={key}>
      <div className="integration-label">
        <label htmlFor={`integration-${key}`}>{secretLabels[key]}</label>
        {data.configured[key] && <button
          type="button" className={`text-button key-remove ${removing ? "pending" : ""}`}
          aria-label={`${secretLabels[key]} ${removing ? "삭제 취소" : "삭제"}`}
          aria-pressed={removing} disabled={busy}
          onClick={() => {
            const secrets = { ...form.secrets };
            delete secrets[key];
            setForm({ ...form, secrets, clear: removing ? form.clear.filter(k => k !== key) : [...form.clear, key] });
            setNotice("");
          }}
        >{removing ? "삭제 취소" : "삭제"}</button>}
      </div>
      <input id={`integration-${key}`} type="password" autoComplete="new-password" maxLength={4096}
        value={form.secrets[key] || ""} disabled={busy || removing}
        placeholder={removing ? "삭제 예정" : data.configured[key] ? "****" : "키 입력"}
        onChange={e => {
          const secrets = { ...form.secrets };
          if (e.target.value) secrets[key] = e.target.value;
          else delete secrets[key];
          setForm({ ...form, secrets }); setNotice("");
        }}/>
    </div>;
  }
  function status(keys: SecretField[]) {
    const configured = keys.every(key => data?.configured[key]);
    const removing = keys.some(key => form?.clear.includes(key));
    return <span className={`integration-status ${configured && !removing ? "configured" : ""}`}>
      <span aria-hidden="true"/>{removing ? "변경 예정" : configured ? "등록됨" : "미등록"}
    </span>;
  }
  const dirty = !!(form && data && (Object.keys(form.secrets).length || form.clear.length ||
    (["openaiModel", "openaiInputUsd", "openaiOutputUsd", "imageUsd", "videoUsd"] as const).some(key => form[key] !== data[key])));
  return <div className="shared-settings">
    <div className="page-heading"><h1>공통 API 설정</h1></div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {notice && <p role="status" className="notice success">{notice}</p>}
    {!form || !data ? <p className="muted">불러오는 중…</p> : <form
      onSubmit={e => { e.preventDefault(); void save(); }}
      onInvalidCapture={e => (e.target as HTMLElement).closest("details")?.setAttribute("open", "")}
    >
      {!data.encryptionReady && <p role="alert" className="notice error">서버 암호화 설정이 필요합니다.</p>}
      <div className="integration-panel">
        <section className="integration-section" aria-labelledby="openai-heading">
          <div className="integration-heading"><h2 id="openai-heading">OpenAI</h2>{status(["openaiKey"])}</div>
          <div className="integration-fields">
            {keyField("openaiKey")}
            <button type="button" className="text-button verify-key" onClick={() => void verify()}
              disabled={busy || !data.configured.openaiKey || !!form.secrets.openaiKey || form.clear.includes("openaiKey") || form.openaiModel !== data.openaiModel}
            >연결 확인</button>
          </div>
        </section>
        <section className="integration-section" aria-labelledby="higgsfield-heading">
          <div className="integration-heading"><h2 id="higgsfield-heading">Higgsfield</h2>{status(["higgsfieldKey", "higgsfieldSecret"])}</div>
          <div className="integration-fields">{keyField("higgsfieldKey")}{keyField("higgsfieldSecret")}</div>
        </section>
        <section className="integration-section" aria-labelledby="buffer-heading">
          <div className="integration-heading"><h2 id="buffer-heading">Buffer</h2>{status(["bufferApiKey"])}</div>
          <div className="integration-fields">{keyField("bufferApiKey")}</div>
        </section>
      </div>
      <details className="integration-disclosure">
        <summary>SNS 앱<ChevronDown size={16} aria-hidden="true"/></summary>
        <div className="integration-panel">
          {([
            { name: "X", channel: "x", keys: ["xClientId", "xClientSecret"] },
            { name: "Instagram", channel: "instagram", keys: ["instagramClientId", "instagramClientSecret"] },
            { name: "Threads", channel: "threads", keys: ["threadsClientId", "threadsClientSecret"] },
          ] as { name: string; channel: Channel; keys: SecretField[] }[]).map(section => <section className="integration-section" key={section.channel} aria-labelledby={`${section.channel}-heading`}>
            <div className="integration-heading"><h2 id={`${section.channel}-heading`}>{section.name}</h2>{status(section.keys)}</div>
            <div className="integration-fields">
              {section.keys.map(keyField)}
              <div className="integration-field callback-field"><label htmlFor={`callback-${section.channel}`}>Callback URL</label>
                <input id={`callback-${section.channel}`} readOnly value={`${typeof location === "undefined" ? "https://console.nullge.com" : location.origin}/api/channels/${section.channel}/callback`}/>
              </div>
            </div>
          </section>)}
        </div>
      </details>
      <details className="integration-disclosure">
        <summary>모델·단가<ChevronDown size={16} aria-hidden="true"/></summary>
        <div className="integration-panel">
          <section className="integration-section" aria-labelledby="model-heading">
            <div className="integration-heading"><h2 id="model-heading">OpenAI</h2></div>
            <div className="integration-fields">
              <div className="integration-field"><label htmlFor="generation-model">모델</label>
                <input id="generation-model" required disabled={busy} value={form.openaiModel} maxLength={100}
                  onChange={e => {
                    setForm({ ...form, openaiModel: e.target.value, openaiInputUsd: null, openaiOutputUsd: null }); setNotice("");
                  }}/>
              </div>
              <div className="integration-price-grid">
                {([ ["openaiInputUsd", "입력 / 100만 토큰 (USD)"], ["openaiOutputUsd", "출력 / 100만 토큰 (USD)"] ] as const).map(([key, label]) => <div className="integration-field" key={key}>
                  <label htmlFor={`price-${key}`}>{label}</label>
                  <input id={`price-${key}`} type="number" min="0.000001" max="10000" step="any" disabled={busy} value={form[key] ?? ""} placeholder="미설정"
                    onChange={e => { setForm({ ...form, [key]: e.target.value === "" ? null : Number(e.target.value) }); setNotice(""); }}/>
                </div>)}
              </div>
            </div>
          </section>
          <section className="integration-section" aria-labelledby="media-price-heading">
            <div className="integration-heading"><h2 id="media-price-heading">Higgsfield</h2></div>
            <div className="integration-fields integration-price-grid">
              {([ ["imageUsd", "이미지 / 1장 (USD)"], ["videoUsd", "영상 / 5초 (USD)"] ] as const).map(([key, label]) => <div className="integration-field" key={key}>
                <label htmlFor={`price-${key}`}>{label}</label>
                <input id={`price-${key}`} type="number" min="0.000001" max="10000" step="any" disabled={busy} value={form[key] ?? ""} placeholder="미설정"
                  onChange={e => { setForm({ ...form, [key]: e.target.value === "" ? null : Number(e.target.value) }); setNotice(""); }}/>
              </div>)}
            </div>
          </section>
        </div>
      </details>
      <div className="settings-save"><button className="button primary" disabled={busy || !data.encryptionReady || !dirty}>{busy ? "처리 중…" : "저장"}</button></div>
    </form>}
  </div>;
}
export function ProductChannels({ project }: { project: Project }) {
  const [rows, setRows] = useState<Connection[]>([]),
    [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]),
    [selectedBuffer, setSelectedBuffer] = useState<Record<string, string>>({}),
    [tokens, setTokens] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const path = `projects/${project.slug}/channels`;
  const load = async () => {
    const [connections, available] = await Promise.allSettled([
      call<Connection[]>(path),
      call<BufferChannel[]>("settings/buffer/channels"),
    ]);
    if (connections.status === "rejected") throw connections.reason;
    setRows(connections.value);
    setBufferChannels(available.status === "fulfilled" ? available.value : []);
  };
  useEffect(() => {
    void load().catch((e) => setError(message(e)));
    const query = new URLSearchParams(location.search);
    const connected = query.get("connected") as Channel | null;
    if (connected && Object.hasOwn(CHANNEL_LABELS, connected))
      setNotice(`${CHANNEL_LABELS[connected]} 계정 연결을 완료했어요. 표시된 계정이 ${project.name} 계정인지 확인해 주세요.`);
    if (query.has("connection_error"))
      setError("SNS 인증이 취소되었습니다. 기존 계정 연결은 유지되며, 다시 연결할 수 있어요.");
  }, [path]);
  async function action(c: Connection, kind: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await call<{ url?: string; message?: string }>(
        `${path}/${c.channel}/${kind}`,
        {
          revision: c.revision,
          ...(kind === "connect" ? { token: tokens[c.channel] } : {}),
        },
      );
      setTokens({});
      if (result.url) {
        location.assign(result.url);
        return;
      }
      await load();
      setNotice(result.message || "연결 정보를 저장했어요.");
    } catch (e) {
      setTokens({});
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function connectBuffer(c: Connection) {
    const channelId = selectedBuffer[c.channel];
    if (!channelId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await call<{ message: string }>(`${path}/${c.channel}/buffer`, { revision: c.revision, channelId });
      await load();
      setNotice(result.message);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  const [manualChannel, setManualChannel] = useState<Channel>("threads");
  const when = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";
  return (
    <>
      <div className="section-title">
        <h2>{project.name}의 SNS 계정</h2>
        <a className="text-button" href="/settings"><Settings size={14} />공통 API 설정</a>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice success">
          {notice}
        </p>
      )}
      <div className="panel channel-panel">
        <table className="channel-table">
          <thead>
            <tr><th scope="col">채널</th><th scope="col">상태</th><th scope="col">계정</th><th scope="col">연결 방식</th><th scope="col">인증 만료</th><th scope="col"><span className="visually-hidden">동작</span></th></tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const buffer = bufferChannels.filter(channel => channel.service === c.channel);
              return (
                <tr key={c.channel}>
                  <td data-label="채널"><span className="channel-name"><span className="channel-symbol">{c.channel === "x" ? "𝕏" : c.channel === "threads" ? "@" : "◎"}</span>{CHANNEL_LABELS[c.channel]}</span></td>
                  <td data-label="상태"><span className={`badge ${c.connected ? "approved" : "draft"}`}>{c.connected ? "연결됨" : "미연결"}</span></td>
                  <td data-label="계정" className={c.connected ? undefined : "empty"}>{c.connected && c.username ? <strong>@{c.username}</strong> : <span className="muted">—</span>}</td>
                  <td data-label="연결 방식" className={c.connected ? undefined : "empty"}>{c.connected ? (c.provider === "buffer" ? "Buffer" : "직접") : <span className="muted">—</span>}</td>
                  <td data-label="인증 만료" className={c.connected ? undefined : "empty"}>{c.connected ? (c.expiresAt ? when(c.expiresAt) : <span className="muted">공급자 기준</span>) : <span className="muted">—</span>}</td>
                  <td data-label="동작">
                    <div className="channel-actions">
                      <button className="button primary" disabled={busy} onClick={() => void action(c, "authorize")}>
                        {c.connected ? "다시 인증" : "연결"}<ArrowUpRight size={14} />
                      </button>
                      {buffer.length > 0 && (
                        <span className="channel-buffer">
                          <select aria-label={`${CHANNEL_LABELS[c.channel]} Buffer 채널`} value={selectedBuffer[c.channel] || ""} disabled={busy}
                            onChange={e => setSelectedBuffer({ ...selectedBuffer, [c.channel]: e.target.value })}>
                            <option value="">Buffer 채널</option>
                            {buffer.map(channel => <option value={channel.id} key={channel.id}>{channel.name} · {channel.organizationName}</option>)}
                          </select>
                          <button className="button" disabled={busy || !selectedBuffer[c.channel]} onClick={() => void connectBuffer(c)}>Buffer {c.connected ? "교체" : "연결"}</button>
                        </span>
                      )}
                      {c.connected && (
                        <>
                          <button className="button" disabled={busy} onClick={() => void action(c, "verify")}>다시 확인</button>
                          <button className="text-button danger-text" disabled={busy}
                            onClick={() => { if (confirm(`${project.name}의 ${CHANNEL_LABELS[c.channel]} 연결을 해제할까요? 저장된 토큰이 삭제됩니다.`)) void action(c, "disconnect"); }}>
                            해제
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="channel-manual">
        <summary>사용자 토큰으로 직접 연결 (Threads · Instagram)</summary>
        <form className="editor-form" onSubmit={(e) => { e.preventDefault(); const row = rows.find(r => r.channel === manualChannel); if (row) void action(row, "connect"); }}>
          <div className="field-pair">
            <label>채널
              <select value={manualChannel} disabled={busy} onChange={e => setManualChannel(e.target.value as Channel)}>
                <option value="threads">Threads</option><option value="instagram">Instagram</option>
              </select>
            </label>
            <label>사용자 Access Token
              <input type="password" autoComplete="new-password" required maxLength={4096} value={tokens[manualChannel] || ""}
                onChange={(e) => setTokens({ ...tokens, [manualChannel]: e.target.value })} />
            </label>
          </div>
          <button className="button primary" disabled={busy || !tokens[manualChannel]}>계정 확인 후 연결</button>
        </form>
      </details>
    </>
  );
}
const jobLabels: Record<GenerationJob["status"], string> = {
  quoted: "비용 확인",
  queued: "대기 중",
  planning: "문구 작성 중",
  submitting: "미디어 요청 중",
  rendering: "미디어 생성 중",
  completed: "완성 · 검토 필요",
  failed: "생성 중단",
  uncertain: "처리 여부 확인 필요",
};
export function GenerationHistory({ project }: { project: Project }) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      call<GenerationJob[]>(`projects/${project.slug}/generations`)
        .then((j) => {
          if (active) {
            setJobs(j);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [project.slug]);
  if (!jobs.length && !error) return null;
  return (
    <section className="panel generation-history">
      <div className="section-title">
        <h2>자동 생성 작업</h2>
        <Sparkles size={18} />
      </div>
      {error && <p role="alert">{error}</p>}
      {jobs.slice(0, 8).map((j) => (
        <div className="generation-job" key={j.id}>
          <div>
            <strong>{j.title || j.prompt || `${project.name} 자동 콘텐츠`}</strong>
            <p className="muted">
              {jobLabels[j.status]} ·{" "}
              {j.format === "text"
                ? "텍스트"
                : j.format === "image"
                  ? "이미지"
                  : "영상"}{" "}
              · 예상 {money(Number(j.estimatedUsd))}
            </p>
            {j.error && (
              <p role="alert" className="job-error">
                {j.error}
              </p>
            )}
          </div>
          {j.postId && (
            <a
              className="button"
              href={`/projects/${project.slug}/marketing/${j.postId}`}
            >
              결과 검토
              <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      ))}
    </section>
  );
}
export function AutoCreator({ project, manual }: { project: Project; manual: React.ReactNode }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto"),
    [prompt, setPrompt] = useState(""),
    [format, setFormat] = useState<ContentFormat>("text"),
    [channel, setChannel] = useState<Channel | "auto">("auto"),
    [language, setLanguage] = useState("ko"),
    [reference, setReference] = useState<string>(),
    [referenceName, setReferenceName] = useState(""),
    [referenceLoading, setReferenceLoading] = useState(false),
    [quote, setQuote] = useState<GenerationQuote | null>(null),
    [estimating, setEstimating] = useState(true),
    [quoteError, setQuoteError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [jobId, setJobId] = useState<string>(),
    [job, setJob] = useState<GenerationJob>(),
    [error, setError] = useState("");
  const path = `projects/${project.slug}/generations`;
  const editVersion = useRef(0), submitting = useRef(false), referenceVersion = useRef(0);
  const locked = busy || !!jobId;
  const inputKey = JSON.stringify({ prompt, format, language, ...(channel === "auto" ? {} : { channel }), ...(reference ? { reference } : {}) });
  function change() {
    editVersion.current++;
    setQuote(null);
    setQuoteError("");
    setError("");
    setEstimating(true);
  }
  useEffect(() => {
    if (mode !== "auto" || jobId || referenceLoading) return;
    let active = true;
    const version = editVersion.current;
    setQuote(null);
    setEstimating(true);
    setQuoteError("");
    const timer = setTimeout(() => {
      void call<GenerationQuote>(`${path}/quote`, JSON.parse(inputKey)).then(next => {
        if (active && version === editVersion.current) setQuote(next);
      }).catch(e => {
        if (active && version === editVersion.current) setQuoteError(message(e));
      }).finally(() => {
        if (active && version === editVersion.current) setEstimating(false);
      });
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [inputKey, path, mode, refresh, jobId, referenceLoading]);
  useEffect(() => {
    if (!quote || locked) return;
    const timer = setTimeout(() => { change(); setRefresh(n => n + 1); }, Math.max(1000, Date.parse(quote.expiresAt) - Date.now() - 5000));
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
        const current = jobs.find(item => item.id === jobId);
        if (current) {
          setJob(current);
          setError("");
          if (current.status === "completed" && current.postId) {
            location.assign(`/projects/${project.slug}/marketing/${current.postId}`);
            return;
          }
          if (["failed", "uncertain"].includes(current.status)) return;
        }
      } catch (e) { if (active) setError(message(e)); }
      if (active) timer = setTimeout(() => void load(), 3000);
    };
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [jobId, path, project.slug]);
  async function generate() {
    if (!quote || submitting.current || locked || referenceLoading) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) { change(); setRefresh(n => n + 1); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const created = await call<{ id: string }>(`${path}/confirm`, { quoteId: quote.id, confirmed: true });
      setJobId(created.id);
    } catch (e) { setError(message(e)); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <>
    <div className="creator-mode">
      <a className="back-link" href={`/projects/${project.slug}/marketing`}>콘텐츠 목록</a>
      <button className="text-button" disabled={locked} onClick={() => setMode(mode === "auto" ? "manual" : "auto")}>{mode === "auto" ? "직접 작성" : "자동으로 만들기"}</button>
    </div>
    {mode === "manual" ? manual : <div className="creator-grid">
      <form className="panel editor-form" onSubmit={e => { e.preventDefault(); void generate(); }}>
        <p className="eyebrow">CREATE FOR {project.name.toUpperCase()}</p>
        <h2>무엇을 만들까요?</h2>
        <p className="muted">타입만 골라 주세요. {project.name}에 맞는 소재부터 완성까지 준비할게요.</p>
        <fieldset className="format-options" disabled={locked}>
          <legend>1. 콘텐츠 타입</legend>
          {([
            ["text", "글", "바로 쓸 수 있는 문구"],
            ["image", "이미지", "이미지 1장 + 문구"],
            ["video", "영상", "5초 세로 영상 + 문구"],
          ] as const).map(([value, label, description]) => <label className={format === value ? "selected" : ""} key={value}>
            <input type="radio" name="format" value={value} checked={format === value} onChange={() => {
              setFormat(value);
              if (value === "text" && channel === "instagram") setChannel("auto");
              change();
            }}/><strong>{label}</strong><span>{description}</span>
          </label>)}
        </fieldset>
        <label>2. 프롬프트 <span className="field-hint">선택 · 비워두면 소재도 알아서 골라요</span>
          <textarea maxLength={1200} rows={3} disabled={locked} placeholder="예: 오늘은 퇴근 후 가볍게 시작하는 느낌으로" value={prompt} onChange={e => { setPrompt(e.target.value); change(); }}/>
        </label>
        <details className="creator-options">
          <summary>세부 설정 · 채널 형식, 언어, 참고 이미지</summary>
          <div className="field-pair">
            <label>채널 형식<select disabled={locked} value={channel} onChange={e => { setChannel(e.target.value as Channel | "auto"); change(); }}>
              <option value="auto">자동 · {format === "text" ? "Threads" : "Instagram"}</option>
              {Object.entries(CHANNEL_LABELS).filter(([key]) => !(format === "text" && key === "instagram")).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
            <label>언어<select disabled={locked} value={language} onChange={e => { setLanguage(e.target.value); change(); }}><option value="ko">한국어</option><option value="en">English</option></select></label>
          </div>
          <label>참고 이미지 <span className="field-hint">선택 · JPEG/PNG 2 MB 이하 · 분위기 참고용</span>
            <input type="file" accept="image/jpeg,image/png" disabled={locked} onChange={e => {
              const version = ++referenceVersion.current;
              change(); setReference(undefined); setReferenceName(""); setReferenceLoading(false);
              const file = e.target.files?.[0];
              if (!file) return;
              if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 2 * 1024 * 1024) {
                setError("2 MB 이하 JPEG 또는 PNG를 선택해 주세요."); e.target.value = ""; return;
              }
              const reader = new FileReader();
              setReferenceLoading(true);
              reader.onload = () => { if (referenceVersion.current === version) { change(); setReference(String(reader.result)); setReferenceName(file.name); setReferenceLoading(false); } };
              reader.onerror = () => { if (referenceVersion.current === version) { setError("이미지를 읽지 못했어요."); setReferenceLoading(false); } };
              reader.readAsDataURL(file);
            }}/>
          </label>
          {reference && <div className="reference-preview"><img src={reference} alt="참고 이미지"/><span>{referenceName}</span><button type="button" className="text-button" disabled={locked} onClick={() => { referenceVersion.current++; setReference(undefined); setReferenceName(""); change(); }}>제거</button></div>}
        </details>
        {jobId ? <section className="generation-progress" aria-live="polite">
          <Sparkles size={22}/><h3>{job ? jobLabels[job.status] : "생성을 준비하고 있어요"}</h3>
          <p>{job?.error || "제품 정보와 최근 콘텐츠를 살펴보고 있어요. 완성되면 결과를 열어드릴게요."}</p>
          <a className="button" href={`/projects/${project.slug}/marketing`}>콘텐츠 목록에서 확인</a>
        </section> : <div className="creator-submit">
          <div aria-live="polite">
            {estimating ? <p className="muted">예상 비용 확인 중…</p> : quoteError ? <p className="notice error" role="alert">{quoteError} <a href="/settings">공통 설정 확인</a></p> : quote && <>
              <p className="cost-total">이번 생성 예상 비용 <strong>{money(quote.totalUsd)}</strong></p>
              <details className="cost-details"><summary>비용 상세</summary>{quote.lines.map((line, i) => <p className="cost-line" key={i}><span>{line.label}</span><strong>{money(line.usd)}</strong></p>)}<p className="field-hint">이력 입력 여유분을 포함한 예상치예요. 실제 청구액은 달라질 수 있고, 실패한 요청에도 비용이 발생할 수 있어요.</p></details>
            </>}
          </div>
          <button className="button primary generate-button" disabled={locked || estimating || referenceLoading || !quote}><Sparkles size={17}/>{busy ? "생성 요청 중…" : "콘텐츠 생성"}</button>
          <p className="field-hint">버튼을 누르면 표시된 예상 비용으로 생성해요. 완성한 콘텐츠는 검토 대기에 저장돼요.</p>
          {(quoteError || error) && <button className="text-button" type="button" disabled={busy} onClick={() => { change(); setRefresh(n => n + 1); }}>예상 비용 다시 확인</button>}
        </div>}
        {error && <p role="alert" className="notice error">{error}</p>}
      </form>
      <aside><section className="panel review-panel creator-context">
        <span className="project-dot" style={{ background: project.color }}/><p className="eyebrow">{project.name}</p>
        <h3>이 제품을 알고 만들어요</h3><p>{project.description || "브랜드 설정에 등록된 정보를 참고해요."}</p>
        <ul className="workflow-list"><li>제품의 기능·대상·말투 반영</li><li>최근 게시물과 생성 이력 참고</li><li>겹치는 소재·문구·장면 비교</li><li>완성 후 검토 대기에 저장</li></ul>
        <p className="field-hint">이 콘솔에 저장된 제품별 이력을 참고해요. 최종 내용과 중복 여부를 검토한 뒤 게시할 수 있어요.</p>
        <a className="text-button" href={`/projects/${project.slug}/settings#brand`}>브랜드 설정 확인<ArrowUpRight size={14}/></a>
      </section></aside>
    </div>}
  </>;
}
export function GeneratedAsset({ post }: { post: Post }) {
  if (!post.assetId) return null;
  return (
    <section className="panel generated-asset">
      <div className="section-title">
        <h2>완성된 {post.format === "video" ? "영상" : "이미지"}</h2>
        <a
          className="button"
          href={`/api/assets/${post.assetId}`}
          target="_blank"
          rel="noreferrer"
        >
          원본 열기
        </a>
      </div>
      {post.format === "video" ? (
        <video
          controls
          preload="metadata"
          src={`/api/assets/${post.assetId}`}
        />
      ) : (
        <img src={`/api/assets/${post.assetId}`} alt={post.title} />
      )}
      <p className="muted">
        이미지·문구가 브랜드에 맞는지 확인해 주세요.
      </p>
    </section>
  );
}
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
