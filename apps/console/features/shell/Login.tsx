'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { type AuthOptions } from '@nullge/contracts';
import { api } from '../../lib/api';

export function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<AuthOptions>('auth/options')
      .then(setOptions)
      .catch((e) => setError(e.message));
    if (new URLSearchParams(window.location.search).has('error'))
      setError('로그인을 확인하지 못했어요. 허용된 운영자 계정으로 다시 시도해 주세요.');
  }, []);
  return (
    <main className="login-page">
      <div className="login-card">
        <span className="wordmark">
          nullge<span>.</span>
        </span>
        <p className="eyebrow">CONSOLE</p>
        <h1>
          제품은 여러 개,
          <br />
          작업은 한곳에서.
        </h1>
        <p>ClipIt · minimo · mellow · Movy · desk · 다락방 카메라 · Kept · Dotori</p>
        {error && <p role="alert">{error}</p>}
        {!options && <p>로그인 방법을 확인하고 있어요.</p>}
        {options?.google && (
          <a className="button primary" href="/api/auth/google">
            Google로 운영자 로그인
          </a>
        )}
        {options?.local && (
          <>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('auth/local', {});
                  await onLogin();
                } catch (e) {
                  setError(e instanceof Error ? e.message : '로그인하지 못했습니다.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? '연결 중…' : '로컬 작업공간 열기'}
              <ArrowUpRight size={17} />
            </button>
            <p className="muted">이 기기의 개발 DB를 사용해요. 실제 SNS에는 게시되지 않아요.</p>
          </>
        )}
        {options && !options.local && !options.google && (
          <p className="muted">운영자 로그인 설정을 준비하고 있어요.</p>
        )}
      </div>
    </main>
  );
}
