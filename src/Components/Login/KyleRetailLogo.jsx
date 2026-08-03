import React from 'react';

export default function KyleRetailLogo({ width = 220, className = '' }) {
  return (
    <svg
      width={width}
      viewBox="0 0 500 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="kyleBlueGrad" x1="0" y1="0" x2="500" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <filter id="glowShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0ea5e9" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Styled Modern 'K' Brand Mark */}
      <g filter="url(#glowShadow)">
        {/* Upper Arm */}
        <path
          d="M 160 70 L 250 70 L 340 70 L 230 145 Z"
          fill="url(#kyleBlueGrad)"
        />
        {/* Main Ribbon Stroke */}
        <path
          d="M 160 70 L 140 180 C 130 230 180 235 240 200 C 290 170 310 200 270 240 L 110 320 L 145 320 L 290 245 C 310 235 300 220 280 210 C 210 175 185 240 160 70 Z"
          fill="url(#kyleBlueGrad)"
        />
        {/* Bottom Support Stroke */}
        <path
          d="M 110 320 L 240 240 L 285 270 L 155 350 Z"
          fill="url(#kyleBlueGrad)"
        />

        {/* POS Circle Badge */}
        <circle cx="320" cy="270" r="55" fill="none" stroke="url(#kyleBlueGrad)" strokeWidth="12" />
        
        {/* Monitor & Cash Register Icon Inside Badge */}
        <rect x="292" y="245" width="36" height="26" rx="4" fill="none" stroke="#0ea5e9" strokeWidth="3" />
        <line x1="310" y1="271" x2="310" y2="280" stroke="#0ea5e9" strokeWidth="3" />
        <line x1="298" y1="280" x2="322" y2="280" stroke="#0ea5e9" strokeWidth="3" />
        
        {/* Shopping Cart Lines */}
        <path d="M 302 254 H 318 L 315 264 H 305 Z" fill="none" stroke="#0ea5e9" strokeWidth="2" />
        <circle cx="306" cy="268" r="1.5" fill="#0ea5e9" />
        <circle cx="314" cy="268" r="1.5" fill="#0ea5e9" />

        {/* Receipt Printer */}
        <rect x="334" y="258" width="18" height="22" rx="3" fill="none" stroke="#0ea5e9" strokeWidth="3" />
        <path d="M 338 252 H 348 V 258 H 338 Z" fill="#38bdf8" />
        <line x1="337" y1="266" x2="349" y2="266" stroke="#0ea5e9" strokeWidth="2" />
        <line x1="337" y1="271" x2="345" y2="271" stroke="#0ea5e9" strokeWidth="2" />
      </g>

      {/* Brand Text Typography */}
      <g>
        {/* KYLE */}
        <text
          x="40"
          y="395"
          fill="#0f172a"
          fontFamily="Inter, sans-serif"
          fontWeight="900"
          fontSize="40"
          letterSpacing="2"
        >
          KYLE
        </text>

        {/* RETAIL */}
        <text
          x="155"
          y="395"
          fill="#0ea5e9"
          fontFamily="Inter, sans-serif"
          fontWeight="900"
          fontSize="40"
          letterSpacing="2"
        >
          RETAIL
        </text>

        {/* POS Pill Badge */}
        <rect x="335" y="363" width="70" height="38" rx="10" fill="url(#kyleBlueGrad)" />
        <text
          x="347"
          y="390"
          fill="#ffffff"
          fontFamily="Inter, sans-serif"
          fontWeight="900"
          fontSize="23"
          letterSpacing="1"
        >
          POS
        </text>

        {/* Tagline Subtext */}
        <line x1="75" y1="418" x2="110" y2="418" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
        <text
          x="120"
          y="422"
          fill="#64748b"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize="13"
          letterSpacing="3"
        >
          SMART RETAIL. SEAMLESS SALES.
        </text>
        <line x1="385" y1="418" x2="420" y2="418" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
