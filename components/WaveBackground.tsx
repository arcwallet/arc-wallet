import React from 'react';

export const WaveBackground: React.FC = () => {
    // Create 20 concentric layers for the keyhole tunnel effect
    const layers = Array.from({ length: 20 }, (_, i) => i);

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#09121D] flex items-center justify-center pointer-events-none select-none">

            {/* --- Multi-Layered Dark-Tech Background --- */}

            {/* Base Gradients for specific screen regions */}
            <div className="absolute inset-0" style={{
                background: `
          radial-gradient(circle at 20% 20%, #0A0F1A 0%, transparent 55%),
          radial-gradient(circle at 50% 50%, #0D1828 0%, transparent 50%),
          radial-gradient(circle at 85% 40%, #0F1F32 0%, transparent 50%),
          linear-gradient(to top, #09121D 0%, transparent 100%)
        `
            }} />

            {/* Very Faint Cyan Glow Wash */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(47,203,255,0.04),transparent_65%)]" />

            {/* Ultrathin Horizontal Scanlines */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0px, transparent 1px)',
                backgroundSize: '100% 3px'
            }} />

            {/* Minimal Grain/Noise Texture via SVG Filter */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.02] mix-blend-overlay pointer-events-none">
                <filter id="noiseFilter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
                </filter>
                <rect width="100%" height="100%" filter="url(#noiseFilter)" />
            </svg>

            {/* --- Futuristic Keyhole Contour Lines --- */}
            <svg
                viewBox="0 0 200 300"
                className="w-full h-full max-w-[800px] max-h-[1000px] z-10"
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    {/* Soft Neon Blue Gradient */}
                    <linearGradient id="neonBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#5BA7D9" />
                        <stop offset="100%" stopColor="#A8CFF7" />
                    </linearGradient>

                    {/* Metallic Outer Bloom Filter (6-10% intensity) */}
                    <filter id="glow-bloom" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="0.8" result="coloredBlur" />
                        <feComponentTransfer in="coloredBlur" result="softGlow">
                            <feFuncA type="linear" slope="0.6" />
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode in="softGlow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <g transform="translate(0, -15)">
                    {layers.map((i) => {
                        // Scale: Outer (0) -> 1. Inner (19) -> Small
                        const scale = 1 - (i * 0.045);

                        // Animation: Sequential illumination from outer to inner
                        // i=0 (Outer) starts first.
                        const delay = i * 0.15;

                        return (
                            <g
                                key={i}
                                style={{
                                    transformOrigin: '100px 145px',
                                    transform: `scale(${scale})`
                                }}
                            >
                                {/* Keyhole Shape Path */}
                                <path
                                    d="M 65 245 L 135 245 L 125 130 A 40 40 0 1 0 75 130 L 65 245 Z"
                                    fill="none"
                                    stroke="url(#neonBlue)"
                                    // Thin, precise lines
                                    strokeWidth={0.5 / scale}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="animate-keyhole-sequence"
                                    style={{
                                        animationDelay: `${delay}s`,
                                        opacity: 0.15 // Base dim state
                                    }}
                                />
                            </g>
                        );
                    })}
                </g>
            </svg>

            <style>{`
        @keyframes keyhole-sequence {
          0% {
            opacity: 0.15;
            filter: none;
            stroke: #5BA7D9;
            stroke-width: 0.5px;
          }
          15% {
            opacity: 1;
            filter: url(#glow-bloom);
            stroke: #e0f2fe; /* Flash white-blue */
            stroke-width: 0.8px;
          }
          40% {
            opacity: 0.5;
            stroke: #A8CFF7;
            stroke-width: 0.6px;
          }
          100% {
            opacity: 0.15;
            filter: none;
            stroke: #5BA7D9;
            stroke-width: 0.5px;
          }
        }
        .animate-keyhole-sequence {
          animation: keyhole-sequence 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
        </div>
    );
};
