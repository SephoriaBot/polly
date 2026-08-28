import type { ReactNode } from 'react';

interface StitchDividerProps {
  /** Optional label rendered next to the stitch mark, e.g. "Today" */
  label?: ReactNode;
  className?: string;
}

export default function StitchDivider({ label, className }: StitchDividerProps) {
  return (
    <div className={`stitch-divider${className ? ` ${className}` : ''}`}>
      <span className="line" />
      <span className="mark" />
      {label && <span className="stitch-divider-label">{label}</span>}
      <span className="line" />
    </div>
  );
}
