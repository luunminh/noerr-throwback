export function MusicDisc({ playing, size }: { playing: boolean; size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="disc" aria-hidden="true">
      <g className={`disc__spin spin${playing ? '' : ' is-paused'}`}>
        <circle cx="50" cy="50" r="46" fill="#141414" stroke="#FF3FB4" strokeWidth="5" />
        {[38, 31, 24].map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#333" strokeWidth="1.5" />)}
        <circle cx="50" cy="82" r="3.5" fill="#FF6B1A" />
      </g>
      <circle cx="50" cy="50" r="15" fill="#5539EB" />
      {playing ? (
        <g fill="#FFF1DC">
          <rect x="43.5" y="43" width="4.5" height="14" rx="1" />
          <rect x="52" y="43" width="4.5" height="14" rx="1" />
        </g>
      ) : (
        <path d="M46 42 L59 50 L46 58 Z" fill="#FFF1DC" />
      )}
    </svg>
  );
}
