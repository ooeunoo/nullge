'use client';
import { useState } from 'react';
import { TEMPLATE_KINDS, type ContentGuide, type Project, type TemplateKind } from '@nullge/contracts';
import { api } from '../../lib/api';

/**
 * Edits a product's content guide. Lists use plain text so operators can paste from docs:
 * one item per line, and multi-line examples separated by a line containing only "---".
 */
const BLOCK = /\n-{3,}\n/;
const lines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const blocks = (v: string) =>
  v
    .split(BLOCK)
    .map((b) => b.trim())
    .filter(Boolean);
const REASON = /\n(?:이유|reason)\s*[:：]\s*(.+)$/i;
const NOTE = /\n(?:메모|note)\s*[:：]\s*(.+)$/i;

export function guideToText(g: ContentGuide) {
  return {
    pillars: g.pillars.map((p) => (p.description ? `${p.name} — ${p.description}` : p.name)).join('\n'),
    examples: g.examples.map((e) => (e.note ? `${e.text}\n메모: ${e.note}` : e.text)).join('\n---\n'),
    counterExamples: g.counterExamples.map((e) => `${e.text}\n이유: ${e.reason}`).join('\n---\n'),
    bannedPhrases: g.bannedPhrases.join('\n'),
    fixedHashtags: g.hashtags.fixed.join(' '),
  };
}
export type GuideText = ReturnType<typeof guideToText>;
export function textToGuide(t: GuideText, base: ContentGuide): ContentGuide {
  return {
    ...base,
    pillars: lines(t.pillars).map((l) => {
      const [name, ...rest] = l.split(/\s+[—–-]\s+/);
      return { name: name.slice(0, 60), description: rest.join(' — ').slice(0, 400) };
    }),
    examples: blocks(t.examples).map((b) => {
      const note = NOTE.exec(b);
      return { text: (note ? b.slice(0, note.index) : b).trim(), note: note?.[1].trim() || '' };
    }),
    counterExamples: blocks(t.counterExamples).map((b) => {
      const reason = REASON.exec(b);
      return { text: (reason ? b.slice(0, reason.index) : b).trim(), reason: reason?.[1].trim() || '' };
    }),
    bannedPhrases: lines(t.bannedPhrases),
    hashtags: { ...base.hashtags, fixed: t.fixedHashtags.split(/\s+/).filter(Boolean) },
  };
}

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  none: '사용 안 함',
  'photo-headline': '사진 + 헤드라인',
  'color-card': '색 배경 카드',
};

export function GuideEditor({
  project,
  guide,
  text,
  onGuide,
  onText,
}: {
  project: Project;
  guide: ContentGuide;
  text: GuideText;
  onGuide: (g: ContentGuide) => void;
  onText: (t: GuideText) => void;
}) {
  const [logoState, setLogoState] = useState('');
  const visual = (patch: Partial<ContentGuide['visual']>) =>
    onGuide({ ...guide, visual: { ...guide.visual, ...patch } });
  const area = (key: keyof GuideText, label: string, hint: string, rows = 4) => (
    <label>
      {label}
      <span className="field-hint">{hint}</span>
      <textarea rows={rows} value={text[key]} onChange={(e) => onText({ ...text, [key]: e.target.value })} />
    </label>
  );
  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
      setLogoState('1 MB 이하의 PNG 또는 JPEG를 선택해 주세요.');
      return;
    }
    setLogoState('올리는 중…');
    const image = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    try {
      const { id } = await api<{ id: string }>(`projects/${project.slug}/guide/logo`, { image });
      visual({ logoAssetId: id });
      setLogoState('저장하면 템플릿에 반영돼요.');
    } catch (e) {
      setLogoState(e instanceof Error ? e.message : '올리지 못했어요.');
    }
  }
  return (
    <fieldset className="guide-editor">
      <legend>콘텐츠 가이드</legend>
      <p className="muted">
        자동 생성이 이 기준으로 주제를 고르고, 후보를 검수하고, 이미지를 디자인해요. 비워 두면 기본 기준으로
        만들어요.
      </p>
      {area('pillars', '콘텐츠 기둥', '한 줄에 하나 · "이름 — 설명" (최대 6개)', 4)}
      {area(
        'examples',
        '좋은 예시 글',
        '예시 사이에 --- 한 줄 · 끝에 "메모: …"를 붙이면 왜 좋은지 함께 전해요 (최대 10개)',
        8,
      )}
      {area('counterExamples', '피할 예시 글', '예시 사이에 --- 한 줄 · 끝에 "이유: …" (최대 10개)', 5)}
      {area('bannedPhrases', '금지 문구', '한 줄에 하나 · 결과에 들어가면 그 후보는 탈락해요', 3)}
      <div className="field-pair">
        <label>
          고정 해시태그
          <span className="field-hint">공백으로 구분 · 최대 5개</span>
          <input
            value={text.fixedHashtags}
            onChange={(e) => onText({ ...text, fixedHashtags: e.target.value })}
          />
        </label>
        <label>
          해시태그 최대 개수
          <input
            type="number"
            min={0}
            max={10}
            value={guide.hashtags.max}
            onChange={(e) =>
              onGuide({
                ...guide,
                hashtags: { ...guide.hashtags, max: Math.max(0, Math.min(10, Number(e.target.value) || 0)) },
              })
            }
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={guide.requireWebsite}
          onChange={(e) => onGuide({ ...guide, requireWebsite: e.target.checked })}
        />
        캡션에 공식 소개 링크를 꼭 넣기
      </label>
      <label>
        사진 연출
        <span className="field-hint">이미지 생성에 덧붙일 촬영 방향 · 영어 권장</span>
        <textarea
          rows={3}
          maxLength={1200}
          value={guide.visual.photoStyle}
          onChange={(e) => visual({ photoStyle: e.target.value })}
        />
      </label>
      <div className="field-pair">
        <label>
          이미지 템플릿
          <select
            value={guide.visual.template}
            onChange={(e) => visual({ template: e.target.value as TemplateKind })}
          >
            {TEMPLATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          하단 문구
          <input
            maxLength={60}
            value={guide.visual.tagline}
            onChange={(e) => visual({ tagline: e.target.value })}
          />
        </label>
      </div>
      <div className="guide-colors">
        {(['background', 'ink', 'accent'] as const).map((key) => (
          <label key={key}>
            {{ background: '배경', ink: '글자', accent: '강조' }[key]}
            <input
              type="color"
              value={guide.visual.palette[key]}
              onChange={(e) =>
                visual({ palette: { ...guide.visual.palette, [key]: e.target.value.toUpperCase() } })
              }
            />
          </label>
        ))}
      </div>
      <label>
        템플릿 로고
        <span className="field-hint">투명 배경 PNG 권장 · 배경색 위에서 보이는 색으로 · 1 MB 이하</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => void uploadLogo(e.target.files?.[0])}
        />
      </label>
      {guide.visual.logoAssetId && (
        <div className="guide-logo" style={{ background: guide.visual.palette.background }}>
          <img src={`/api/assets/${guide.visual.logoAssetId}`} alt="템플릿 로고" />
        </div>
      )}
      {logoState && <p className="muted">{logoState}</p>}
    </fieldset>
  );
}
