interface MalteseAvatarProps {
  size?: number
}

export default function MalteseAvatar({ size = 300 }: MalteseAvatarProps) {
  return (
    <div className="maltese-avatar-container" style={{ width: size, height: size }}>
      <style>{`
        .maltese-avatar-breathe {
          transform-origin: 150px 200px;
          animation: maltese-avatar-breathe 4s ease-in-out infinite;
        }

        .maltese-avatar-eye {
          transform-box: fill-box;
          transform-origin: center;
          animation: maltese-avatar-blink 5.2s ease-in-out infinite;
        }

        @keyframes maltese-avatar-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-3px) scale(1.02); }
        }

        @keyframes maltese-avatar-blink {
          0%, 93%, 100% { transform: scaleY(1); }
          95.5%, 96.5%  { transform: scaleY(0.08); }
        }

        @media (prefers-reduced-motion: reduce) {
          .maltese-avatar-breathe, .maltese-avatar-eye { animation: none; }
        }
      `}</style>

      <svg viewBox="0 0 300 300" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Smiling Maltese dog avatar">
        <defs>
          <radialGradient id="maltese-avatar-fur" cx="32%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f6f6f6" />
            <stop offset="100%" stopColor="#d8d8d8" />
          </radialGradient>
          <filter id="maltese-avatar-ground-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.18" />
          </filter>
        </defs>

        <g transform="translate(150 150) scale(1.7) translate(-150 -150)">
          <g className="maltese-avatar-breathe" filter="url(#maltese-avatar-ground-shadow)">
            {/* Head & Fluff */}
            <circle cx="150" cy="145" r="70" fill="url(#maltese-avatar-fur)" />

            {/* Left Eye */}
            <g className="maltese-avatar-eye">
              <ellipse cx="125" cy="135" rx="12" ry="13" fill="#181412" />
              <circle cx="125" cy="136" r="4.6" fill="#0d0b0a" />
              <circle cx="129.5" cy="130.5" r="3.4" fill="#ffffff" />
              <circle cx="120.5" cy="140" r="1.6" fill="#ffffff" opacity="0.5" />
            </g>

            {/* Right Eye */}
            <g className="maltese-avatar-eye">
              <ellipse cx="175" cy="135" rx="12" ry="13" fill="#181412" />
              <circle cx="175" cy="136" r="4.6" fill="#0d0b0a" />
              <circle cx="179.5" cy="130.5" r="3.4" fill="#ffffff" />
              <circle cx="170.5" cy="140" r="1.6" fill="#ffffff" opacity="0.5" />
            </g>

            {/* Nose */}
            <ellipse cx="150" cy="155" rx="8" ry="6" fill="#181412" />
            <ellipse cx="153" cy="152" rx="2.4" ry="1.6" fill="#ffffff" opacity="0.7" />

            {/* Lips */}
            <path d="M 150 161 V 168" stroke="#181412" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path
              d="M 150 168 Q 140 176 132 170"
              stroke="#181412"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 150 168 Q 160 176 168 170"
              stroke="#181412"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
