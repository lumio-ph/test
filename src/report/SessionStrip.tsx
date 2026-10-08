import type { SessionLine } from '../data/metrics';
import { pad2 } from './format';

const outcomeLabel: Record<SessionLine['outcome'], string> = {
  attended: 'attended',
  missed: 'missed',
  unrecorded: 'attendance not recorded',
  upcoming: 'still to come',
};

export function SessionStrip({
  lines,
  size = 'md',
  showUpcoming = true,
  programmeTotal = 0,
}: {
  lines: SessionLine[];
  size?: 'sm' | 'md';
  showUpcoming?: boolean;
  /** Pads the strip with "still to come" dots up to the programme length. */
  programmeTotal?: number;
}) {
  const shown = showUpcoming ? lines : lines.filter((l) => l.outcome !== 'upcoming');
  const lastNumber = lines.reduce((m, l) => Math.max(m, l.session.number), 0);
  const future = showUpcoming
    ? Array.from({ length: Math.max(0, programmeTotal - lastNumber) }, (_, i) => lastNumber + i + 1)
    : [];
  return (
    <ol className={`r-strip ${size === 'sm' ? 'r-strip--sm' : ''}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {shown.map((l) => (
        <li
          key={l.session.id}
          className={`r-dot r-dot--${l.outcome}`}
          title={`Session ${l.session.number}: ${l.session.title} — ${outcomeLabel[l.outcome]}`}
          aria-label={`Session ${l.session.number}, ${outcomeLabel[l.outcome]}`}
        >
          {pad2(l.session.number)}
        </li>
      ))}
      {future.map((n) => (
        <li key={`future-${n}`} className="r-dot r-dot--upcoming" aria-label={`Session ${n}, still to come`}>
          {pad2(n)}
        </li>
      ))}
    </ol>
  );
}

export function SessionLegend({ hasUpcoming, hasUnrecorded }: { hasUpcoming?: boolean; hasUnrecorded?: boolean }) {
  return (
    <div className="r-legend">
      <span>
        <i style={{ background: 'var(--kelly)' }} /> Attended
      </span>
      <span>
        <i style={{ boxShadow: 'inset 0 0 0 2px var(--ink-300)' }} /> Missed
      </span>
      {hasUnrecorded && (
        <span>
          <i style={{ boxShadow: 'inset 0 0 0 2px var(--ink-300)', background: 'var(--paper)' }} /> Not recorded
        </span>
      )}
      {hasUpcoming && (
        <span>
          <i style={{ background: 'var(--ink-100)' }} /> Still to come
        </span>
      )}
    </div>
  );
}
