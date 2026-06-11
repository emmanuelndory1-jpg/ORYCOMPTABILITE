import React from 'react';

interface FNELogoProps {
  className?: string;
  size?: number | string;
}

export const FNELogo: React.FC<FNELogoProps> = ({ className = 'h-10 w-10', size = '100%' }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Circle - FNE Orange */}
      <circle cx="50" cy="50" r="43" stroke="#F26E1F" strokeWidth="5.5" fill="none" />
      
      {/* CÃ´te d'Ivoire Outline Map - left side orange, right side green */}
      {/* Orange West Border */}
      <path 
        d="M 38,22 
           C 34,25 32,30 33,34 
           C 34,38 31,40 31,43 
           C 31,46 29,48 29,51 
           C 29,54 27,56 28,59 
           C 29,62 33,65 33,68 
           C 33,71 31,73 34,75 
           C 37,77 43,76 46,74
           C 49,72 55,72 58,71" 
        stroke="#F26E1F" 
        strokeWidth="3.2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Green East/North Border */}
      <path 
        d="M 38,22 
           C 41,20 44,18 48,18 
           C 52,18 57,20 61,22 
           C 65,24 67,23 70,27 
           C 73,31 71,35 73,40 
           C 75,45 74,50 75,54 
           C 76,58 73,61 74,65 
           C 75,69 71,71 67,73 
           C 63,75 60,74 58,71" 
        stroke="#10B981" 
        strokeWidth="3.2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />

      {/* Inner Circle - Transparent interior with Green stroke */}
      <circle cx="50" cy="46" r="23" stroke="#10B981" strokeWidth="3" fill="none" />

      {/* Modern stylized letter 'f' (Orange) */}
      <path 
        d="M 45,34 C 47,34 49,34 49,37 L 49,52 M 41,41 H 52" 
        stroke="#F26E1F" 
        strokeWidth="4" 
        strokeLinecap="round" 
        fill="none" 
      />

      {/* Modern stylized letter 'e' (Green) */}
      <path 
        d="M 52,43 H 62 C 62,37 54,37 54,43 C 54,49 61,49 61,45" 
        stroke="#10B981" 
        strokeWidth="4.2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none" 
      />
    </svg>
  );
};
