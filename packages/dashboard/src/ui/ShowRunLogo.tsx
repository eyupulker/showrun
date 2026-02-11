import React from 'react';

/**
 * ShowRun brand icon — official logo mark from showrun_logo.svg.
 */
export function ShowRunIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 203 202"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ShowRun icon"
    >
      <path
        d="M202.06 101.12C202.06 156.7 157 201.76 101.42 201.76H0.780273V161.5H41.04C74.4 161.5 101.43 134.48 101.43 101.11H202.06V101.12Z"
        fill="#FF671A"
      />
      <path
        d="M0.769531 101.12C0.769531 45.5405 45.8302 0.480469 101.41 0.480469H202.05V40.7405H161.79C128.43 40.7405 101.4 67.7605 101.4 101.13H0.769531V101.12Z"
        fill="#FF671A"
      />
    </svg>
  );
}

/**
 * ShowRun full logo — icon + wordmark (horizontal layout).
 * Per brand guidelines: always use icon + text together, never text-only.
 */
export function ShowRunLogo({
  size = 'md',
  variant = 'auto',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'auto';
}) {
  const sizes = {
    sm: { icon: 18, text: 14, gap: 6 },
    md: { icon: 24, text: 18, gap: 8 },
    lg: { icon: 32, text: 24, gap: 10 },
    xl: { icon: 48, text: 36, gap: 12 },
  };

  const s = sizes[size];

  const textColor =
    variant === 'light' ? '#FFFFFF' :
    variant === 'dark' ? '#212121' :
    'var(--text-primary)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        lineHeight: 1,
      }}
    >
      <ShowRunIcon size={s.icon} />
      <span
        style={{
          fontSize: s.text,
          fontWeight: 700,
          color: textColor,
          fontFamily: "'Host Grotesk', 'Inter', sans-serif",
          letterSpacing: '0',
        }}
      >
        showrun
      </span>
    </span>
  );
}
