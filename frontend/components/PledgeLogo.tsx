import React from "react";

export function PledgeLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Sleek Interlocking Geometry forming 'P' & Shield for Pledge */}
      <path
        d="M8 6H20C24.4183 6 28 9.58172 28 14C28 18.4183 24.4183 22 20 22H14V26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="14" r="2.5" fill="currentColor" />
    </svg>
  );
}
