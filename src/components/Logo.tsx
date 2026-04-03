import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "h-12", showText = true }: LogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg viewBox="0 0 400 300" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C5A059" />
            <stop offset="50%" stopColor="#E2C284" />
            <stop offset="100%" stopColor="#967538" />
          </linearGradient>
        </defs>
        {/* Gold C (Behind) */}
        <path 
          d="M260 80 C210 80 180 120 180 170 C180 220 210 260 260 260 C290 260 315 245 330 220" 
          fill="none" 
          stroke="url(#goldGradient)" 
          strokeWidth="35" 
          strokeLinecap="butt"
        />
        
        {/* Green O (Foreground) */}
        <circle 
          cx="160" 
          cy="170" 
          r="75" 
          fill="none" 
          stroke="#064E3B" 
          strokeWidth="35" 
        />
        
        {/* Bars at the bottom of O */}
        <rect x="130" y="255" width="60" height="12" fill="#064E3B" />
        <rect x="130" y="275" width="60" height="12" fill="#064E3B" />
        
        {/* Text */}
        {showText && (
          <text 
            x="200" 
            y="360" 
            fontFamily="Inter, sans-serif" 
            fontSize="42" 
            fontWeight="400" 
            fill="url(#goldGradient)" 
            textAnchor="middle" 
            letterSpacing="8"
          >
            ORYCOMPTABILITE
          </text>
        )}
      </svg>
    </div>
  );
}
