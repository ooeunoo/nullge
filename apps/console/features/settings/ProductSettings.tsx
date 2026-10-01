'use client';
import { useEffect } from 'react';
import { type Project } from '@nullge/contracts';
import { ProductChannels } from '../marketing/ProductChannels';
import { settingsPath } from '../../lib/api';

export function ProductSettings({
  project,
  initialSection,
  children,
}: {
  project: Project;
  initialSection?: 'brand' | 'channels';
  children: React.ReactNode;
}) {
  const sections: [string, string, string][] = [
    ['brand', '브랜드', '제품 설명, 고객, 말투처럼 콘텐츠의 기준이 되는 정보'],
    ['channels', '채널', '이 제품의 SNS 계정 연결과 게시 경로'],
  ];
  useEffect(() => {
    const target = initialSection || (window.location.hash.replace('#', '') as 'brand' | 'channels' | '');
    if (!target) return;
    if (initialSection) window.history.replaceState(null, '', settingsPath(project, initialSection));
    document.getElementById(target)?.scrollIntoView({ block: 'start' });
  }, [project, initialSection]);
  return (
    <div className="product-settings">
      <nav className="settings-nav" aria-label="설정 섹션">
        {sections.map(([id, label, description]) => (
          <a key={id} href={`#${id}`}>
            <strong>{label}</strong>
            <span>{description}</span>
          </a>
        ))}
      </nav>
      <section id="brand" className="settings-section" aria-labelledby="settings-brand-title">
        <div className="settings-section-title">
          <h2 id="settings-brand-title">브랜드</h2>
          <p className="muted">
            저장하면 새 버전이 만들어지고, 바뀐 정보로 기존 콘텐츠를 다시 검토하게 돼요.
          </p>
        </div>
        {children}
      </section>
      <section id="channels" className="settings-section" aria-labelledby="settings-channels-title">
        <div className="settings-section-title">
          <h2 id="settings-channels-title">채널</h2>
        </div>
        <ProductChannels project={project} />
      </section>
    </div>
  );
}
