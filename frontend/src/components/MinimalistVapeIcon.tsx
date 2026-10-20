import React from "react";

export function MinimalistVapeIcon({ className = "size-28" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 100 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.25)]"
      >
        {/* Bocal superior minimalista */}
        <path
          d="M42 12C42 8 46 5 50 5C54 5 58 8 58 12V24H42V12Z"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Corpo principal do pod com cantos arredondados */}
        <rect
          x="28"
          y="24"
          width="44"
          height="100"
          rx="14"
          fill="#0a0a0a"
          stroke="white"
          strokeWidth="3"
        />
        {/* Detalhe interno de visor / nível de juice */}
        <rect
          x="36"
          y="36"
          width="28"
          height="8"
          rx="4"
          fill="none"
          stroke="white"
          strokeWidth="2"
          opacity="0.8"
        />
        {/* Linha vertical central minimalista de acabamento */}
        <line
          x1="50"
          y1="56"
          x2="50"
          y2="92"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* LED indicador inferior */}
        <circle
          cx="50"
          cy="108"
          r="2.5"
          fill="white"
          opacity="0.9"
        />
        {/* Base de carregamento */}
        <line
          x1="45"
          y1="124"
          x2="55"
          y2="124"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}
