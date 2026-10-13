import { useId, type SVGProps } from "react";

// One-color Shucks glyph (kept under the upstream component name so every T3 Code surface that shows
// the app glyph picks it up): an open clam lid and bowl around a pearl, with a gap cut around the pearl.
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  const maskId = `${useId().replaceAll(":", "")}-shucks-gap`;
  return (
    <svg {...props} viewBox="7 7 50 48" xmlns="http://www.w3.org/2000/svg">
      <mask id={maskId}>
        <rect x="0" y="0" width="64" height="64" fill="var(--color-white)" />
        <circle cx="35" cy="37" r="13.5" fill="var(--color-black)" />
      </mask>
      <g mask={`url(#${maskId})`} fill="currentColor">
        <path d="M9 38C14 52 50 54 55 38C44 44 20 44 9 38Z" />
        <path d="M10 35C9 20 26 9 47 11C42 16 38 22 36 28C27 30 18 32 10 35Z" />
      </g>
      <circle cx="35" cy="37" r="10.5" fill="currentColor" />
    </svg>
  );
}
