// SephoraLogo.tsx
import React from 'react';

interface SephoraLogoProps {
  className?: string; // Extra tailwind classes
  iconOnly?: boolean;  // Render only the flame element or whole logo
}

export const SephoraLogo: React.FC<SephoraLogoProps> = ({ className = "w-10 h-10", iconOnly = false }) => {
  return (
    <div 
      className={`relative flex flex-col items-center justify-center bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-transform group-hover:scale-105 select-none ${className}`}
      id="sephora-embedded-logo"
    >
      {/* S-wave Flame */}
      <svg
        viewBox="0 0 100 100"
        className={iconOnly ? "w-2/3 h-2/3" : "w-1/2 h-1/2 mt-1"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50 10C52.5 24 41 33 41 45C41 57 52 64 47.5 80C45 68 37 60 37 49C37 38 47.5 28 45 10C47.5 10 48.5 10 50 10Z"
          fill="white"
        />
      </svg>
      
      {/* Wordmark below */}
      {!iconOnly && (
        <span className="text-[6px] tracking-[0.16em] font-black text-white leading-none mb-1 mt-0.5 font-sans">
          SEPHORA
        </span>
      )}
    </div>
  );
};
