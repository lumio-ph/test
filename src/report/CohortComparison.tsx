import type { Comparison } from '../data/metrics';
import { useInView } from './primitives';

/**
 * A single horizontal bar: the fellow's rate as the fill, the cohort
 * average as a gold-tipped marker. Reads at a glance without a chart key.
 */
export function ComparisonBar({
  value,
  cohort,
  label = 'Cohort average',
  valueLabel,
  tone = 'kelly',
  slim = false,
  showLegend = true,
}: {
  value: number | null;
  cohort: number | null;
  label?: string;
  valueLabel?: string;
  tone?: 'kelly' | 'lime';
  slim?: boolean;
  showLegend?: boolean;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div ref={ref} className={`r-compare ${slim ? 'r-compare--slim' : ''}`}>
      <div
        className="r-compare__track"
        role="img"
        aria-label={`${valueLabel ?? 'Value'} ${value ?? 'not available'}%${cohort !== null ? `, ${label.toLowerCase()} ${cohort}%` : ''}`}
      >
        <div
          className={`r-compare__fill ${tone === 'lime' ? 'r-compare__fill--lime' : ''}`}
          style={{ width: `${pct}%`, transform: `scaleX(${inView ? 1 : 0})` }}
        />
        {cohort !== null && <div className="r-compare__marker" style={{ left: `${cohort}%` }} />}
      </div>
      {showLegend && (
        <div className="r-compare__legend">
          <span className="r-key">
            <span className="r-key__swatch" style={tone === 'lime' ? { background: 'var(--lime)' } : undefined} />
            {valueLabel ?? 'Fellow'} <b>{value === null ? '—' : `${value}%`}</b>
          </span>
          {cohort !== null && (
            <span className="r-key">
              <span className="r-key__marker" />
              {label} <b>{cohort}%</b>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Plain-English comparison, e.g. "9 points above the cohort average". */
export function comparisonPhrase(diff: number | null, cmp: Comparison, noun = 'the cohort average') {
  if (cmp === 'unknown' || diff === null) return null;
  if (cmp === 'level') return `in line with ${noun}`;
  const n = Math.abs(diff);
  return `${n} ${n === 1 ? 'point' : 'points'} ${cmp === 'above' ? 'above' : 'below'} ${noun}`;
}
