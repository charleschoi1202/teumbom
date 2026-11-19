export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 15L16 6L28 15" stroke="#3182F6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13V25H24V13" stroke="#245BB5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 19.5C14.5 21.5 17.5 21.5 19.5 19.5" stroke="#3182F6" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <span className="t24 font-bold text-brand">틈봄</span>
    </div>
  );
}
