'use client';
import { type Project } from '@nullge/contracts';
import { Mark } from '../../components/ui/Mark';
import { productBrands } from '../../lib/product-brands';

export function BrandReference({ project }: { project: Project }) {
  const brand = productBrands[project.slug];
  if (!brand) return null;
  return (
    <section className="panel brand-reference" aria-label={`${project.name} 브랜드 원본`}>
      <Mark project={project} large />
      <h3>{project.name}</h3>
      <p className="muted">{brand.category}</p>
      <dl>
        <dt>프로젝트 위치</dt>
        <dd>{brand.repository}</dd>
        <dt>로고 원본</dt>
        <dd>{brand.source}</dd>
        <dt>기본 정보 분석</dt>
        <dd>
          2026. 09. 25 · 저장소 기준
          <br />
          고객·말투는 초기 가설, 기능은 근거를 함께 기록했어요. 출시·운영 상태는 별도 확인이 필요해요.
        </dd>
      </dl>
    </section>
  );
}
