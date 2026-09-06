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

        /* transform-box: fill-box makes "center" mean the element's own center.
           Without it, SVG resolves transform-origin against the viewBox. */
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

      <svg
        viewBox="0 0 300 300"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Smiling Maltese dog avatar"
      >
        <defs>
          <radialGradient id="maltese-avatar-fur" cx="32%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f6f6f6" />
            <stop offset="100%" stopColor="#d8d8d8" />
          </radialGradient>
          <radialGradient id="maltese-avatar-fur-flip" cx="68%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f6f6f6" />
            <stop offset="100%" stopColor="#d8d8d8" />
          </radialGradient>
          <linearGradient id="maltese-avatar-ear" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#faf6ec" />
            <stop offset="100%" stopColor="#ddd0b6" />
          </linearGradient>
          <filter id="maltese-avatar-ground-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.18" />
          </filter>
        </defs>

        <g className="maltese-avatar-breathe" filter="url(#maltese-avatar-ground-shadow)">
          {/* Back Ears */}
          <ellipse cx="92" cy="125" rx="27" ry="50" fill="url(#maltese-avatar-ear)" transform="rotate(20, 90, 145)" />
          <ellipse cx="208" cy="125" rx="27" ry="50" fill="url(#maltese-avatar-ear)" transform="rotate(-20, 210, 145)" />

          {/* Head & Fluff */}
          <circle cx="150" cy="125" r="55" fill="url(#maltese-avatar-fur)" />
          <circle cx="150" cy="140" r="55" fill="url(#maltese-avatar-fur)" />
          <circle cx="115" cy="160" r="30" fill="url(#maltese-avatar-fur-flip)" />
          <circle cx="185" cy="160" r="30" fill="url(#maltese-avatar-fur)" />

          {/* Cheek warmth */}
          <ellipse cx="112" cy="152" rx="12" ry="7" fill="#f7b9a8" opacity="0.45" />
          <ellipse cx="188" cy="152" rx="12" ry="7" fill="#f7b9a8" opacity="0.45" />

          {/* Left Eye */}
          <g className="maltese-avatar-eye">
            <ellipse cx="125" cy="135" rx="13.5" ry="13" fill="#181412" />
            <circle cx="125" cy="136" r="4.6" fill="#0d0b0a" />
            <circle cx="129.5" cy="130.5" r="3.4" fill="#ffffff" />
            <circle cx="120.5" cy="140" r="1.6" fill="#ffffff" opacity="0.5" />
          </g>

          {/* Right Eye */}
          <g className="maltese-avatar-eye">
            <ellipse cx="175" cy="135" rx="13.5" ry="13" fill="#181412" />
            <circle cx="175" cy="136" r="4.6" fill="#0d0b0a" />
            <circle cx="179.5" cy="130.5" r="3.4" fill="#ffffff" />
            <circle cx="170.5" cy="140" r="1.6" fill="#ffffff" opacity="0.5" />
          </g>

          {/* Snout & Nose */}
          <ellipse cx="150" cy="167" rx="23" ry="17" fill="url(#maltese-avatar-fur)" />
          <ellipse cx="150" cy="158" rx="8" ry="6" fill="#181412" />

          {/* Smile: philtrum, tongue, then the mouth curve on top */}
          <path d="M 150 163 V 170" stroke="#181412" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 143 171 Q 150 184 157 171 Z" fill="#ff7da6" />
          <path
            d="M 134 165 Q 142 178 150 170 Q 158 178 166 165"
            stroke="#181412"
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
