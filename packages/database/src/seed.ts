import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { WORKSPACE_ID } from './migration';
import { currentProductCatalog } from './minimo-desktop-pet';

export const legacyInitialProducts = [
  {
    slug: 'mellow',
    name: 'mellow',
    color: '#72bd75',
    description: 'AI 친구와 목소리로 대화하는 외국어 회화 서비스',
    audience: '일상에서 외국어 말하기를 연습하려는 사람',
    facts: '예약된 AI 통화\nAI 친구와 음성 대화\n대화 후 표현 복습',
    tone: '친근하고 구체적인 짧은 문장',
    avoid: '학습 효과 보장, 실제 교사라는 표현, 미확인 가격·출시 상태',
    website: 'https://www.mellowcall.com/',
  },
  {
    slug: 'clipit',
    name: 'ClipIt',
    color: '#9c8aeb',
    description: '긴 영상에서 하이라이트를 찾아 짧은 클립으로',
    audience: '기존 영상으로 짧은 콘텐츠를 제작하려는 사람',
    facts: 'AI 하이라이트 선택\n세로 클립 제작\n제목·자막·템플릿 편집',
    tone: '결과와 작업 과정을 보여주는 간결한 문장',
    avoid: '조회수·수익 보장, 측정하지 않은 시간 절감률',
    website: 'https://clipit.studio/',
  },
  {
    slug: 'minimo',
    name: 'minimo',
    color: '#e6a569',
    description: 'AI 미니모가 사는 나만의 작은 공간',
    audience: '',
    facts: '',
    tone: '아늑하고 장난스러운 말투',
    avoid: '미확인 출시·결제·구현 상태',
    website: '',
  },
  {
    slug: 'desk',
    name: 'desk',
    color: '#8ba7d8',
    description: '뉴스 이슈를 기사와 팟캐스트로',
    audience: '',
    facts: '',
    tone: '명료하고 절제된 설명',
    avoid: '출처 없는 최신 사실, 실제 사건처럼 보이는 생성 이미지',
    website: '',
  },
];
export async function seedDevelopment(db: DataSource) {
  const url = new URL(String(db.options.type === 'postgres' ? db.options.url : ''));
  if (
    process.env.NODE_ENV === 'production' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !url.pathname.startsWith('/nullge_')
  )
    throw new Error('Development seed requires a local nullge_* database.');
  await seedInitialProducts(db);
}
/** Explicit bootstrap: inserts unreviewed product profiles, never replaces existing data. */
export async function seedInitialProducts(db: DataSource) {
  await db.transaction(async (manager) => {
    for (const p of currentProductCatalog) {
      const [inserted] = await manager.query(
        `INSERT INTO projects (id,"workspaceId",slug,name,color,description,audience,facts,tone,avoid,website) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT ("workspaceId",slug) DO NOTHING RETURNING *`,
        [
          randomUUID(),
          WORKSPACE_ID,
          p.slug,
          p.name,
          p.color,
          p.description,
          p.audience,
          p.facts,
          p.tone,
          p.avoid,
          p.website,
        ],
      );
      if (!inserted) continue;
      await manager.query(
        'INSERT INTO profile_versions ("workspaceId","projectId",revision,snapshot) VALUES ($1,$2,1,$3)',
        [WORKSPACE_ID, inserted.id, JSON.stringify(inserted)],
      );
    }
  });
}
