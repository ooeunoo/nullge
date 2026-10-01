'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { type Project, type GenerationJob } from '@nullge/contracts';
import { call, jobLabels, message, money } from './shared';

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
