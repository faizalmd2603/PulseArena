import React from 'react';

export const RedTriangle = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="12,3 22,21 2,21" />
  </svg>
);

export const BlueDiamond = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="12,2 22,12 12,22 2,12" />
  </svg>
);

export const YellowCircle = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="10" />
  </svg>
);

export const GreenSquare = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

export const getShapeIcon = (index: number, className = "w-6 h-6") => {
  switch (index) {
    case 0:
      return <RedTriangle className={className} />;
    case 1:
      return <BlueDiamond className={className} />;
    case 2:
      return <YellowCircle className={className} />;
    case 3:
    default:
      return <GreenSquare className={className} />;
  }
};
