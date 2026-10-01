'use client';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { type Channel, type IntegrationInput, type Integrations, type SecretField } from '@nullge/contracts';
import { call, message, secretLabels } from './shared';

export function SharedSettings() {
  const [data, setData] = useState<Integrations | null>(null),
    [form, setForm] = useState<IntegrationInput | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
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
    call<Integrations>('settings/integrations')
      .then(load)
      .catch((e) => setError(message(e)));
    if (new URLSearchParams(location.search).has('connection_error'))
      setError('SNS 연결에 실패했습니다. 설정을 확인해 주세요.');
  }, []);
  async function save() {
    if (!form || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      load(await call<Integrations>('settings/integrations', form, 'PATCH'));
      setNotice('저장했습니다.');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await call('settings/integrations/verify', {});
      setNotice('OpenAI 연결을 확인했습니다.');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function keyField(key: SecretField) {
    if (!form || !data) return null;
    const removing = form.clear.includes(key);
    return (
      <div className="integration-field" key={key}>
        <div className="integration-label">
          <label htmlFor={`integration-${key}`}>{secretLabels[key]}</label>
          {data.configured[key] && (
            <button
              type="button"
              className={`text-button key-remove ${removing ? 'pending' : ''}`}
              aria-label={`${secretLabels[key]} ${removing ? '삭제 취소' : '삭제'}`}
              aria-pressed={removing}
              disabled={busy}
              onClick={() => {
                const secrets = { ...form.secrets };
                delete secrets[key];
                setForm({
                  ...form,
                  secrets,
                  clear: removing ? form.clear.filter((k) => k !== key) : [...form.clear, key],
                });
                setNotice('');
              }}
            >
              {removing ? '삭제 취소' : '삭제'}
            </button>
          )}
        </div>
        <input
          id={`integration-${key}`}
          type="password"
          autoComplete="new-password"
          maxLength={4096}
          value={form.secrets[key] || ''}
          disabled={busy || removing}
          placeholder={removing ? '삭제 예정' : data.configured[key] ? '****' : '키 입력'}
          onChange={(e) => {
            const secrets = { ...form.secrets };
            if (e.target.value) secrets[key] = e.target.value;
            else delete secrets[key];
            setForm({ ...form, secrets });
            setNotice('');
          }}
        />
      </div>
    );
  }
  function status(keys: SecretField[]) {
    const configured = keys.every((key) => data?.configured[key]);
    const removing = keys.some((key) => form?.clear.includes(key));
    return (
      <span className={`integration-status ${configured && !removing ? 'configured' : ''}`}>
        <span aria-hidden="true" />
        {removing ? '변경 예정' : configured ? '등록됨' : '미등록'}
      </span>
    );
  }
  const dirty = !!(
    form &&
    data &&
    (Object.keys(form.secrets).length ||
      form.clear.length ||
      (['openaiModel', 'openaiInputUsd', 'openaiOutputUsd', 'imageUsd', 'videoUsd'] as const).some(
        (key) => form[key] !== data[key],
      ))
  );
  return (
    <div className="shared-settings">
      <div className="page-heading">
        <h1>공통 API 설정</h1>
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
      {!form || !data ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          onInvalidCapture={(e) => (e.target as HTMLElement).closest('details')?.setAttribute('open', '')}
        >
          {!data.encryptionReady && (
            <p role="alert" className="notice error">
              서버 암호화 설정이 필요합니다.
            </p>
          )}
          <div className="integration-panel">
            <section className="integration-section" aria-labelledby="openai-heading">
              <div className="integration-heading">
                <h2 id="openai-heading">OpenAI</h2>
                {status(['openaiKey'])}
              </div>
              <div className="integration-fields">
                {keyField('openaiKey')}
                <button
                  type="button"
                  className="text-button verify-key"
                  onClick={() => void verify()}
                  disabled={
                    busy ||
                    !data.configured.openaiKey ||
                    !!form.secrets.openaiKey ||
                    form.clear.includes('openaiKey') ||
                    form.openaiModel !== data.openaiModel
                  }
                >
                  연결 확인
                </button>
              </div>
            </section>
            <section className="integration-section" aria-labelledby="higgsfield-heading">
              <div className="integration-heading">
                <h2 id="higgsfield-heading">Higgsfield</h2>
                {status(['higgsfieldKey', 'higgsfieldSecret'])}
              </div>
              <div className="integration-fields">
                {keyField('higgsfieldKey')}
                {keyField('higgsfieldSecret')}
              </div>
            </section>
            <section className="integration-section" aria-labelledby="buffer-heading">
              <div className="integration-heading">
                <h2 id="buffer-heading">Buffer</h2>
                {status(['bufferApiKey'])}
              </div>
              <div className="integration-fields">{keyField('bufferApiKey')}</div>
            </section>
          </div>
          <details className="integration-disclosure">
            <summary>
              SNS 앱<ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="integration-panel">
              {(
                [
                  { name: 'X', channel: 'x', keys: ['xClientId', 'xClientSecret'] },
                  {
                    name: 'Instagram',
                    channel: 'instagram',
                    keys: ['instagramClientId', 'instagramClientSecret'],
                  },
                  { name: 'Threads', channel: 'threads', keys: ['threadsClientId', 'threadsClientSecret'] },
                ] as { name: string; channel: Channel; keys: SecretField[] }[]
              ).map((section) => (
                <section
                  className="integration-section"
                  key={section.channel}
                  aria-labelledby={`${section.channel}-heading`}
                >
                  <div className="integration-heading">
                    <h2 id={`${section.channel}-heading`}>{section.name}</h2>
                    {status(section.keys)}
                  </div>
                  <div className="integration-fields">
                    {section.keys.map(keyField)}
                    <div className="integration-field callback-field">
                      <label htmlFor={`callback-${section.channel}`}>Callback URL</label>
                      <input
                        id={`callback-${section.channel}`}
                        readOnly
                        value={`${typeof location === 'undefined' ? 'https://console.nullge.com' : location.origin}/api/channels/${section.channel}/callback`}
                      />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </details>
          <details className="integration-disclosure">
            <summary>
              모델·단가
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="integration-panel">
              <section className="integration-section" aria-labelledby="model-heading">
                <div className="integration-heading">
                  <h2 id="model-heading">OpenAI</h2>
                </div>
                <div className="integration-fields">
                  <div className="integration-field">
                    <label htmlFor="generation-model">모델</label>
                    <input
                      id="generation-model"
                      required
                      disabled={busy}
                      value={form.openaiModel}
                      maxLength={100}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          openaiModel: e.target.value,
                          openaiInputUsd: null,
                          openaiOutputUsd: null,
                        });
                        setNotice('');
                      }}
                    />
                  </div>
                  <div className="integration-price-grid">
                    {(
                      [
                        ['openaiInputUsd', '입력 / 100만 토큰 (USD)'],
                        ['openaiOutputUsd', '출력 / 100만 토큰 (USD)'],
                      ] as const
                    ).map(([key, label]) => (
                      <div className="integration-field" key={key}>
                        <label htmlFor={`price-${key}`}>{label}</label>
                        <input
                          id={`price-${key}`}
                          type="number"
                          min="0.000001"
                          max="10000"
                          step="any"
                          disabled={busy}
                          value={form[key] ?? ''}
                          placeholder="미설정"
                          onChange={(e) => {
                            setForm({
                              ...form,
                              [key]: e.target.value === '' ? null : Number(e.target.value),
                            });
                            setNotice('');
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              <section className="integration-section" aria-labelledby="media-price-heading">
                <div className="integration-heading">
                  <h2 id="media-price-heading">Higgsfield</h2>
                </div>
                <div className="integration-fields integration-price-grid">
                  {(
                    [
                      ['imageUsd', '이미지 / 1장 (USD)'],
                      ['videoUsd', '영상 / 5초 (USD)'],
                    ] as const
                  ).map(([key, label]) => (
                    <div className="integration-field" key={key}>
                      <label htmlFor={`price-${key}`}>{label}</label>
                      <input
                        id={`price-${key}`}
                        type="number"
                        min="0.000001"
                        max="10000"
                        step="any"
                        disabled={busy}
                        value={form[key] ?? ''}
                        placeholder="미설정"
                        onChange={(e) => {
                          setForm({ ...form, [key]: e.target.value === '' ? null : Number(e.target.value) });
                          setNotice('');
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </details>
          <div className="settings-save">
            <button className="button primary" disabled={busy || !data.encryptionReady || !dirty}>
              {busy ? '처리 중…' : '저장'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
