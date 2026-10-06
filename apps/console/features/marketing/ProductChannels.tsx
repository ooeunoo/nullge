'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Settings } from 'lucide-react';
import {
  CHANNEL_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  type Language,
  type Project,
  type Channel,
  type BufferChannel,
  type Connection,
} from '@nullge/contracts';
import { call, message } from './shared';

const CHANNELS = ['x', 'threads', 'instagram'] as const;
const key = (c: Pick<Connection, 'channel' | 'language'>) => `${c.channel}:${c.language}`;
const empty = (channel: Channel, language: Language): Connection => ({
  channel,
  language,
  provider: 'direct',
  revision: 0,
  userId: null,
  username: null,
  verifiedAt: null,
  expiresAt: null,
  connected: false,
});

/** One row per channel and language: a product can keep a separate account for each language. */
export function ProductChannels({ project }: { project: Project }) {
  const [saved, setSaved] = useState<Connection[]>([]),
    [added, setAdded] = useState<Connection[]>([]),
    [addChannel, setAddChannel] = useState<Channel>('instagram'),
    [addLanguage, setAddLanguage] = useState<Language>('en'),
    [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]),
    [selectedBuffer, setSelectedBuffer] = useState<Record<string, string>>({}),
    [tokens, setTokens] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const path = `projects/${project.slug}/channels`;
  const load = async () => {
    const [connections, available] = await Promise.allSettled([
      call<Connection[]>(path),
      call<BufferChannel[]>('settings/buffer/channels'),
    ]);
    if (connections.status === 'rejected') throw connections.reason;
    setSaved(connections.value);
    setBufferChannels(available.status === 'fulfilled' ? available.value : []);
  };
  useEffect(() => {
    void load().catch((e) => setError(message(e)));
    const query = new URLSearchParams(location.search);
    const connected = query.get('connected') as Channel | null;
    if (connected && Object.hasOwn(CHANNEL_LABELS, connected))
      setNotice(
        `${CHANNEL_LABELS[connected]} 계정 연결을 완료했어요. 표시된 계정이 ${project.name} 계정인지 확인해 주세요.`,
      );
    if (query.has('connection_error'))
      setError('SNS 인증이 취소되었습니다. 기존 계정 연결은 유지되며, 다시 연결할 수 있어요.');
  }, [path]);
  // Saved rows first, then languages added on this screen that have no saved row yet, in channel order.
  const rows = CHANNELS.flatMap((channel) =>
    [...saved, ...added.filter((a) => !saved.some((s) => key(s) === key(a)))]
      .filter((c) => c.channel === channel)
      .sort((a, b) => LANGUAGES.indexOf(a.language) - LANGUAGES.indexOf(b.language)),
  );
  const free = LANGUAGES.filter((l) => !rows.some((r) => r.channel === addChannel && r.language === l));
  const label = (c: Pick<Connection, 'channel' | 'language'>) =>
    `${CHANNEL_LABELS[c.channel]} ${LANGUAGE_LABELS[c.language]}`;
  async function action(c: Connection, kind: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await call<{ url?: string; message?: string }>(`${path}/${c.channel}/${kind}`, {
        revision: c.revision,
        language: c.language,
        ...(kind === 'connect' ? { token: tokens[key(c)] } : {}),
      });
      setTokens({});
      if (result.url) {
        location.assign(result.url);
        return;
      }
      await load();
      setNotice(result.message || '연결 정보를 저장했어요.');
    } catch (e) {
      setTokens({});
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function connectBuffer(c: Connection) {
    const channelId = selectedBuffer[key(c)];
    if (!channelId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await call<{ message: string }>(`${path}/${c.channel}/buffer`, {
        revision: c.revision,
        language: c.language,
        channelId,
      });
      await load();
      setNotice(result.message);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const [manual, setManual] = useState<{ channel: Channel; language: Language }>({
    channel: 'threads',
    language: 'ko',
  });
  const manualKey = key(manual);
  const when = (value: string | null) =>
    value ? new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  return (
    <>
      <div className="section-title">
        <h2>{project.name}의 SNS 계정</h2>
        <a className="text-button" href="/settings">
          <Settings size={14} />
          공통 API 설정
        </a>
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
            <tr>
              <th scope="col">채널</th>
              <th scope="col">상태</th>
              <th scope="col" className="col-optional">
                계정
              </th>
              <th scope="col" className="col-optional">
                연결 방식
              </th>
              <th scope="col" className="col-optional">
                인증 만료
              </th>
              <th scope="col">
                <span className="visually-hidden">동작</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const buffer = bufferChannels.filter((channel) => channel.service === c.channel);
              return (
                <tr key={key(c)}>
                  <td data-label="채널">
                    <span className="channel-name">
                      <span className="channel-symbol">
                        {c.channel === 'x' ? '𝕏' : c.channel === 'threads' ? '@' : '◎'}
                      </span>
                      <span className="channel-text">
                        {CHANNEL_LABELS[c.channel]}{' '}
                        <span className="badge draft">{LANGUAGE_LABELS[c.language]}</span>
                        {c.connected && c.username && <span className="channel-sub">@{c.username}</span>}
                      </span>
                    </span>
                  </td>
                  <td data-label="상태">
                    <span className={`badge ${c.connected ? 'approved' : 'draft'}`}>
                      {c.connected ? '연결됨' : '미연결'}
                    </span>
                  </td>
                  <td data-label="계정" className="col-optional">
                    {c.connected && c.username ? (
                      <strong>@{c.username}</strong>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td data-label="연결 방식" className="col-optional">
                    {c.connected ? (
                      c.provider === 'buffer' ? (
                        'Buffer'
                      ) : (
                        '직접'
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td data-label="인증 만료" className="col-optional">
                    {c.connected ? (
                      c.expiresAt ? (
                        when(c.expiresAt)
                      ) : (
                        <span className="muted">공급자 기준</span>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td data-label="동작">
                    <div className="channel-actions">
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void action(c, 'authorize')}
                      >
                        {c.connected ? '다시 인증' : '연결'}
                        <ArrowUpRight size={14} />
                      </button>
                      {buffer.length > 0 && (
                        <span className="channel-buffer">
                          <select
                            aria-label={`${label(c)} Buffer 채널`}
                            value={selectedBuffer[key(c)] || ''}
                            disabled={busy}
                            onChange={(e) =>
                              setSelectedBuffer({ ...selectedBuffer, [key(c)]: e.target.value })
                            }
                          >
                            <option value="">Buffer 채널</option>
                            {buffer.map((channel) => (
                              <option value={channel.id} key={channel.id}>
                                {channel.name} · {channel.organizationName}
                              </option>
                            ))}
                          </select>
                          <button
                            className="button"
                            disabled={busy || !selectedBuffer[key(c)]}
                            onClick={() => void connectBuffer(c)}
                          >
                            Buffer {c.connected ? '교체' : '연결'}
                          </button>
                        </span>
                      )}
                      {c.connected && (
                        <>
                          <button
                            className="button col-optional"
                            disabled={busy}
                            onClick={() => void action(c, 'verify')}
                          >
                            다시 확인
                          </button>
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  `${project.name}의 ${label(c)} 연결을 해제할까요? 저장된 토큰이 삭제됩니다.`,
                                )
                              )
                                void action(c, 'disconnect');
                            }}
                          >
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
        <form
          className="channel-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (free.includes(addLanguage)) setAdded([...added, empty(addChannel, addLanguage)]);
          }}
        >
          <span className="muted">언어별 계정 추가</span>
          <select
            aria-label="채널"
            value={addChannel}
            disabled={busy}
            onChange={(e) => setAddChannel(e.target.value as Channel)}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
          <select
            aria-label="언어"
            value={addLanguage}
            disabled={busy}
            onChange={(e) => setAddLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l} disabled={!free.includes(l)}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
          <button className="button" disabled={busy || !free.includes(addLanguage)}>
            줄 추가
          </button>
        </form>
      </div>
      <details className="channel-manual">
        <summary>사용자 토큰으로 직접 연결 (Threads · Instagram)</summary>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action(
              rows.find((r) => key(r) === manualKey) || empty(manual.channel, manual.language),
              'connect',
            );
          }}
        >
          <div className="field-pair">
            <label>
              채널
              <select
                value={manual.channel}
                disabled={busy}
                onChange={(e) => setManual({ ...manual, channel: e.target.value as Channel })}
              >
                <option value="threads">Threads</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
            <label>
              언어
              <select
                value={manual.language}
                disabled={busy}
                onChange={(e) => setManual({ ...manual, language: e.target.value as Language })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              사용자 Access Token
              <input
                type="password"
                autoComplete="new-password"
                required
                maxLength={4096}
                value={tokens[manualKey] || ''}
                onChange={(e) => setTokens({ ...tokens, [manualKey]: e.target.value })}
              />
            </label>
          </div>
          <button className="button primary" disabled={busy || !tokens[manualKey]}>
            계정 확인 후 연결
          </button>
        </form>
      </details>
    </>
  );
}
