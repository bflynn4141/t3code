import { useId, type SVGProps } from "react";

/** The Shucks app mark: a clam open on a nacre pearl, on a glossy green tile. */
export function ShucksMark(props: SVGProps<SVGSVGElement>) {
  const id = useId().replaceAll(":", "");
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop style={{ stopColor: "var(--shucks-tile-top)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--shucks-jade)" }} />
          <stop offset="1" style={{ stopColor: "var(--shucks-kelp-deep)" }} />
        </linearGradient>
        <linearGradient id={`${id}-nacre`} x1="0.1" y1="0.05" x2="0.9" y2="0.95">
          <stop style={{ stopColor: "var(--nacre-rose)" }} />
          <stop offset="0.22" style={{ stopColor: "var(--nacre-peach)" }} />
          <stop offset="0.42" style={{ stopColor: "var(--nacre-lemon)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--nacre-mint)" }} />
          <stop offset="0.8" style={{ stopColor: "var(--nacre-sky)" }} />
          <stop offset="1" style={{ stopColor: "var(--nacre-lilac)" }} />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.34" cy="0.3" r="0.6">
          <stop style={{ stopColor: "var(--color-white)" }} />
          <stop offset="0.28" style={{ stopColor: "var(--color-white)" }} stopOpacity="0.35" />
          <stop offset="1" style={{ stopColor: "var(--color-white)" }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill={`url(#${id}-tile)`} />
      <path
        d="M2 19Q2 2 19 2H45Q62 2 62 19V23Q32 33 2 23Z"
        fill="var(--color-white)"
        opacity="0.2"
      />
      <path d="M9 38C14 52 50 54 55 38C44 44 20 44 9 38Z" fill="var(--color-white)" />
      <path
        d="M10 35C9 20 26 9 47 11C42 16 38 22 36 28C27 30 18 32 10 35Z"
        fill="var(--color-white)"
      />
      <circle cx="35" cy="37" r="10.5" fill={`url(#${id}-nacre)`} />
      <circle cx="35" cy="37" r="10.5" fill={`url(#${id}-shine)`} />
    </svg>
  );
}
