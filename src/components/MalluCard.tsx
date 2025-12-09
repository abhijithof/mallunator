'use client';

import React, { forwardRef } from 'react';
import type { VerificationResult } from '@/lib/types';

interface MalluCardProps {
  result: VerificationResult;
}

const MalluCard = forwardRef<HTMLDivElement, MalluCardProps>(({ result }, ref) => {
  const getCardImage = (tierCode: string): string => {
    switch (tierCode) {
      case 'PURE_BRED_MALLU':
        return '/memes/card-100.png';
      case 'MALLU_EXPLORER':
        return '/memes/card-70.png';
      case 'WEEKEND_MALLU':
        return '/memes/card-40.png';
      case 'NON_MALLU':
        return '/memes/card-0.png';
      default:
        return '/memes/card-0.png';
    }
  };

  const getTextColor = (tierCode: string): string => {
    switch (tierCode) {
      case 'PURE_BRED_MALLU':
      case 'MALLU_EXPLORER':
        return '#000000'; // Black for 70% and 100%
      case 'WEEKEND_MALLU':
      case 'NON_MALLU':
        return '#FFFFFF'; // White for 0% and 40%
      default:
        return '#FFFFFF';
    }
  };

  return (
    <div
      ref={ref}
      style={{
        width: '1920px',
        height: '1080px',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Background Image */}
      <img
        src={getCardImage(result.tierCode)}
        alt="Mallu Card"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      {/* Name Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '64px',
          left: '64px',
          fontSize: '64px',
          fontWeight: 300, // Thin font
          color: getTextColor(result.tierCode),
          letterSpacing: '1px',
        }}
      >
        {result.displayName}
      </div>
    </div>
  );
});

MalluCard.displayName = 'MalluCard';

export default MalluCard;
