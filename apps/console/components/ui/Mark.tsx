'use client';
import { useState } from 'react';
import { type Project } from '@nullge/contracts';
import { productBrands } from '../../lib/product-brands';

export function Mark({ project, large = false }: { project: Project; large?: boolean }) {
  const brand = productBrands[project.slug];
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`project-mark ${large ? 'large' : ''}`}
      style={{ background: brand && !failed ? '#fff' : project.color }}
      aria-hidden="true"
    >
      {brand && !failed ? (
        <img
          src={brand.logo}
          alt=""
          width={large ? 56 : 28}
          height={large ? 56 : 28}
          onError={() => setFailed(true)}
        />
      ) : (
        project.name.slice(0, 1).toLowerCase()
      )}
    </span>
  );
}
