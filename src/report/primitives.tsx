import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Firm } from '../data/types';
import { initials } from './format';

export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Reveal className="r-section-head">
      <div className="r-rule" />
      <div className="r-eyebrow">{eyebrow}</div>
      <h2 className="r-h2">{title}</h2>
      {children}
    </Reveal>
  );
}

/** Fades content up the first time it scrolls into view. */
export function Reveal({
  children,
  className = '',
  as: Tag = 'div',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
  delay?: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={`r-reveal ${inView ? 'is-in' : ''} ${className}`}
      style={delay ? ({ transitionDelay: `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

export function useInView<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView];
}

export function Monogram({
  person,
  size = 'md',
}: {
  person: { firstName: string; lastName: string };
  size?: 'md' | 'lg';
}) {
  return (
    <div className={`r-monogram ${size === 'lg' ? 'r-monogram--lg' : ''}`} aria-hidden="true">
      {initials(person)}
    </div>
  );
}

/** Firm logo, or a typographic wordmark when no logo has been supplied. */
export function FirmMark({ firm, className }: { firm: Firm; className?: string }) {
  if (firm.logoUrl) return <img className={className} src={firm.logoUrl} alt={firm.name} />;
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 18,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {firm.name}
    </span>
  );
}

export const Icon = {
  Check: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Dash: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Clock: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.6V8l2.2 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Arrow: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Back: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function Percent({ value, fallback = '—' }: { value: number | null; fallback?: string }) {
  if (value === null) return <>{fallback}</>;
  return (
    <>
      {value}
      <small>%</small>
    </>
  );
}
