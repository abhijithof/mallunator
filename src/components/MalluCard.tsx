'use client';

import React, { forwardRef, useState, useEffect, useImperativeHandle } from 'react';
import type { VerificationResult } from '@/lib/types';

interface MalluCardProps {
  result: VerificationResult;
  onImageLoaded?: () => void;
}

export interface MalluCardRef {
  isImageReady: () => boolean;
  waitForImage: () => Promise<void>;
}

const MalluCard = forwardRef<HTMLDivElement, MalluCardProps>(({ result, onImageLoaded }, ref) => {
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

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
        return '#000000';
      case 'WEEKEND_MALLU':
      case 'NON_MALLU':
        return '#FFFFFF';
      default:
        return '#FFFFFF';
    }
  };

  // Convert image to data URL for html-to-image compatibility
  useEffect(() => {
    setIsReady(false);
    const loadImage = async () => {
      try {
        const imagePath = getCardImage(result.tierCode);
        const response = await fetch(imagePath);
        const blob = await response.blob();
        
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Error loading image:', error);
        return '';
      }
    };
    
    loadImage().then((dataUrl) => {
      setImageDataUrl(dataUrl);
      // Wait for the image to actually render
      setTimeout(() => {
        setIsReady(true);
        onImageLoaded?.();
      }, 500);
    });
  }, [result.tierCode, onImageLoaded]);

  return (
    <div
      ref={ref}
      data-ready={isReady ? 'true' : 'false'}
      style={{
        width: '1920px',
        height: '1080px',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* Background Image - using background-image for better compatibility */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: imageDataUrl ? `url(${imageDataUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Name Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '64px',
          left: '64px',
          fontSize: '64px',
          fontWeight: 300,
          color: getTextColor(result.tierCode),
          letterSpacing: '1px',
          zIndex: 10,
        }}
      >
        {result.displayName}
      </div>
    </div>
  );
});

MalluCard.displayName = 'MalluCard';

export default MalluCard;
