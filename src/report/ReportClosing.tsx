import type { ReactNode } from 'react';
import { Reveal } from './primitives';

export interface Pillar {
  title: string;
  detail: string;
}

/** Full-bleed Kelly-green close, mirroring the sponsor report's sign-off. */
export function ReportClosing({
  title,
  children,
  pillars,
  actions,
}: {
  title: ReactNode;
  children: ReactNode;
  pillars: Pillar[];
  actions?: ReactNode;
}) {
  return (
    <section id="closing" className="r-closing">
      <div className="r-wrap">
        <div className="r-closing__grid">
          <Reveal>
            <div className="r-rule" style={{ background: 'var(--gold)' }} />
            <h2 className="r-closing__title">{title}</h2>
            {children}
            {actions && <div className="r-colleagues">{actions}</div>}
          </Reveal>
          <Reveal className="r-closing__pillars" delay={120}>
            {pillars.map((p, i) => (
              <div key={p.title} className="r-closing__pillar">
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span>
                  {p.title}
                  <small>{p.detail}</small>
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
