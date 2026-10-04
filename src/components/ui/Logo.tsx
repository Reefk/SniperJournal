/** Crosshair mark — the "sniper" in Sniper Journal */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-lg text-white"
      style={{
        width: size,
        height: size,
        background:
          'linear-gradient(140deg, var(--accent-strong), color-mix(in srgb, var(--profit) 70%, var(--accent-strong)))',
      }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.66} height={size * 0.66} fill="none" aria-hidden>
        <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="2.3" fill="currentColor" />
        <path
          d="M16 2.5v6M16 23.5v6M2.5 16h6M23.5 16h6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
