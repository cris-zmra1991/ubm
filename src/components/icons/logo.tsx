import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 20"
      width="100"
      height="20"
      aria-label="Unified Business Manager Logo"
      {...props}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'hsl(var(--accent))', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <rect width="8" height="16" x="2" y="2" rx="2" fill="url(#logoGradient)" />
      <rect width="8" height="16" x="12" y="2" rx="2" fill="hsl(var(--primary))" opacity="0.7" />
      <text
        x="25"
        y="15"
        fontFamily="var(--font-geist-sans), Arial, sans-serif"
        fontSize="12"
        fontWeight="bold"
        fill="hsl(var(--sidebar-foreground))"
      >
        UBM
      </text>
    </svg>
  );
}
